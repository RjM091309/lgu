import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, ClipboardList, Clock, Hourglass, Loader2, MapPin, Mic, MicOff, Play, RotateCcw, Settings, ShieldCheck, Video, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUsers } from '@/lib/access-store';
import { logActivity } from '@/lib/activity-log';
import { useCalendarSessions } from '@/lib/esession-sync';
import { isInvited, type MobileAccount } from '@/lib/mobile-accounts';
import { inviteesFor } from '@/lib/attendance';
import type { Session } from '@/lib/mock-data';
import { formatLongDate } from '@/lib/sessions';
import { cn } from '@/lib/utils';
import {
  RoomConnection,
  RoomError,
  elapsedClock,
  fetchAudit,
  fetchServerInfo,
  joinRoom,
  roleIn,
  roleLabelFor,
  roomErrorMessage,
  startRoom,
  useLobby,
  type ChatMessage,
  type RoomRole,
  type RoomStatus,
  type RoomSummary,
  type RoomView,
} from '@/lib/esession-room';
import {
  AudioLevels,
  CallRecorder,
  MeshCall,
  canShareScreen,
  describeDevice,
  recordingExtension,
  recordingMimeType,
  requestWakeLock,
  resumeAudio,
  videoProfileFor,
  type PeerInfo,
} from '@/lib/esession-rtc';
import { attendanceRecordName, attendanceRecordPdf, recordingFileName, saveToSessionFiles } from '@/lib/esession-records';
import { useLocalMedia, type LocalMedia } from '@/components/esession-room/use-local-media';
import { DeviceSelects, MicMeter } from '@/components/esession-room/DeviceControls';
import { CallStage, type Panel } from '@/components/esession-room/CallStage';
import { useFullscreen } from '@/components/esession-room/use-fullscreen';
import { VideoView } from '@/components/esession-room/VideoTile';
import { InsecureNotice, LiveBadge, RoleBadge, TypeBadge, useNow } from '@/components/esession-room/es-ui';

// One e-session, from the device check to leaving: before joining (camera, microphone, devices), the
// waiting room, the call itself, and what happened at the end. The connections to the other devices
// live here so they survive switching layouts and panels.

type Outcome = 'left' | 'ended' | 'removed' | 'denied' | 'replaced' | 'lost';
type Phase =
  | { name: 'prejoin' }
  | { name: 'joining' }
  | { name: 'waiting' }
  | { name: 'in-call' }
  | { name: 'rejoining'; since: number; roomId: string }
  | { name: 'outcome'; kind: Outcome; by?: string | null; roomId: string };

// After the server lets go of a dropped device, it keeps trying to get back in for this long, a little less often
// each time, before showing "connection lost".
const REJOIN_FOR_MS = 3 * 60_000;
const REJOIN_FIRST_DELAY_MS = 1000;
const REJOIN_MAX_DELAY_MS = 8000;
// The server lets go of a silent device after 60 s (DROP_GRACE_MS in server/esession-rooms.mjs). An offline device
// cannot hear that, so after a little longer than that it switches to rejoining by itself.
const ASSUME_DROPPED_AFTER_MS = 65_000;

// A level (root mean square) above this counts as speaking; it stays lit a moment after the voice stops.
const SPEAKING_LEVEL = 0.025;
const SPEAKING_HOLD_MS = 700;

