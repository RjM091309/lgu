import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import {
  Check,
  ChevronUp,
  Circle,
  ClipboardCheck,
  Hand,
  LayoutGrid,
  ListOrdered,
  Loader2,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  Settings,
  Square,
  Users,
  Video,
  VideoOff,
  VolumeX,
  X,
  UserRoundCheck,
  RectangleHorizontal,
  Maximize,
  Minimize,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { confirmAction } from '@/components/ui/confirm';
import { useUsers } from '@/lib/access-store';
import { inviteesFor } from '@/lib/attendance';
import type { Session } from '@/lib/mock-data';
import { supportsSpeakerChoice, type PeerInfo } from '@/lib/esession-rtc';
import { elapsedClock, roleLabelFor, type ChatMessage, type Participant, type RollCall, type RoomRole, type RoomView } from '@/lib/esession-room';
import type { LocalMedia } from '@/components/esession-room/use-local-media';
import { RemoteAudio, VideoTile, type TileActions } from '@/components/esession-room/VideoTile';
import { AgendaPanel, ChatPanel, PeoplePanel } from '@/components/esession-room/CallPanels';
import { useNow } from '@/components/esession-room/es-ui';
import { PeopleFloat, ShareStage, useAutoHide } from '@/components/esession-room/PresentationStage';
import type { Fullscreen, FullscreenNotice } from '@/components/esession-room/use-fullscreen';

export type Panel = 'people' | 'chat' | 'agenda';
type Layout = 'auto' | 'gallery' | 'speaker';
type Act = (type: string, payload?: Record<string, unknown>) => Promise<boolean>;

const GAP = 8;

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, ...size };
}

/**
 * `value`, but only once it has held for `onMs` (to turn on) or `offMs` (to turn off), so a signal that flickers
 * around a threshold doesn't make the screen flicker with it.
 */