export function ESessionRoom({ account }: { account: MobileAccount }) {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const users = useUsers();
  const sessions = useCalendarSessions();
  const session = sessions.find((entry) => entry.id === sessionId);
  const { live, status: lobbyStatus } = useLobby();
  const liveRoom = live.find((room) => room.sessionId === sessionId);

  const [phase, setPhase] = useState<Phase>({ name: 'prejoin' });
  const media = useLocalMedia(phase.name !== 'outcome');
  const [room, setRoom] = useState<RoomView | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [panel, setPanelState] = useState<Panel | null>(null);
  const [peers, setPeers] = useState<Map<string, PeerInfo>>(new Map());
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const [screenTrack, setScreenTrack] = useState<MediaStreamTrack | null>(null);
  const [recordingHere, setRecordingHere] = useState(false);
  const [streamReconnecting, setStreamReconnecting] = useState(false);
  const [floorPrompt, setFloorPrompt] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const self = useRef<{ pid: string; seq: number; role: RoomRole; roomId: string } | null>(null);
  const conn = useRef<RoomConnection | null>(null);
  const mesh = useRef<MeshCall | null>(null);
  const levels = useRef<AudioLevels | null>(null);
  const recorder = useRef<CallRecorder | null>(null);
  const endingByMe = useRef(false);
  const panelRef = useRef(panel);
  panelRef.current = panel;

  const screenStream = useMemo(() => (screenTrack ? new MediaStream([screenTrack]) : null), [screenTrack]);

  const invited = session ? account.canManage || isInvited(session, users, account.inviteeId) : false;
  const myRole = session ? roleIn(account, session) : 'participant';

  // Full screen during the call: hosts and presiding officers go full screen with the join tap; invitees who
  // ask to join are offered it once they are in, since being admitted is not a tap the browser accepts.
  const fullscreen = useFullscreen(phase.name === 'in-call');
  const askedToJoin = useRef(false);
  const { arrived: fullscreenArrived, release: releaseFullscreen } = fullscreen;
  useEffect(() => {
    if (phase.name === 'in-call') fullscreenArrived(askedToJoin.current);
    else if (phase.name !== 'joining' && phase.name !== 'rejoining') releaseFullscreen();
  }, [phase.name, fullscreenArrived, releaseFullscreen]);
  useEffect(() => releaseFullscreen, [releaseFullscreen]);

  const setPanel = useCallback((next: Panel | null) => {
    setPanelState(next);
    if (next === 'chat') setUnread(0);
  }, []);

  // ---- Tearing down -----------------------------------------------------------------------------

  const teardown = useCallback(() => {
    conn.current?.close();
    conn.current = null;
    mesh.current?.close();
    mesh.current = null;
    levels.current?.close();
    levels.current = null;
    setScreenTrack((track) => {
      track?.stop();
      return null;
    });
    setPeers(new Map());
    setSpeaking(new Set());
    setStreamReconnecting(false);
    setFloorPrompt(false);
  }, []);

  /** Stops the recorder on this device and saves what it captured to Session Files. */
  const stopRecording = useCallback(
    async (tellServer: boolean) => {
      const active = recorder.current;
      if (!active) return;
      recorder.current = null;
      setRecordingHere(false);
      if (tellServer) void conn.current?.send('recording', { on: false });
      const blob = await active.stop();
      const title = room?.title ?? session?.title ?? 'E-Session';
      const targetSession = room?.sessionId ?? sessionId;
      if (blob.size === 0) return;
      const name = recordingFileName(title, active.startedAt, recordingExtension(active.mimeType));
      const error = await saveToSessionFiles({ name, blob, kind: 'audio', category: 'Audio Recording', sessionId: targetSession }, account);
      if (error) {
        // Not lost: hand it over as a download instead.
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        toast('Recording downloaded instead', `${error} The recording was downloaded to this device.`, 'error');
        return;
      }
      void conn.current?.send('recording-saved', { name });
      logActivity({ user: account.username, module: 'E-Session', action: 'Uploaded', summary: `Saved the e-session audio recording of the ${title}`, detail: 'Added to Session Files under Audio Recording.' });
      toast('Recording saved', `${name} is in Session Files, ready to play and transcribe.`);
    },
    [account, room, session, sessionId]
  );

  const finish = useCallback(
    (kind: Outcome, by?: string | null) => {
      // Ending by this host is reported twice (the server's notice and the request's answer); act once.
      if (!self.current) return;
      const roomId = self.current.roomId;
      void stopRecording(false);
      teardown();
      self.current = null;
      setRoom(null);
      setPanelState(null);
      setPhase({ name: 'outcome', kind: endingByMe.current && kind === 'ended' ? 'ended' : kind, by: endingByMe.current ? account.name : by, roomId });
    },
    [account.name, stopRecording, teardown]
  );

  // ---- Joining ----------------------------------------------------------------------------------

  // Handlers read the latest state through this ref, since the connection outlives renders.
  const handlers = useRef({
    status: (_status: RoomStatus) => {},
    control: (_control: { type: 'mute' | 'floor'; by: string }) => {},
    lost: () => {},
  });
  handlers.current.lost = () => (phaseRef.current === 'in-call' ? startRejoin() : finish('lost'));
  handlers.current.status = (status) => {
    if (status.state === 'joined') setPhase({ name: 'in-call' });
    else if (status.state === 'waiting') setPhase({ name: 'waiting' });
    else finish(status.state, 'by' in status ? status.by : null);
  };
  handlers.current.control = (control) => {
    if (control.type === 'mute') {
      media.setMicOn(false);
      toast('You were muted', `${control.by} muted your microphone. Unmute when you have the floor.`, 'info');
    } else {
      setFloorPrompt(true);
      navigator.vibrate?.(150);
    }
  };

  const phaseRef = useRef(phase.name);
  phaseRef.current = phase.name;

  /** Joins room `roomId` and opens its connections; throws (a RoomError) when the server says no. */
  const enterRoom = async (roomId: string) => {
    const info = await fetchServerInfo();
    const result = await joinRoom(roomId, account, { device: describeDevice(), audio: media.micOn && !!media.audioTrack, video: media.camOn });
    self.current = { pid: result.pid, seq: result.seq, role: result.role, roomId };
    levels.current = new AudioLevels();
    const call = new MeshCall({
      selfSeq: result.seq,
      iceServers: info.iceServers,
      send: (to, data) => void conn.current?.send('signal', { target: to, data }),
      onChange: () => setPeers(call.snapshot()),
    });
    mesh.current = call;
    const connection = new RoomConnection(roomId, result.pid, result.token, {
      onStatus: (status) => handlers.current.status(status),
      onRoom: (view) => {
        setRoom(view);
        call.sync(view.participantsList.filter((p) => p.pid !== result.pid));
      },
      onSignal: (from, data) => void call.handleSignal(from, data),
      onChat: (message) => {
        setChat((list) => [...list, message].slice(-500));
        if (panelRef.current !== 'chat' && message.from.pid !== result.pid) setUnread((count) => count + 1);
      },
      onChatHistory: (messages) => setChat(messages),
      onControl: (control) => handlers.current.control(control),
      onReconnecting: setStreamReconnecting,
      onLost: () => handlers.current.lost(),
    });
    conn.current = connection;
    connection.open();
    setChat([]);
    setUnread(0);
    setPhase(result.state === 'joined' ? { name: 'in-call' } : { name: 'waiting' });
  };

  const join = async (startFirst: boolean) => {
    if (!session) return;
    // Created inside the tap so iPads let the sound play.
    resumeAudio();
    askedToJoin.current = !startFirst && myRole === 'participant';
    if (!askedToJoin.current) fullscreen.autoEnter();
    setPhase({ name: 'joining' });
    try {
      let roomId = liveRoom?.roomId;
      if (startFirst || !roomId) {
        roomId = (await startRoom(account, session, users)).roomId;
        if (startFirst) logActivity({ user: account.username, module: 'E-Session', action: 'Updated', summary: `Started the e-session: ${session.title}` });
      }
      await enterRoom(roomId);
    } catch (error) {
      teardown();
      self.current = null;
      setPhase({ name: 'prejoin' });
      toast('Could not join the e-session', roomErrorMessage(error), 'error');
    }
  };

  // The server let go of this device after its connection dropped for too long. Get back in by ourselves: the
  // server lets a dropped person straight back (no waiting room), so this only needs the connection to return.
  const rejoinRun = useRef<{ cancelled: boolean } | null>(null);
  const startRejoin = () => {
    if (!self.current) return;
    const roomId = self.current.roomId;
    void stopRecording(false);
    teardown();
    self.current = null;
    setRoom(null);
    const since = Date.now();
    setPhase({ name: 'rejoining', since, roomId });
    const run = { cancelled: false };
    rejoinRun.current = run;
    void (async () => {
      let delay = REJOIN_FIRST_DELAY_MS;
      while (!run.cancelled && Date.now() - since < REJOIN_FOR_MS) {
        try {
          await enterRoom(roomId);
          if (!run.cancelled) toast('Back in the e-session', 'Your connection returned and you rejoined.', 'success');
          return;
        } catch (error) {
          teardown();
          self.current = null;
          const code = error instanceof RoomError ? error.code : '';
          // These answers will not change by trying again.
          const final: Outcome | null = code === 'ended' ? 'ended' : code === 'removed' ? 'removed' : code === 'not_found' || code === 'not_invited' || code === 'locked' ? 'lost' : null;
          if (final) {
            if (!run.cancelled) setPhase({ name: 'outcome', kind: final, roomId });
            return;
          }
        }
        // Wait before the next try, but go at once when the browser says the network is back.
        await new Promise<void>((resolve) => {
          const done = () => {
            window.clearTimeout(timer);
            window.removeEventListener('online', done);
            resolve();
          };
          const timer = window.setTimeout(done, delay);
          window.addEventListener('online', done);
        });
        delay = Math.min(delay * 2, REJOIN_MAX_DELAY_MS);
      }
      if (!run.cancelled) setPhase({ name: 'outcome', kind: 'lost', roomId });
    })();
  };
  const cancelRejoin = (roomId: string) => {
    if (rejoinRun.current) rejoinRun.current.cancelled = true;
    rejoinRun.current = null;
    teardown();
    self.current = null;
    setPhase({ name: 'outcome', kind: 'left', roomId });
  };
  useEffect(
    () => () => {
      if (rejoinRun.current) rejoinRun.current.cancelled = true;
    },
    []
  );

  // ---- While connected --------------------------------------------------------------------------

  const inCall = phase.name === 'in-call';

  // Offline for longer than the server waits: stop showing a frozen call and get back in once the network returns.
  const startRejoinRef = useRef(startRejoin);
  startRejoinRef.current = startRejoin;
  useEffect(() => {
    if (!inCall || !streamReconnecting) return;
    const timer = window.setTimeout(() => startRejoinRef.current(), ASSUME_DROPPED_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [inCall, streamReconnecting]);
  const connected = phase.name === 'in-call' || phase.name === 'waiting';

  // What this device sends: its microphone, and its screen or camera.
  const outgoingVideo = screenTrack ?? (media.camOn ? media.videoTrack : null);
  useEffect(() => {
    mesh.current?.setTracks(media.audioTrack, outgoingVideo);
  }, [media.audioTrack, outgoingVideo, phase.name]);

  // Tell the room whether my microphone and camera are on.
  const micLive = media.micOn && !!media.audioTrack;
  useEffect(() => {
    if (!inCall) return;
    void conn.current?.send('state', { audio: micLive, video: outgoingVideo !== null, screen: screenTrack !== null });
  }, [inCall, micLive, outgoingVideo, screenTrack]);

  // Video quality by room size, sharper for whoever has the floor or shares a screen.
  const others = Math.max(0, (room?.participantsList.length ?? 1) - 1);
  const prominent = !!room && !!self.current && room.floor === self.current.pid;
  useEffect(() => {
    mesh.current?.setProfile(videoProfileFor(others, prominent, screenTrack !== null));
  }, [others, prominent, screenTrack]);

  // Who is speaking: measured on this device for everyone, so it needs no server traffic.
  useEffect(() => {
    const meter = levels.current;
    const selfPid = self.current?.pid;
    if (!inCall || !meter || !selfPid) return;
    meter.track(selfPid, media.audioTrack ? new MediaStream([media.audioTrack]) : null);
    peers.forEach((peer, pid) => meter.track(pid, peer.stream));
    meter.forgetExcept(new Set([selfPid, ...peers.keys()]));
    recorder.current?.set(selfPid, media.audioTrack ? new MediaStream([media.audioTrack]) : null);
    peers.forEach((peer, pid) => recorder.current?.set(pid, peer.stream));
    recorder.current?.forgetExcept(new Set([selfPid, ...peers.keys()]));
  }, [inCall, peers, media.audioTrack]);

  useEffect(() => {
    if (!inCall) return;
    const lastLoud = new Map<string, number>();
    const timer = setInterval(() => {
      const meter = levels.current;
      if (!meter) return;
      const now = Date.now();
      meter.levels().forEach((level, pid) => {
        if (level > SPEAKING_LEVEL) lastLoud.set(pid, now);
      });
      const next = new Set([...lastLoud].filter(([, at]) => now - at < SPEAKING_HOLD_MS).map(([pid]) => pid));
      setSpeaking((current) => (current.size === next.size && [...next].every((pid) => current.has(pid)) ? current : next));
    }, 250);
    return () => clearInterval(timer);
  }, [inCall]);

  // Another host stopped this device's recording: save what was captured.
  useEffect(() => {
    if (recorder.current && room && !room.recordingBy && Date.now() - recorder.current.startedAt > 3_000) void stopRecording(false);
  }, [room, stopRecording]);

  // Keep the screen on, and leave cleanly if the tab closes.
  useEffect(() => {
    if (!connected) return;
    let lock: { release: () => Promise<void> } | null = null;
    const acquire = async () => {
      if (document.visibilityState === 'visible') lock = await requestWakeLock();
    };
    void acquire();
    const onVisible = () => void acquire();
    const onHide = () => conn.current?.leaveBeacon();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onHide);
      void lock?.release().catch(() => undefined);
    };
  }, [connected]);

  // Leaving the page (back button, another tab of the app) leaves the room.
  useEffect(
    () => () => {
      conn.current?.leaveBeacon();
      recorder.current = null;
      conn.current?.close();
      mesh.current?.close();
      levels.current?.close();
    },
    []
  );

  // ---- Actions ----------------------------------------------------------------------------------

  const act = useCallback(async (type: string, payload: Record<string, unknown> = {}) => {
    try {
      await conn.current?.act(type, payload);
      return true;
    } catch (error) {
      toast('That did not go through', roomErrorMessage(error), 'error');
      return false;
    }
  }, []);

  const sendChat = useCallback((text: string) => act('chat', { text }), [act]);

  const toggleShare = useCallback(async () => {
    if (screenTrack) {
      screenTrack.stop();
      setScreenTrack(null);
      return;
    }
    const other = room?.participantsList.find((p) => p.screen && p.pid !== self.current?.pid);
    if (other) return toast('Someone is already sharing', `${other.name} is sharing their screen. Ask them to stop first.`, 'info');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 15 } }, audio: false });
      const track = stream.getVideoTracks()[0];
      track.contentHint = 'detail';
      track.addEventListener('ended', () => setScreenTrack((current) => (current === track ? null : current)));
      setScreenTrack(track);
    } catch {
      // Cancelled in the browser's picker.
    }
  }, [room, screenTrack]);

  const toggleRecording = useCallback(async () => {
    if (recorder.current) {
      // One tap on the bar stops it, so make sure that tap was meant.
      const since = room?.recordingBy?.since;
      const confirmed = await confirmAction({
        title: 'Stop and save the recording?',
        description: `${since ? `${elapsedClock(Date.now() - since)} recorded so far. ` : ''}The recording is saved to Session Files, and you can start a new one afterwards.`,
        confirmLabel: 'Stop & save',
      });
      if (confirmed && recorder.current) await stopRecording(true);
      return;
    }
    if (room?.recordingBy) {
      const confirmed = await confirmAction({ title: 'Stop the recording?', description: `${room.recordingBy.name} is recording this e-session. Their device saves what was recorded so far.`, confirmLabel: 'Stop recording' });
      if (confirmed) void act('recording', { on: false });
      return;
    }
    const ctx = levels.current?.ctx;
    if (!ctx || !recordingMimeType()) return toast('Recording is not available', 'This browser cannot record audio. Try Chrome, Edge, or Safari on another device.', 'error');
    const confirmed = await confirmAction({
      title: 'Record this e-session?',
      description: 'Everyone sees that the e-session is being recorded. The audio of all participants is recorded on this device and saved to Session Files when you stop.',
      confirmLabel: 'Start recording',
    });
    if (!confirmed) return;
    resumeAudio();
    let active: CallRecorder;
    try {
      active = new CallRecorder(ctx);
    } catch (error) {
      return toast('Recording could not start', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
    if (!(await act('recording', { on: true }))) {
      await active.stop();
      return;
    }
    recorder.current = active;
    const selfPid = self.current?.pid;
    if (selfPid && media.audioTrack) active.set(selfPid, new MediaStream([media.audioTrack]));
    peers.forEach((peer, pid) => active.set(pid, peer.stream));
    setRecordingHere(true);
  }, [act, media.audioTrack, peers, room, stopRecording]);

  const leave = async () => {
    await stopRecording(true);
    await act('leave');
    finish('left');
  };

  const endForEveryone = async () => {
    setLeaveOpen(false);
    const confirmed = await confirmAction({
      title: 'End the e-session for everyone?',
      description: 'Everyone leaves at once and the e-session closes. Its attendance record is saved to Session Files.',
      confirmLabel: 'End e-session',
      tone: 'destructive',
    });
    if (!confirmed) return;
    const roomId = self.current?.roomId;
    await stopRecording(true);
    endingByMe.current = true;
    if (!(await act('end'))) {
      endingByMe.current = false;
      return;
    }
    finish('ended', account.name);
    if (!roomId) return;
    const audit = await fetchAudit(roomId);
    if (!audit) return;
    const error = await saveToSessionFiles({ name: attendanceRecordName(audit), blob: attendanceRecordPdf(audit, session ? inviteesFor(session, users) : []), kind: 'pdf', category: 'Supporting Document', sessionId: audit.room.sessionId }, account);
    logActivity({ user: account.username, module: 'E-Session', action: 'Updated', summary: `Ended the e-session: ${audit.room.title}`, detail: `${audit.attendance.length} attendees` });
    if (error) toast('Attendance record not saved', error, 'error');
    else toast('E-session ended', 'The attendance record was saved to Session Files.');
  };

  const onLeaveClick = async () => {
    if (self.current?.role === 'host') return setLeaveOpen(true);
    const confirmed = await confirmAction({ title: 'Leave the e-session?', description: 'You can rejoin while it is still going. The time you leave is recorded.', confirmLabel: 'Leave' });
    if (confirmed) void leave();
  };

  // ---- Screens ----------------------------------------------------------------------------------

  if (!session) {
    return (
      <SimpleScreen title="Session not found" icon={CalendarClock}>
        {sessions.length ? 'This session is not on the calendar.' : 'Loading…'}
      </SimpleScreen>
    );
  }
  if (!invited) {
    return (
      <SimpleScreen title="You are not invited to this session" icon={ShieldCheck}>
        Only members and staff on the invitation list of {session.title} can join its e-session.
      </SimpleScreen>
    );
  }

  if (phase.name === 'rejoining') return <RejoiningScreen since={phase.since} onLeave={() => cancelRejoin(phase.roomId)} />;
  if (phase.name === 'outcome') return <OutcomeScreen phase={phase} canRejoin={!!liveRoom && phase.kind !== 'removed' && phase.kind !== 'denied'} onRejoin={() => setPhase({ name: 'prejoin' })} />;

  const settingsDialog = (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-primary">Camera, microphone &amp; speaker</DialogTitle>
          <DialogDescription>Changes apply at once and are remembered on this device.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-xs text-text-muted">
            <Mic className="h-4 w-4" />
            <MicMeter track={media.audioTrack} enabled={media.micOn} />
          </div>
          <DeviceSelects media={media} />
        </div>
      </DialogContent>
    </Dialog>
  );

  if (phase.name === 'in-call' && self.current) {
    return (
      <>
        <CallStage
          session={session}
          room={room}
          selfPid={self.current.pid}
          selfRole={self.current.role}
          media={media}
          peers={peers}
          speaking={speaking}
          chat={chat}
          unread={unread}
          panel={panel}
          setPanel={setPanel}
          screenStream={screenStream}
          canShare={canShareScreen()}
          recordingHere={recordingHere}
          streamReconnecting={streamReconnecting}
          floorPrompt={floorPrompt}
          onDismissFloorPrompt={() => setFloorPrompt(false)}
          act={act}
          onSendChat={sendChat}
          onToggleShare={() => void toggleShare()}
          onToggleRecording={() => void toggleRecording()}
          onOpenSettings={() => setSettingsOpen(true)}
          onLeave={() => void onLeaveClick()}
          fullscreen={fullscreen.state}
        />
        {settingsDialog}
        <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-primary">Leave or end the e-session?</DialogTitle>
              <DialogDescription>Leaving keeps the e-session going for everyone else; another host can still end it. Ending closes it for everyone.</DialogDescription>
            </DialogHeader>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="h-12"
                onClick={() => {
                  setLeaveOpen(false);
                  void leave();
                }}
              >
                Leave the e-session
              </Button>
              <Button className="h-12 bg-[#c62828] hover:bg-[#b71c1c] hover:opacity-100" onClick={() => void endForEveryone()}>
                End for everyone
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <PreJoin
        account={account}
        session={session}
        role={myRole}
        media={media}
        liveRoom={liveRoom ?? null}
        lobbyReady={lobbyStatus === 'live'}
        phase={phase}
        onJoin={(startFirst) => void join(startFirst)}
        onCancelWaiting={() => {
          void act('leave');
          teardown();
          self.current = null;
          setPhase({ name: 'prejoin' });
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        onBack={() => navigate('/es')}
      />
      {settingsDialog}
    </>
  );
}

function SimpleScreen({ title, icon: Icon, children }: { title: string; icon: typeof Video; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <Icon className="h-12 w-12 text-primary/40" />
      <h1 className="text-xl font-bold text-text-main">{title}</h1>
      <p className="max-w-md text-sm text-text-muted">{children}</p>
      <Link to="/es" className="mt-2 inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-white hover:opacity-90">
        <ArrowLeft className="h-4 w-4" />
        Back to sessions
      </Link>
    </div>
  );
}

const OUTCOME_TEXT: Record<Outcome, (by?: string | null) => { title: string; body: string }> = {
  left: () => ({ title: 'You left the e-session', body: 'The time you left has been recorded. You can rejoin while it is still going.' }),
  ended: (by) => ({ title: 'The e-session has ended', body: by ? `${by} ended the e-session. Its record is in History.` : 'The e-session was closed. Its record is in History.' }),
  removed: (by) => ({ title: 'You were removed from the e-session', body: `${by ?? 'A host'} removed you. Contact the SB Secretariat if this was a mistake.` }),
  denied: (by) => ({ title: 'You were not admitted', body: `${by ?? 'The host'} did not let you in. Contact the SB Secretariat if you should be in this e-session.` }),
  replaced: () => ({ title: 'You joined from another device', body: 'This device left the e-session because you joined it again somewhere else.' }),
  lost: () => ({ title: 'Connection to the e-session was lost', body: 'This device was away too long or the LIMS server restarted. Rejoin to continue.' }),
};

function RejoiningScreen({ since, onLeave }: { since: number; onLeave: () => void }) {
  const now = useNow(1000);
  const online = useOnline();
  return (
    <div data-fixed-dark className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-[#0a0f3d] via-[#1a237e] to-[#283593] px-6 text-center text-white" role="status" aria-live="polite">
      <Loader2 className="h-12 w-12 animate-spin text-[#e8c766] motion-reduce:animate-none" />
      <h1 className="mt-5 text-2xl font-bold">Reconnecting to the e-session…</h1>
      <p className="mt-2 max-w-md text-sm text-white/75">
        {online ? 'Getting you back in.' : 'This device is offline. You will be back in as soon as the connection returns.'} There is no need to ask to join again.
      </p>
      <p className="mt-3 font-mono text-xs tabular-nums text-white/55">Trying for {elapsedClock(now - since)}</p>
      <button type="button" onClick={onLeave} className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-white/15 px-6 text-sm font-bold text-white hover:bg-white/25">
        Leave the e-session
      </button>
    </div>
  );
}

/** Whether the browser thinks it has a network connection. */
function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

function OutcomeScreen({ phase, canRejoin, onRejoin }: { phase: Extract<Phase, { name: 'outcome' }>; canRejoin: boolean; onRejoin: () => void }) {
  const text = OUTCOME_TEXT[phase.kind](phase.by);
  return (
    <div data-fixed-dark className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-[#0a0f3d] via-[#1a237e] to-[#283593] px-6 text-center text-white">
      <img src="/lims-logo.svg" alt="" className="h-16 w-16" />
      <h1 className="mt-5 text-2xl font-bold">{text.title}</h1>
      <p className="mt-2 max-w-md text-sm text-white/75">{text.body}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {canRejoin ? (
          <button type="button" onClick={onRejoin} className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#d4a72c] px-6 text-sm font-bold text-[#141b66] hover:bg-[#e0b743]">
            <RotateCcw className="h-4 w-4" />
            Rejoin
          </button>
        ) : null}
        {phase.roomId && (phase.kind === 'ended' || phase.kind === 'left') ? (
          <Link to={`/es/history/${phase.roomId}`} className="inline-flex h-12 items-center gap-2 rounded-lg bg-white/15 px-6 text-sm font-bold text-white hover:bg-white/25">
            <ClipboardList className="h-4 w-4" />
            View the record
          </Link>
        ) : null}
        <Link to="/es" className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-sm font-bold text-[#141b66] hover:bg-white/90">
          Back to sessions
        </Link>
      </div>
    </div>
  );
}

function PreJoin({
  account,
  session,
  role,
  media,
  liveRoom,
  lobbyReady,
  phase,
  onJoin,
  onCancelWaiting,
  onOpenSettings,
  onBack,
}: {
  account: MobileAccount;
  session: Session;
  role: RoomRole;
  media: LocalMedia;
  liveRoom: RoomSummary | null;
  lobbyReady: boolean;
  phase: Phase;
  onJoin: (startFirst: boolean) => void;
  onCancelWaiting: () => void;
  onOpenSettings: () => void;
  onBack: () => void;
}) {
  const waiting = phase.name === 'waiting';
  const joining = phase.name === 'joining';
  const roleLabel = roleLabelFor(role, session);
  const willWait = role === 'participant';

  let action: ReactNode;
  if (waiting) {
    action = (
      <Button variant="outline" onClick={onCancelWaiting} className="h-12 w-full bg-white text-base font-semibold">
        Stop waiting
      </Button>
    );
  } else if (liveRoom) {
    action = (
      <Button onClick={() => onJoin(false)} disabled={joining} className="h-14 w-full bg-red-600 text-base font-bold hover:bg-red-700 hover:opacity-100">
        {joining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Video className="mr-2 h-5 w-5" />}
        {joining ? 'Joining…' : willWait && !liveRoom.locked ? 'Ask to join' : 'Join now'}
      </Button>
    );
  } else if (account.canManage) {
    action = (
      <Button onClick={() => onJoin(true)} disabled={joining || !lobbyReady} className="h-14 w-full text-base font-bold">
        {joining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5 fill-current" />}
        {joining ? 'Starting…' : 'Start e-session'}
      </Button>
    );
  } else {
    action = (
      <Button disabled className="h-14 w-full text-base font-semibold">
        <Hourglass className="mr-2 h-5 w-5" />
        Waiting for the Secretariat to start
      </Button>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] md:px-8">
          <button type="button" onClick={onBack} className="inline-flex h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
            Sessions
          </button>
          <span className="ml-auto truncate text-sm text-text-muted">Signed in as {account.name}</span>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6 md:px-8 lg:grid-cols-[1.45fr_1fr]">
        <section className="space-y-4">
          <InsecureNotice />
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#0b1020] shadow-lg">
            {media.camOn && media.videoTrack ? (
              <VideoView stream={media.stream} mirrored />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-white/70">
                <span className={cn('flex h-24 w-24 items-center justify-center rounded-full text-2xl font-bold', account.group === 'member' ? 'bg-[#d4a72c] text-[#141b66]' : 'bg-[#3949ab] text-white')}>{account.abbr}</span>
                <span className="text-sm">{media.ready ? 'Camera is off' : 'Starting camera…'}</span>
              </div>
            )}
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-xs text-white">
                {media.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />}
                <MicMeter track={media.audioTrack} enabled={media.micOn} dark />
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <PreJoinToggle on={media.micOn} onClick={() => media.setMicOn(!media.micOn)} onIcon={Mic} offIcon={MicOff} onLabel="Microphone on" offLabel="Microphone off" />
            <PreJoinToggle on={media.camOn} onClick={() => media.setCamOn(!media.camOn)} onIcon={Video} offIcon={VideoOff} onLabel="Camera on" offLabel="Camera off" />
            <button type="button" onClick={onOpenSettings} className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-white px-5 text-sm font-semibold text-text-main hover:bg-muted">
              <Settings className="h-4 w-4" />
              Devices
            </button>
          </div>
          {media.micError || media.camError ? (
            <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
              {media.micError ? <p>{media.micError}</p> : null}
              {media.camError && media.camError !== media.micError ? <p>{media.camError}</p> : null}
              <p className="text-xs text-amber-800">You can still join to listen and watch.</p>
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-center gap-1.5">
              {liveRoom ? <LiveBadge since={liveRoom.startedAt} /> : null}
              <TypeBadge type={session.type} />
              <RoleBadge role={role} label={role === 'participant' ? (account.group === 'member' ? 'Member' : 'Staff') : roleLabel} />
            </div>
            <h1 className="mt-3 text-xl font-bold text-text-main">{session.title}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-text-muted">
              <Clock className="h-4 w-4 shrink-0" />
              {formatLongDate(session.date)}, {session.time}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-text-muted">
              <MapPin className="h-4 w-4 shrink-0" />
              {session.location} · online
            </p>

            <div className="mt-5 rounded-xl bg-muted/70 p-4 text-sm">
              {waiting ? (
                <p className="flex items-start gap-3 text-text-main">
                  <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
                  <span>
                    <span className="block font-semibold">Waiting for the host to let you in</span>
                    <span className="text-text-muted">The Secretariat has been told you are here.</span>
                  </span>
                </p>
              ) : liveRoom ? (
                <ul className="space-y-1.5 text-text-muted">
                  <li>
                    <span className="font-semibold text-text-main">{liveRoom.participantCount}</span> in the e-session, started by {liveRoom.startedBy.name}
                  </li>
                  {liveRoom.recording ? <li className="font-semibold text-red-700">This e-session is being recorded.</li> : null}
                  {liveRoom.locked && willWait ? <li className="font-semibold text-amber-800">The host has locked the e-session.</li> : null}
                  {willWait && !liveRoom.locked ? <li>A host admits you after you ask to join.</li> : null}
                </ul>
              ) : (
                <p className="text-text-muted">
                  {account.canManage
                    ? 'Starting opens the e-session to everyone invited. You can admit them, record, and end it.'
                    : 'Not started yet. This page updates by itself when the Secretariat starts it; check your camera and microphone meanwhile.'}
                </p>
              )}
            </div>

            <div className="mt-5">{action}</div>
            <p className="mt-3 text-center text-xs text-text-muted">Your joining and leaving times are recorded in the e-session’s audit trail.</p>
          </section>
        </aside>
      </main>
    </div>
  );
}

function PreJoinToggle({ on, onClick, onIcon: OnIcon, offIcon: OffIcon, onLabel, offLabel }: { on: boolean; onClick: () => void; onIcon: typeof Mic; offIcon: typeof Mic; onLabel: string; offLabel: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn('inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors', on ? 'border border-border bg-white text-text-main hover:bg-muted' : 'bg-red-600 text-white hover:bg-red-700')}
    >
      {on ? <OnIcon className="h-4 w-4" /> : <OffIcon className="h-4 w-4" />}
      {on ? onLabel : offLabel}
    </button>
  );
}