function useSteady(value: boolean, onMs: number, offMs: number) {
  const [steady, setSteady] = useState(value);
  useEffect(() => {
    if (value === steady) return;
    const timer = window.setTimeout(() => setSteady(value), value ? onMs : offMs);
    return () => window.clearTimeout(timer);
  }, [value, steady, onMs, offMs]);
  return steady;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Columns and tile size that make the tiles as large as possible in the space available. */
const fitGrid = (count: number, width: number, height: number, aspect: number) => {
  let best = { cols: 1, width: 0, height: 0 };
  for (let cols = 1; cols <= Math.max(1, count); cols += 1) {
    const rows = Math.ceil(count / cols);
    let w = (width - GAP * (cols - 1)) / cols;
    let h = w / aspect;
    if (h * rows + GAP * (rows - 1) > height) {
      h = (height - GAP * (rows - 1)) / rows;
      w = h * aspect;
    }
    if (w * h > best.width * best.height) best = { cols, width: Math.floor(w), height: Math.floor(h) };
  }
  return best;
};

/** A tile narrower than this gets hard to read, so the gallery scrolls instead (phones in a full sitting). */
const MIN_TILE_WIDTH = 150;

export interface CallStageProps {
  session: Session | undefined;
  room: RoomView | null;
  selfPid: string;
  selfRole: RoomRole;
  media: LocalMedia;
  peers: Map<string, PeerInfo>;
  speaking: Set<string>;
  chat: ChatMessage[];
  unread: number;
  panel: Panel | null;
  setPanel: (panel: Panel | null) => void;
  screenStream: MediaStream | null;
  canShare: boolean;
  recordingHere: boolean;
  streamReconnecting: boolean;
  floorPrompt: boolean;
  onDismissFloorPrompt: () => void;
  act: Act;
  onSendChat: (text: string) => Promise<boolean>;
  onToggleShare: () => void;
  onToggleRecording: () => void;
  onOpenSettings: () => void;
  onLeave: () => void;
  fullscreen: Fullscreen;
}

export function CallStage(props: CallStageProps) {
  const { room, selfPid, selfRole, media, peers, speaking, panel, setPanel, act, session } = props;
  const isWide = useMediaQuery('(min-width: 1024px)');
  const [layout, setLayout] = useState<Layout>('auto');
  // Pinned by account, so the pin survives that person reconnecting (which gives them a new pid).
  const [pinned, setPinned] = useState<string | null>(null);
  const area = useElementSize<HTMLDivElement>();
  const topBars = useElementSize<HTMLDivElement>();
  const bottomBar = useElementSize<HTMLDivElement>();
  const moderator = selfRole !== 'participant';
  const isHost = selfRole === 'host';

  const participants = room?.participantsList ?? [];
  const me = participants.find((p) => p.pid === selfPid);
  const sharer = participants.find((p) => p.screen);
  const floorHolder = participants.find((p) => p.pid === room?.floor);
  const pinnedPerson = participants.find((p) => p.inviteeId === pinned);
  // A new screen share or a new floor holder brings everyone back to the automatic view, even after picking one by hand.
  const sharerId = sharer?.inviteeId ?? null;
  const floorId = floorHolder?.inviteeId ?? null;
  useEffect(() => {
    if (sharerId) setLayout('auto');
  }, [sharerId]);
  useEffect(() => {
    if (floorId) setLayout('auto');
  }, [floorId]);
  // Most recent speaker other than me, for the speaker view when nobody has the floor.
  const lastSpeaker = useRef<string | null>(null);
  const loudOther = [...speaking].find((pid) => pid !== selfPid && participants.some((p) => p.pid === pid));
  if (loudOther) lastSpeaker.current = loudOther;
  // Who takes the stage: my own pin, then a screen share, then the floor. Someone sharing or holding the floor sees
  // the next one down (or the last speaker, or the presiding officer) instead of themselves; a pin on myself is honoured.
  const spotlight = pinnedPerson ?? sharer ?? floorHolder ?? null;
  const mode: 'gallery' | 'speaker' = layout === 'auto' ? (spotlight && participants.length > 1 ? 'speaker' : 'gallery') : layout;
  const shown = pinnedPerson ?? [sharer, floorHolder].find((p) => p && p.pid !== selfPid) ?? null;
  const main =
    mode === 'speaker'
      ? (shown ??
        participants.find((p) => p.pid === lastSpeaker.current) ??
        participants.find((p) => p.role === 'presiding' && p.pid !== selfPid) ??
        participants.find((p) => p.pid !== selfPid) ??
        me ??
        null)
      : null;
  // What my pin keeps off the stage, so I can tell and switch back.
  const hiddenByPin = pinnedPerson ? [sharer, floorHolder].find((p) => p && p.pid !== selfPid && p.pid !== pinnedPerson.pid) : undefined;
  // Pinned first, then the screen share and the floor, then everyone in joining order.
  const rank = (p: Participant) => (p === pinnedPerson ? 0 : p === sharer ? 1 : p === floorHolder ? 2 : 3);
  const ordered = [...participants].sort((a, b) => rank(a) - rank(b));

  // Presentation layout: someone else's screen share is on my stage, so it fills the screen, the others float in a
  // corner, and the bars hide while idle. The presenter keeps the normal layout with a "you are sharing" tile.
  const presenting = mode === 'speaker' && !!main && main.screen && main.pid !== selfPid;
  const floatPeople = presenting ? ordered.filter((p) => p.pid !== main.pid) : [];
  const floatFocus =
    floatPeople.find((p) => p.pid === room?.floor) ??
    floatPeople.find((p) => p.pid === lastSpeaker.current) ??
    floatPeople.find((p) => p.role === 'presiding' && p.pid !== selfPid) ??
    floatPeople.find((p) => p.pid !== selfPid);

  // Invitees who are neither in the e-session nor waiting to be admitted. The room's own invitee list decides who
  // counts; names and positions come from the session's invitation list, as in the lobby.
  const users = useUsers();
  const notHere = (() => {
    if (!room || !session) return [];
    const invited = new Set(room.invitees);
    const present = new Set([...participants, ...room.waitingList].map((p) => p.inviteeId));
    return inviteesFor(session, users).filter((invitee) => invited.has(invitee.id) && !present.has(invitee.id));
  })();

  // Calling the roll is one tap and is kept in the record for good, so it asks first.
  const membersPresent = participants.filter((p) => p.group === 'member').length;
  const callRoll = async () => {
    const confirmed = await confirmAction({
      title: 'Call the roll now?',
      description: `${membersPresent} of ${room?.memberTotal ?? 0} members are in the e-session. The result is kept in the e-session's record and shown to everyone.`,
      confirmLabel: 'Call the roll',
    });
    if (confirmed) void act('roll-call');
  };

  // Everyone hears about a new roll call for 20 seconds. Roll calls from before I joined stay in the People panel.
  const latestCall = room?.rollCalls.at(-1) ?? null;
  const seenCallAt = useRef<number | null>(null);
  const [callNotice, setCallNotice] = useState<RollCall | null>(null);
  useEffect(() => {
    if (!room) return;
    const at = latestCall?.at ?? 0;
    if (seenCallAt.current === null) seenCallAt.current = at;
    else if (latestCall && at > seenCallAt.current) {
      seenCallAt.current = at;
      setCallNotice(latestCall);
    }
  }, [room, latestCall]);
  useEffect(() => {
    if (!callNotice) return;
    const timer = window.setTimeout(() => setCallNotice(null), 20_000);
    return () => window.clearTimeout(timer);
  }, [callNotice]);
  const showRollCallDetails = () => {
    setCallNotice(null);
    setPanel('people');
    window.setTimeout(() => document.getElementById('es-roll-call')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const roleLabelOf = (p: Participant) => (p.role === 'participant' ? null : session ? roleLabelFor(p.role, session) : p.role === 'host' ? 'Host' : 'Presiding Officer');
  const streamOf = (p: Participant) => (p.pid === selfPid ? (props.screenStream ?? media.stream) : (peers.get(p.pid)?.stream ?? null));

  const actionsFor = (p: Participant): TileActions => {
    const isSelf = p.pid === selfPid;
    return {
      onPin:
        participants.length > 1
          ? () => {
              if (pinned === p.inviteeId) setPinned(null);
              else {
                setPinned(p.inviteeId);
                setLayout('auto');
              }
            }
          : undefined,
      pinned: pinned === p.inviteeId,
      onFloor: moderator ? () => void act('floor', { target: room?.floor === p.pid ? null : p.pid }) : undefined,
      onMute: moderator && !isSelf && p.audio ? () => void act('mute', { target: p.pid }) : undefined,
      onRemove:
        isHost && !isSelf
          ? async () => {
              const confirmed = await confirmAction({
                title: `Remove ${p.name}?`,
                description: 'They leave the e-session at once and cannot rejoin it. This is recorded in the audit trail.',
                confirmLabel: 'Remove',
                tone: 'destructive',
              });
              if (confirmed) void act('remove', { target: p.pid });
            }
          : undefined,
    };
  };

  const tile = (p: Participant, className: string, style?: CSSProperties, large = false) => {
    const peer = peers.get(p.pid);
    return (
      <div key={p.pid} className={className} style={style}>
        <VideoTile
          participant={p}
          stream={streamOf(p)}
          isSelf={p.pid === selfPid}
          speaking={speaking.has(p.pid)}
          hasFloor={room?.floor === p.pid}
          link={peer?.link ?? (p.pid === selfPid ? null : 'connecting')}
          quality={peer?.quality ?? null}
          roleLabel={roleLabelOf(p)}
          actions={actionsFor(p)}
          large={large}
          presenter={p.pid === selfPid && p.screen ? { onStop: props.onToggleShare } : undefined}
          className="h-full w-full"
        />
      </div>
    );
  };

  // Gallery sizing: wider tiles in landscape, taller ones in portrait.
  const portrait = area.height > area.width;
  const grid = fitGrid(participants.length, area.width, area.height, portrait ? 4 / 3 : 16 / 9);
  const scrollGallery = grid.width > 0 && grid.width < MIN_TILE_WIDTH;
  const scrollCols = Math.max(2, Math.floor((area.width + GAP) / (MIN_TILE_WIDTH + GAP)));
  const scrollTile = { width: Math.floor((area.width - GAP * (scrollCols - 1)) / scrollCols), height: Math.floor((area.width - GAP * (scrollCols - 1)) / scrollCols / (4 / 3)) };

  const waitingCount = isHost ? (room?.waitingList.length ?? 0) : 0;
  const othersPoor = [...peers.values()].filter((peer) => peer.quality === 'poor').length;
  const poorConnection = peers.size > 0 && othersPoor >= Math.max(1, Math.ceil(peers.size / 2));

  // Connection warnings wait out brief dips: unstable after 5 s of poor quality (clear after 10 s of good), and
  // reconnecting after 2 s. A dismissed warning stays away until the connection has recovered.
  const unstable = useSteady(poorConnection, 5000, 10_000);
  const [unstableDismissed, setUnstableDismissed] = useState(false);
  useEffect(() => {
    if (!unstable) setUnstableDismissed(false);
  }, [unstable]);
  const reconnecting = useSteady(props.streamReconnecting, 2000, 0);
  // Only an open panel keeps the bars up; banners show on their own, over the share if the bars are hidden.
  const bars = useAutoHide(presenting, !!panel);
  // While presenting the bars float over the share, so things placed on the stage keep clear of them.
  const insetTop = presenting && bars.visible ? topBars.height : 0;
  const insetBottom = presenting && bars.visible ? bottomBar.height : 0;
  const barSlide = (edge: 'top' | 'bottom') =>
    presenting ? cn('absolute inset-x-0 z-30 transition-transform duration-300', edge === 'top' ? 'top-0' : 'bottom-0', !bars.visible && (edge === 'top' ? '-translate-y-full' : 'translate-y-full')) : undefined;

  const panelBody =
    room && panel ? (
      panel === 'people' ? (
        <PeoplePanel room={room} selfPid={selfPid} selfRole={selfRole} qualities={new Map([...peers].map(([pid, peer]) => [pid, peer.quality]))} roleLabelOf={roleLabelOf} act={act} onCallRoll={() => void callRoll()} notHere={notHere} />
      ) : panel === 'chat' ? (
        <ChatPanel messages={props.chat} selfPid={selfPid} onSend={props.onSendChat} />
      ) : (
        <AgendaPanel room={room} canControl={moderator} act={act} />
      )
    ) : null;

  return (
    <div data-fixed-dark className={cn('fixed inset-0 z-40 flex flex-col text-white', presenting ? 'bg-black' : 'bg-[#070b1f]')}>
      <div ref={topBars.ref} className={barSlide('top')} {...(presenting ? bars.barProps : {})}>
      <TopBar {...props} membersPresent={membersPresent} mode={mode} onToggleLayout={() => setLayout(mode === 'gallery' ? 'speaker' : 'gallery')} />

      {room && room.agenda.length ? (
        <button
          type="button"
          onClick={() => setPanel(panel === 'agenda' ? null : 'agenda')}
          className="flex min-h-9 w-full items-center gap-2 border-b border-white/10 bg-[#0c1230] px-3 text-left text-xs text-white/80 hover:bg-[#111a40] sm:px-4"
        >
          <ListOrdered className="h-3.5 w-3.5 shrink-0 text-[#e8c766]" />
          <span className="shrink-0 font-semibold text-[#e8c766]">Now:</span>
          <span className="truncate">
            {room.agendaIndex + 1}. {room.agenda[room.agendaIndex]}
          </span>
        </button>
      ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1">
        <main className={cn('relative flex min-w-0 flex-1 flex-col', presenting ? 'p-0' : 'p-2 sm:p-3')}>
          {/* Banners */}
          <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex flex-col items-center gap-2 transition-[margin] duration-300 sm:inset-x-3 sm:top-3" style={{ marginTop: insetTop }}>
            {reconnecting ? <Banner tone="danger">Reconnecting to LIMS… audio and video keep going meanwhile.</Banner> : null}
            {props.floorPrompt ? (
              <Banner tone="gold" onClose={props.onDismissFloorPrompt}>
                <span className="font-semibold">You have the floor.</span>
                {media.micOn ? null : (
                  <button
                    type="button"
                    onClick={() => {
                      media.setMicOn(true);
                      props.onDismissFloorPrompt();
                    }}
                    className="pointer-events-auto ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#141b66] px-3 text-xs font-bold text-white"
                  >
                    <Mic className="h-4 w-4" />
                    Unmute to speak
                  </button>
                )}
              </Banner>
            ) : null}
            {callNotice ? (
              <Banner tone={callNotice.hasQuorum ? 'success' : 'warning'} onClose={() => setCallNotice(null)}>
                <ClipboardCheck className="mr-2 h-4 w-4 shrink-0" />
                <span>
                  <span className="font-semibold">{callNotice.by.inviteeId === me?.inviteeId ? 'You called the roll' : `Roll call by ${callNotice.by.name}`}:</span> {callNotice.presentCount} of {callNotice.memberTotal} members present.{' '}
                  {callNotice.hasQuorum ? 'Quorum declared.' : `No quorum (${callNotice.quorum} needed).`}
                </span>
                <button type="button" onClick={showRollCallDetails} className="pointer-events-auto ml-2 inline-flex h-9 items-center rounded-lg bg-white/15 px-3 text-xs font-bold text-white hover:bg-white/25">
                  Details
                </button>
              </Banner>
            ) : null}
            {waitingCount ? (
              <Banner tone="info">
                <span>
                  <span className="font-semibold">{room?.waitingList[0]?.name}</span>
                  {waitingCount > 1 ? ` and ${waitingCount - 1} more` : ''} {waitingCount > 1 ? 'are' : 'is'} waiting to join.
                </span>
                {waitingCount === 1 ? (
                  <button type="button" onClick={() => void act('admit', { target: room?.waitingList[0]?.pid })} className="pointer-events-auto ml-2 inline-flex h-9 items-center rounded-lg bg-[#d4a72c] px-3 text-xs font-bold text-[#141b66]">
                    Admit
                  </button>
                ) : null}
                <button type="button" onClick={() => setPanel('people')} className="pointer-events-auto ml-1 inline-flex h-9 items-center rounded-lg bg-white/15 px-3 text-xs font-bold text-white">
                  Review
                </button>
              </Banner>
            ) : null}
            {mode === 'speaker' && hiddenByPin ? (
              <Banner tone="info">
                <span>
                  <span className="font-semibold">{hiddenByPin.name}</span> {hiddenByPin.screen ? 'is sharing a screen' : 'has the floor'}. You pinned {pinnedPerson?.pid === selfPid ? 'yourself' : pinnedPerson?.name}.
                </span>
                <button type="button" onClick={() => setPinned(null)} className="pointer-events-auto ml-2 inline-flex h-9 items-center rounded-lg bg-white/15 px-3 text-xs font-bold text-white">
                  Unpin
                </button>
              </Banner>
            ) : null}
            {props.fullscreen.notice ? (
              <Banner tone="info" onClose={props.fullscreen.dismissNotice}>
                <span>{FULLSCREEN_NOTICE[props.fullscreen.notice].text}</span>
                <button type="button" onClick={props.fullscreen.enter} className="pointer-events-auto ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-xs font-bold text-white">
                  <Maximize className="h-4 w-4" />
                  {FULLSCREEN_NOTICE[props.fullscreen.notice].action}
                </button>
              </Banner>
            ) : null}
            {unstable && !unstableDismissed ? (
              <Banner tone="warning" onClose={() => setUnstableDismissed(true)}>
                Your connection is unstable.
                {media.camOn ? (
                  <button type="button" onClick={() => media.setCamOn(false)} className="pointer-events-auto ml-2 inline-flex h-9 items-center rounded-lg bg-white/15 px-3 text-xs font-bold text-white">
                    Turn off camera
                  </button>
                ) : null}
              </Banner>
            ) : null}
          </div>

          <div ref={area.ref} className={cn('relative min-h-0 flex-1', mode === 'gallery' && scrollGallery && 'overflow-y-auto')}>
            {!room ? (
              <div className="flex h-full items-center justify-center text-sm text-white/70">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Connecting to the e-session…
              </div>
            ) : presenting ? (
              <>
                <ShareStage key={main.pid} sharer={main} stream={streamOf(main)} chrome={bars.visible} insetTop={insetTop} insetBottom={insetBottom} />
                <PeopleFloat people={floatPeople} focus={floatFocus} renderTile={(p, className, style) => tile(p, className, style)} insetTop={insetTop} insetBottom={insetBottom} />
              </>
            ) : mode === 'gallery' ? (
              <div className={cn('flex flex-wrap justify-center gap-2', scrollGallery ? 'content-start' : 'h-full content-center')}>
                {ordered.map((p) => tile(p, 'shrink-0', scrollGallery ? scrollTile : { width: grid.width, height: grid.height }))}
              </div>
            ) : main ? (
              <div className={cn('flex h-full gap-2', portrait ? 'flex-col' : 'flex-row')}>
                {tile(main, 'min-h-0 min-w-0 flex-1', undefined, true)}
                {participants.length > 1 ? (
                  <div className={cn('flex shrink-0 gap-2', portrait ? 'h-28 flex-row overflow-x-auto sm:h-32' : 'w-[clamp(150px,20%,240px)] flex-col overflow-y-auto')}>
                    {ordered.filter((p) => p.pid !== main.pid).map((p) => tile(p, cn('shrink-0', portrait ? 'h-full w-40 sm:w-48' : 'aspect-video w-full')))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </main>

        {panel && isWide ? (
          <aside
            className={cn('flex w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#0c1230]', presenting && 'absolute right-0 z-20 shadow-2xl')}
            style={presenting ? { top: insetTop, bottom: insetBottom } : undefined}
          >
            <PanelHeader panel={panel} setPanel={setPanel} people={participants.length} unread={props.unread} waiting={waitingCount} />
            <div className="min-h-0 flex-1 overflow-y-auto">{panelBody}</div>
          </aside>
        ) : null}
      </div>

      <div ref={bottomBar.ref} className={barSlide('bottom')} {...(presenting ? bars.barProps : {})}>
        <ControlBar {...props} waitingCount={waitingCount} me={me} mode={mode} onLayout={(next) => setLayout(next)} onCallRoll={() => void callRoll()} />
      </div>

      {panel && !isWide ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close panel" onClick={() => setPanel(null)} />
          <div className="relative flex h-[78dvh] flex-col rounded-t-2xl bg-[#0c1230] shadow-2xl ring-1 ring-white/10" role="dialog" aria-modal="true">
            <span className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/25" aria-hidden />
            <PanelHeader panel={panel} setPanel={setPanel} people={participants.length} unread={props.unread} waiting={waitingCount} />
            <div className="min-h-0 flex-1 overflow-y-auto">{panelBody}</div>
          </div>
        </div>
      ) : null}

      {/* Everyone's sound plays from here, so it keeps going whichever tiles are on screen. */}
      <div className="hidden" aria-hidden>
        {[...peers].map(([pid, peer]) => (
          <RemoteAudio key={pid} stream={peer.stream} speakerId={media.speakerId} />
        ))}
      </div>
    </div>
  );
}

const FULLSCREEN_NOTICE: Record<FullscreenNotice, { text: string; action: string }> = {
  arrived: { text: 'Full screen hides the browser bars, so the call gets the whole screen.', action: 'Go full screen' },
  left: { text: 'You left full screen.', action: 'Return to full screen' },
};

function Banner({ tone, children, onClose }: { tone: 'info' | 'gold' | 'warning' | 'danger' | 'success'; children: ReactNode; onClose?: () => void }) {
  return (
    <div
      className={cn(
        'pointer-events-auto flex max-w-full flex-wrap items-center gap-y-1 rounded-xl px-4 py-2 text-sm shadow-xl ring-1',
        tone === 'gold' ? 'bg-[#d4a72c] text-[#141b66] ring-[#e8c766]' : tone === 'success' ? 'bg-[#14532d] text-white ring-green-400/40' : tone === 'danger' ? 'bg-red-700 text-white ring-red-400/50' : tone === 'warning' ? 'bg-[#5c4300] text-[#fde68a] ring-amber-400/40' : 'bg-[#1b2453] text-white ring-white/15'
      )}
      role="status"
      data-no-wake
    >
      {children}
      {onClose ? (
        <button type="button" onClick={onClose} className="-mr-2 ml-2 flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/10" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function TopBar({
  room,
  session,
  recordingHere,
  membersPresent,
  mode,
  onToggleLayout,
  fullscreen,
}: CallStageProps & { membersPresent: number; mode: 'gallery' | 'speaker'; onToggleLayout: () => void }) {
  const now = useNow(1000);
  const quorumMet = room ? membersPresent >= room.quorum : false;
  return (
    <header className="flex min-h-14 items-center gap-2 border-b border-white/10 bg-[#0a0f2b] px-3 pt-[env(safe-area-inset-top)] sm:gap-3 sm:px-4">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden />
        Live
        <span className="font-mono tabular-nums">{room ? elapsedClock(now - room.startedAt) : '--:--'}</span>
      </span>
      {room?.recordingBy ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-300 ring-1 ring-inset ring-red-400/40" title={`Recorded by ${room.recordingBy.name}`}>
          <Circle className="h-2.5 w-2.5 animate-pulse fill-red-500 text-red-500 motion-reduce:animate-none" />
          {recordingHere ? 'Recording' : 'Rec'}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{room?.title ?? session?.title ?? 'E-Session'}</p>
        <p className="hidden truncate text-[11px] text-white/60 sm:block">{room ? `${room.type} · started by ${room.startedBy.name}` : 'Connecting…'}</p>
      </div>
      {room ? (
        <span
          className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset', quorumMet ? 'bg-green-500/15 text-green-300 ring-green-400/30' : 'bg-amber-400/15 text-amber-200 ring-amber-400/30')}
          title={`Quorum: ${room.quorum} of ${room.memberTotal} members`}
        >
          <UserRoundCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{quorumMet ? 'Quorum' : 'No quorum'} ·</span> {membersPresent}/{room.memberTotal}
        </span>
      ) : null}
      {room?.locked ? <Lock className="h-4 w-4 shrink-0 text-white/70" aria-label="Locked" /> : null}
      <button
        type="button"
        onClick={onToggleLayout}
        className="hidden h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-white/80 hover:bg-white/10 sm:inline-flex"
        aria-label={mode === 'gallery' ? 'Switch to speaker view' : 'Switch to gallery view'}
      >
        {mode === 'gallery' ? <RectangleHorizontal className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
        {mode === 'gallery' ? 'Speaker view' : 'Gallery view'}
      </button>
      {fullscreen.supported ? (
        <button
          type="button"
          onClick={fullscreen.toggle}
          className="hidden h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-white/80 hover:bg-white/10 sm:inline-flex"
          aria-pressed={fullscreen.active}
        >
          {fullscreen.active ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          {fullscreen.active ? 'Exit full screen' : 'Full screen'}
        </button>
      ) : null}
    </header>
  );
}

function PanelHeader({ panel, setPanel, people, unread, waiting }: { panel: Panel; setPanel: (panel: Panel | null) => void; people: number; unread: number; waiting: number }) {
  const tabs: { id: Panel; label: string; badge?: number; count?: number }[] = [
    { id: 'people', label: 'People', count: people, badge: waiting },
    { id: 'chat', label: 'Chat', badge: unread },
    { id: 'agenda', label: 'Order of Business' },
  ];
  return (
    <div className="flex items-center gap-1 border-b border-white/10 px-2">
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={panel === tab.id}
            onClick={() => setPanel(tab.id)}
            className={cn('relative flex h-12 shrink-0 items-center gap-1.5 px-3 text-sm font-semibold', panel === tab.id ? 'text-white after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t after:bg-[#d4a72c]' : 'text-white/55 hover:text-white')}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="text-xs text-white/50">{tab.count}</span> : null}
            {tab.badge ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{tab.badge}</span> : null}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setPanel(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10" aria-label="Close panel">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const SHORTCUTS = {
  mic: IS_MAC ? '⌘D' : 'Ctrl+D',
  cam: IS_MAC ? '⌘E' : 'Ctrl+E',
  hand: IS_MAC ? '⌃⌘H' : 'Ctrl+Alt+H',
};

function ControlButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  tone = 'default',
  badge,
  className,
  pressed,
  ariaLabel,
  shortcut,
  buttonRef,
}: {
  icon: typeof Mic;
  label: string;
  onClick: () => void;
  active?: boolean;
  tone?: 'default' | 'off' | 'hand' | 'record';
  badge?: number;
  className?: string;
  pressed?: boolean;
  /** When the caption is not the full name (the recording timer). */
  ariaLabel?: string;
  shortcut?: string;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const name = ariaLabel ?? label;
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={name}
      aria-keyshortcuts={shortcut}
      title={shortcut ? `${name} (${shortcut})` : name}
      className={cn('group flex w-11 shrink-0 flex-col items-center gap-1 min-[480px]:w-12 sm:w-16', className)}
    >
      <span
        className={cn(
          'relative flex h-11 w-11 items-center justify-center rounded-full transition-colors min-[480px]:h-12 min-[480px]:w-12 sm:h-14 sm:w-14',
          tone === 'off'
            ? 'bg-red-600 text-white hover:bg-red-500'
            : tone === 'hand'
              ? 'bg-amber-400 text-[#3d2a00]'
              : tone === 'record'
                ? 'bg-red-600 text-white ring-4 ring-red-500/30 hover:bg-red-500 motion-safe:animate-pulse'
                : active
                  ? 'bg-white text-[#141b66]'
                  : 'bg-white/10 text-white group-hover:bg-white/20'
        )}
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        {badge ? <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-[#070b1f]">{badge > 9 ? '9+' : badge}</span> : null}
      </span>
      <span className={cn('max-w-full truncate text-[11px] font-medium text-white/80 max-[480px]:hidden', tone === 'record' && 'font-mono tabular-nums text-red-200')}>{label}</span>
    </button>
  );
}

type BarMenu = 'more' | 'mic' | 'cam';
/** A group separator: a 1px line with 4px margins either side (shown from the sm breakpoint). */
const SEPARATOR_WIDTH = 9;
type MenuItem = { key: string; icon: typeof Mic; label: string; onClick: () => void; small?: boolean; danger?: boolean; iconClass?: string };
type BarItem = { key: string; group: 0 | 1 | 2; priority: number; node: ReactNode; menu: MenuItem };

/** Quick device choice above the Mic or Camera button; the full settings stay one tap further. */
function DevicePicker({ kind, media, onOpenSettings, onClose }: { kind: 'mic' | 'cam'; media: LocalMedia; onOpenSettings: () => void; onClose: () => void }) {
  const sections =
    kind === 'cam'
      ? [{ title: 'Camera', list: media.devices.cams, value: media.camId, choose: media.chooseCam }]
      : [
          { title: 'Microphone', list: media.devices.mics, value: media.micId, choose: media.chooseMic },
          ...(supportsSpeakerChoice() && media.devices.speakers.length ? [{ title: 'Speaker', list: media.devices.speakers, value: media.speakerId, choose: media.chooseSpeaker }] : []),
        ];
  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-xl bg-[#121a3d] py-1 text-sm text-white shadow-2xl ring-1 ring-white/15" role="menu">
      {sections.map((section) => (
        <div key={section.title} className="border-b border-white/10 pb-1 last:border-0">
          <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">{section.title}</p>
          {[{ deviceId: '', label: 'Default' }, ...section.list.map((device, index) => ({ deviceId: device.deviceId, label: device.label || `${section.title} ${index + 1}` }))].map((device) => (
            <button
              key={device.deviceId || 'default'}
              type="button"
              role="menuitemradio"
              aria-checked={section.value === device.deviceId}
              onClick={() => {
                section.choose(device.deviceId);
                onClose();
              }}
              className="flex min-h-10 w-full items-center gap-3 px-4 text-left hover:bg-white/10"
            >
              <Check className={cn('h-4 w-4 shrink-0', section.value === device.deviceId ? 'text-[#e8c766]' : 'invisible')} />
              <span className="min-w-0 flex-1 truncate">{device.label}</span>
            </button>
          ))}
        </div>
      ))}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onOpenSettings();
        }}
        className="flex min-h-11 w-full items-center gap-3 border-t border-white/10 px-4 text-left hover:bg-white/10"
      >
        <Settings className="h-4 w-4" />
        All settings
      </button>
    </div>
  );
}

function ControlBar({
  media,
  me,
  room,
  selfRole,
  panel,
  setPanel,
  unread,
  waitingCount,
  screenStream,
  canShare,
  recordingHere,
  act,
  mode,
  onLayout,
  onToggleShare,
  onToggleRecording,
  onOpenSettings,
  onLeave,
  fullscreen,
  onCallRoll,
}: CallStageProps & { waitingCount: number; me: Participant | undefined; mode: 'gallery' | 'speaker'; onLayout: (layout: Layout) => void; onCallRoll: () => void }) {
  const [menu, setMenu] = useState<BarMenu | null>(null);
  const moderator = selfRole !== 'participant';
  const isHost = selfRole === 'host';
  const handUp = me?.hand !== null && me?.hand !== undefined;
  const sharing = screenStream !== null;
  const togglePanel = (next: Panel) => setPanel(panel === next ? null : next);
  const recordingBy = room?.recordingBy ?? null;
  const now = useNow(recordingBy ? 1000 : 60_000);
  const isSm = useMediaQuery('(min-width: 640px)');
  const toggleMenu = (next: BarMenu) => setMenu((open) => (open === next ? null : next));
  const toggleHand = () => void act('hand', { raised: !handUp });

  // An open menu closes on a tap outside it or on Escape.
  useEffect(() => {
    if (!menu) return;
    const onDown = (event: PointerEvent) => {
      if (!(event.target as Element).closest?.(`[data-bar-menu="${menu}"]`)) setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  // Keyboard shortcuts, as in Google Meet: mute, camera, raise hand.
  const shortcutRef = useRef({ mic: () => {}, cam: () => {}, hand: () => {} });
  shortcutRef.current = { mic: () => media.setMicOn(!media.micOn), cam: () => media.setCamOn(!media.camOn), hand: toggleHand };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.repeat) return;
      const chord = event.altKey || (IS_MAC && event.ctrlKey && event.metaKey);
      const action = chord ? (event.code === 'KeyH' ? 'hand' : null) : event.code === 'KeyD' ? 'mic' : event.code === 'KeyE' ? 'cam' : null;
      if (!action) return;
      event.preventDefault();
      shortcutRef.current[action]();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const recordLabel = recordingHere && recordingBy ? elapsedClock(now - recordingBy.since) : recordingBy ? 'Stop rec' : 'Record';
  const deviceCaret = (kind: 'mic' | 'cam') => (
    <button
      type="button"
      onClick={() => toggleMenu(kind)}
      className="absolute right-0 top-0 z-10 hidden h-6 w-6 items-center justify-center rounded-full bg-[#2a3366] text-white ring-2 ring-[#0a0f2b] hover:bg-[#3a4590] sm:flex"
      aria-label={kind === 'mic' ? 'Choose microphone and speaker' : 'Choose camera'}
      aria-expanded={menu === kind}
      aria-haspopup="menu"
    >
      <ChevronUp className="h-3.5 w-3.5" />
    </button>
  );

  // Everything that can sit on the bar, grouped (your devices | taking part | moderator tools). `priority` decides
  // what stays when space runs short: the rest moves into More, so the bar never runs into the screen edges.
  const items: BarItem[] = [
    {
      key: 'mic',
      group: 0,
      priority: 0,
      node: (
        <div key="mic" className="relative" data-bar-menu="mic">
          <ControlButton icon={media.micOn ? Mic : MicOff} label={media.micOn ? 'Mute' : 'Unmute'} tone={media.micOn ? 'default' : 'off'} onClick={() => media.setMicOn(!media.micOn)} pressed={!media.micOn} shortcut={SHORTCUTS.mic} />
          {deviceCaret('mic')}
          {menu === 'mic' ? <DevicePicker kind="mic" media={media} onOpenSettings={onOpenSettings} onClose={() => setMenu(null)} /> : null}
        </div>
      ),
      menu: { key: 'mic', icon: media.micOn ? Mic : MicOff, label: media.micOn ? 'Mute' : 'Unmute', onClick: () => media.setMicOn(!media.micOn) },
    },
    {
      key: 'cam',
      group: 0,
      priority: 1,
      node: (
        <div key="cam" className="relative" data-bar-menu="cam">
          <ControlButton icon={media.camOn ? Video : VideoOff} label={media.camOn ? 'Stop video' : 'Start video'} tone={media.camOn ? 'default' : 'off'} onClick={() => media.setCamOn(!media.camOn)} pressed={!media.camOn} shortcut={SHORTCUTS.cam} />
          {deviceCaret('cam')}
          {menu === 'cam' ? <DevicePicker kind="cam" media={media} onOpenSettings={onOpenSettings} onClose={() => setMenu(null)} /> : null}
        </div>
      ),
      menu: { key: 'cam', icon: media.camOn ? Video : VideoOff, label: media.camOn ? 'Stop video' : 'Start video', onClick: () => media.setCamOn(!media.camOn) },
    },
    ...(canShare
      ? [
          {
            key: 'share',
            group: 0 as const,
            priority: 6,
            node: <ControlButton key="share" icon={MonitorUp} label={sharing ? 'Stop share' : 'Share'} active={sharing} onClick={onToggleShare} pressed={sharing} />,
            menu: { key: 'share', icon: MonitorUp, label: sharing ? 'Stop sharing screen' : 'Share screen', onClick: onToggleShare },
          },
        ]
      : []),
    // Hosts and presiding officers rarely ask for the floor, so their Raise hand lives in More (and on the bar
    // while their hand is up, to lower it in one tap).
    ...(!moderator || handUp
      ? [
          {
            key: 'hand',
            group: 1 as const,
            priority: 5,
            node: <ControlButton key="hand" icon={Hand} label={handUp ? 'Lower hand' : 'Raise hand'} tone={handUp ? 'hand' : 'default'} onClick={toggleHand} pressed={handUp} shortcut={SHORTCUTS.hand} />,
            menu: { key: 'hand', icon: Hand, label: handUp ? 'Lower hand' : 'Raise hand', onClick: toggleHand },
          },
        ]
      : []),
    {
      key: 'people',
      group: 1,
      priority: 3,
      node: <ControlButton key="people" icon={Users} label="People" active={panel === 'people'} badge={waitingCount} onClick={() => togglePanel('people')} />,
      menu: { key: 'people', icon: Users, label: waitingCount ? `People (${waitingCount} waiting)` : 'People', onClick: () => togglePanel('people') },
    },
    {
      key: 'chat',
      group: 1,
      priority: 4,
      node: <ControlButton key="chat" icon={MessageSquare} label="Chat" active={panel === 'chat'} badge={panel === 'chat' ? 0 : unread} onClick={() => togglePanel('chat')} />,
      menu: { key: 'chat', icon: MessageSquare, label: unread && panel !== 'chat' ? `Chat (${unread} new)` : 'Chat', onClick: () => togglePanel('chat') },
    },
    {
      key: 'agenda',
      group: 1,
      priority: 8,
      node: <ControlButton key="agenda" icon={ListOrdered} label="Agenda" active={panel === 'agenda'} onClick={() => togglePanel('agenda')} />,
      menu: { key: 'agenda', icon: ListOrdered, label: 'Order of Business', onClick: () => togglePanel('agenda') },
    },
    ...(isHost
      ? [
          {
            key: 'record',
            group: 2 as const,
            priority: 2,
            node: (
              <ControlButton
                key="record"
                icon={recordingBy ? Square : Circle}
                label={recordLabel}
                ariaLabel={recordingHere && recordingBy ? `Stop recording (${recordLabel} recorded)` : recordingBy ? `Stop ${recordingBy.name}'s recording` : 'Record audio'}
                tone={recordingHere ? 'record' : 'default'}
                onClick={onToggleRecording}
                pressed={!!recordingBy}
              />
            ),
            menu: {
              key: 'record',
              icon: recordingBy ? Square : Circle,
              label: recordingHere ? 'Stop recording & save' : recordingBy ? 'Stop the recording' : 'Record audio',
              onClick: onToggleRecording,
              danger: true,
              iconClass: recordingBy ? undefined : 'fill-red-500 text-red-500',
            },
          },
        ]
      : []),
    ...(moderator
      ? [
          {
            key: 'roll',
            group: 2 as const,
            priority: 7,
            node: <ControlButton key="roll" icon={ClipboardCheck} label="Roll call" ariaLabel="Call the roll" onClick={onCallRoll} />,
            menu: { key: 'roll', icon: ClipboardCheck, label: 'Call the roll', onClick: onCallRoll },
          },
        ]
      : []),
  ];

  // Fit: measure a button, the gap, More and Leave, then keep the most important items that fit the width.
  const row = useElementSize<HTMLDivElement>();
  const moreButton = useRef<HTMLButtonElement>(null);
  const leaveButton = useRef<HTMLButtonElement>(null);
  const [metrics, setMetrics] = useState<{ unit: number; gap: number; fixed: number } | null>(null);
  useLayoutEffect(() => {
    const more = moreButton.current;
    const leave = leaveButton.current;
    const rowEl = row.ref.current;
    if (!more || !leave || !rowEl) return;
    const gap = parseFloat(getComputedStyle(rowEl).columnGap) || 0;
    const unit = more.offsetWidth;
    const fixed = unit + leave.offsetWidth + (parseFloat(getComputedStyle(leave).marginLeft) || 0) + gap;
    setMetrics((prev) => (prev && prev.unit === unit && prev.gap === gap && prev.fixed === fixed ? prev : { unit, gap, fixed }));
  });
  const widthOf = (set: BarItem[]) => {
    if (!metrics) return 0;
    const separators = isSm ? Math.max(0, new Set(set.map((item) => item.group)).size - 1) : 0;
    return set.length * (metrics.unit + metrics.gap) + separators * (SEPARATOR_WIDTH + metrics.gap) + metrics.fixed;
  };
  const kept: BarItem[] = [];
  for (const item of [...items].sort((a, b) => a.priority - b.priority)) {
    // Leave a little room at each side, so the bar never touches the screen edges.
    if (!metrics || widthOf([...kept, item]) <= row.width - 8) kept.push(item);
  }
  const onBar = items.filter((item) => kept.includes(item));
  const overflow = items.filter((item) => !kept.includes(item)).map((item) => item.menu);

  const moreItems: MenuItem[] = [
    ...overflow,
    ...(moderator && !handUp ? [{ key: 'hand', icon: Hand, label: 'Raise hand', onClick: toggleHand }] : []),
    ...(moderator ? [{ key: 'mute-all', icon: VolumeX, label: 'Mute everyone', onClick: () => void act('mute-all') }] : []),
    { key: 'layout', icon: mode === 'gallery' ? RectangleHorizontal : LayoutGrid, label: mode === 'gallery' ? 'Speaker view' : 'Gallery view', onClick: () => onLayout(mode === 'gallery' ? 'speaker' : 'gallery') },
    ...(fullscreen.supported ? [{ key: 'fullscreen', icon: fullscreen.active ? Minimize : Maximize, label: fullscreen.active ? 'Exit full screen' : 'Full screen', onClick: fullscreen.toggle, small: true }] : []),
    { key: 'settings', icon: Settings, label: 'Camera, microphone & speaker', onClick: onOpenSettings },
  ];

  const barNodes: ReactNode[] = [];
  onBar.forEach((item, index) => {
    if (index > 0 && onBar[index - 1].group !== item.group) barNodes.push(<span key={`sep-${item.key}`} className="mx-1 hidden h-8 w-px shrink-0 self-center bg-white/15 sm:block" aria-hidden />);
    barNodes.push(item.node);
  });

  return (
    <footer className="border-t border-white/10 bg-[#0a0f2b] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
      <div ref={row.ref} className="mx-auto flex w-full max-w-5xl items-end justify-center gap-0.5 min-[480px]:gap-1 sm:gap-2">
        {barNodes}
        <div className="relative" data-bar-menu="more">
          <ControlButton buttonRef={moreButton} icon={MoreHorizontal} label="More" active={menu === 'more'} onClick={() => toggleMenu('more')} />
          {menu === 'more' ? (
            <div className="absolute bottom-full right-0 z-50 mb-2 w-64 overflow-hidden rounded-xl bg-[#121a3d] py-1 shadow-2xl ring-1 ring-white/15 sm:left-1/2 sm:right-auto sm:-translate-x-1/2" role="menu">
              {moreItems.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    item.onClick();
                  }}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm hover:bg-white/10',
                    item.small && 'sm:hidden',
                    item.danger ? 'text-red-300' : 'text-white',
                    index === overflow.length && overflow.length > 0 && 'border-t border-white/10'
                  )}
                >
                  <item.icon className={cn('h-4 w-4', item.iconClass)} />
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button ref={leaveButton} type="button" onClick={onLeave} aria-label={isHost ? 'Leave or end the e-session' : 'Leave the e-session'} className="ml-0.5 flex shrink-0 flex-col items-center gap-1 min-[480px]:ml-1 sm:ml-3">
          <span className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-500 max-[480px]:h-11 max-[480px]:w-11 max-[480px]:justify-center max-[480px]:px-0 sm:h-14 sm:px-6">
            <PhoneOff className="h-5 w-5" />
            <span className="max-[480px]:hidden">{isHost ? 'Leave / End' : 'Leave'}</span>
          </span>
          {/* Same height as the other buttons' captions, so the pill lines up with their circles. */}
          <span className="invisible text-[11px] font-medium max-[480px]:hidden" aria-hidden>
            &nbsp;
          </span>
        </button>
      </div>
    </footer>
  );
}
