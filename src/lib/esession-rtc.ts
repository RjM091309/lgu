// Audio and video for the E-Session room (/es). Every device connects directly to every other one
// (a WebRTC "mesh"); the LIMS server only passes along the messages that set those connections up.
// WebRTC always encrypts the media (DTLS-SRTP), and on one local network the devices find each other
// without any outside server.
//
// A mesh sends one copy of a device's video to each other device, so video quality scales down as the
// room fills, except for whoever has the floor or is sharing a screen. About 16 devices (a full sitting
// of the body plus the Secretariat) is the comfortable ceiling; a media server would replace this file
// for larger rooms.

import { withWebmDuration } from '@/lib/media-duration';

export type PeerLink = 'connecting' | 'connected' | 'reconnecting' | 'failed';
export type LinkQuality = 'good' | 'fair' | 'poor';

export interface PeerInfo {
  stream: MediaStream | null;
  link: PeerLink;
  quality: LinkQuality | null;
}

export interface VideoProfile {
  maxBitrate: number;
  scale: number;
  maxFramerate: number;
}

type Signal =
  | { kind: 'offer' | 'answer'; conn: string; sdp: string }
  | { kind: 'candidates'; conn: string; list: RTCIceCandidateInit[] }
  | { kind: 'reconnect'; conn: string };

interface Peer {
  pid: string;
  conn: string;
  /** The later of the two devices to join starts (and restarts) the connection. */
  initiator: boolean;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  link: PeerLink;
  quality: LinkQuality | null;
  pending: RTCIceCandidateInit[];
  outgoing: RTCIceCandidateInit[];
  flushTimer: ReturnType<typeof setTimeout> | null;
  recoverTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
  lastStats: { lost: number; received: number } | null;
}

/** Video quality a device sends, by how many others it sends to and whether it is the one being watched. */
export const videoProfileFor = (others: number, prominent: boolean, sharing: boolean): VideoProfile => {
  if (sharing) return { maxBitrate: 1_500_000, scale: 1, maxFramerate: 15 };
  if (others <= 3) return { maxBitrate: 1_200_000, scale: 1, maxFramerate: 30 };
  if (prominent) return others <= 6 ? { maxBitrate: 1_000_000, scale: 1, maxFramerate: 24 } : { maxBitrate: 600_000, scale: 1.25, maxFramerate: 20 };
  if (others <= 6) return { maxBitrate: 450_000, scale: 1.5, maxFramerate: 24 };
  return { maxBitrate: 220_000, scale: 2, maxFramerate: 15 };
};

const newConn = () => Math.random().toString(36).slice(2, 10);
const DISCONNECT_GRACE_MS = 4_000;
const STATS_MS = 3_000;
// Devices that just answered an offer may not be in the room list yet (the list and the offer travel separately).
const NEW_PEER_GRACE_MS = 5_000;

export class MeshCall {
  private peers = new Map<string, Peer>();
  private audioTrack: MediaStreamTrack | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private profile: VideoProfile = videoProfileFor(0, false, false);
  private statsTimer: ReturnType<typeof setInterval>;
  private closed = false;

  constructor(
    private readonly opts: {
      selfSeq: number;
      iceServers: RTCIceServer[];
      send: (to: string, data: Signal) => void;
      onChange: () => void;
    }
  ) {
    this.statsTimer = setInterval(() => void this.measure(), STATS_MS);
  }

  /** Current view of each connected device, for rendering. */
  snapshot() {
    const result = new Map<string, PeerInfo>();
    this.peers.forEach((peer, pid) => result.set(pid, { stream: peer.stream, link: peer.link, quality: peer.quality }));
    return result;
  }

  /** Brings the connections in line with the room: connects to newcomers, drops those who left. */
  sync(others: { pid: string; seq: number }[]) {
    if (this.closed) return;
    const present = new Set(others.map((other) => other.pid));
    this.peers.forEach((peer, pid) => {
      if (!present.has(pid) && Date.now() - peer.createdAt > NEW_PEER_GRACE_MS) this.drop(pid);
    });
    others.forEach((other) => {
      if (!this.peers.has(other.pid) && other.seq < this.opts.selfSeq) void this.call(other.pid);
    });
  }

  setTracks(audio: MediaStreamTrack | null, video: MediaStreamTrack | null) {
    this.audioTrack = audio;
    this.videoTrack = video;
    this.peers.forEach((peer) => void this.attachTracks(peer));
  }

  setProfile(profile: VideoProfile) {
    if (profile.maxBitrate === this.profile.maxBitrate && profile.scale === this.profile.scale && profile.maxFramerate === this.profile.maxFramerate) return;
    this.profile = profile;
    this.peers.forEach((peer) => void this.applyProfile(peer));
  }

  async handleSignal(from: string, raw: unknown) {
    if (this.closed || !raw || typeof raw !== 'object') return;
    const data = raw as Signal;
    let peer = this.peers.get(from);
    try {
      if (data.kind === 'offer') {
        // A new connection id means the other device started over: replace the old connection.
        if (!peer || peer.conn !== data.conn) {
          if (peer) this.drop(from, false);
          peer = this.createPeer(from, data.conn, false);
        }
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        await this.attachTracks(peer, true);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        this.opts.send(from, { kind: 'answer', conn: peer.conn, sdp: peer.pc.localDescription?.sdp ?? answer.sdp ?? '' });
        await this.flushPending(peer);
      } else if (data.kind === 'answer') {
        if (!peer || peer.conn !== data.conn || peer.pc.signalingState !== 'have-local-offer') return;
        await peer.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        await this.flushPending(peer);
      } else if (data.kind === 'candidates') {
        if (!peer || peer.conn !== data.conn || !Array.isArray(data.list)) return;
        if (peer.pc.remoteDescription) {
          for (const candidate of data.list) await peer.pc.addIceCandidate(candidate).catch(() => undefined);
        } else {
          peer.pending.push(...data.list);
        }
      } else if (data.kind === 'reconnect') {
        if (peer?.initiator && peer.conn === data.conn) this.restart(from);
      }
    } catch {
      // A failed step leaves the connection to the recovery timer below (or to the next offer).
      if (peer) this.scheduleRecovery(peer, 1_500);
    }
  }

  close() {
    this.closed = true;
    clearInterval(this.statsTimer);
    [...this.peers.keys()].forEach((pid) => this.drop(pid, false));
  }

  // ---- Connections ------------------------------------------------------------------------------

  private createPeer(pid: string, conn: string, initiator: boolean) {
    const pc = new RTCPeerConnection({ iceServers: this.opts.iceServers, bundlePolicy: 'max-bundle' });
    const peer: Peer = {
      pid,
      conn,
      initiator,
      pc,
      stream: null,
      link: 'connecting',
      quality: null,
      pending: [],
      outgoing: [],
      flushTimer: null,
      recoverTimer: null,
      createdAt: Date.now(),
      lastStats: null,
    };
    this.peers.set(pid, peer);

    pc.ontrack = (event) => {
      const tracks = peer.stream ? peer.stream.getTracks().filter((track) => track.kind !== event.track.kind) : [];
      // A fresh stream object each time, so video elements pick up the change on every browser.
      peer.stream = new MediaStream([...tracks, event.track]);
      event.track.onunmute = () => this.opts.onChange();
      event.track.onmute = () => this.opts.onChange();
      this.opts.onChange();
    };
    // Candidates are sent in small batches instead of one request each.
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      peer.outgoing.push(event.candidate.toJSON());
      peer.flushTimer ??= setTimeout(() => {
        peer.flushTimer = null;
        const list = peer.outgoing.splice(0);
        if (list.length && this.peers.get(pid) === peer) this.opts.send(pid, { kind: 'candidates', conn: peer.conn, list });
      }, 60);
    };
    const onState = () => {
      if (this.peers.get(pid) !== peer) return;
      const state = pc.connectionState ?? pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        this.setLink(peer, 'connected');
        if (peer.recoverTimer) clearTimeout(peer.recoverTimer);
        peer.recoverTimer = null;
        void this.applyProfile(peer);
      } else if (state === 'disconnected') {
        this.setLink(peer, 'reconnecting');
        this.scheduleRecovery(peer, DISCONNECT_GRACE_MS);
      } else if (state === 'failed') {
        this.setLink(peer, 'reconnecting');
        this.scheduleRecovery(peer, 0);
      }
    };
    pc.onconnectionstatechange = onState;
    pc.oniceconnectionstatechange = onState;
    // Nothing connected after a while (e.g. an offer got lost): start over.
    this.scheduleRecovery(peer, 15_000);
    return peer;
  }

  private async call(pid: string) {
    const peer = this.createPeer(pid, newConn(), true);
    // Fixed order (audio, then video) so both sides agree which transceiver carries what.
    peer.pc.addTransceiver(this.audioTrack ?? 'audio', { direction: 'sendrecv' });
    peer.pc.addTransceiver(this.videoTrack ?? 'video', { direction: 'sendrecv' });
    await this.offer(peer, false);
  }

  private async offer(peer: Peer, iceRestart: boolean) {
    try {
      const offer = await peer.pc.createOffer({ iceRestart });
      await peer.pc.setLocalDescription(offer);
      this.opts.send(peer.pid, { kind: 'offer', conn: peer.conn, sdp: peer.pc.localDescription?.sdp ?? offer.sdp ?? '' });
    } catch {
      this.scheduleRecovery(peer, 1_500);
    }
  }

  /** The initiator recovers a broken connection by starting a new one; the other side asks it to. */
  private scheduleRecovery(peer: Peer, delay: number) {
    if (peer.recoverTimer) clearTimeout(peer.recoverTimer);
    peer.recoverTimer = setTimeout(() => {
      peer.recoverTimer = null;
      if (this.closed || this.peers.get(peer.pid) !== peer) return;
      const state = peer.pc.connectionState ?? peer.pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') return;
      if (peer.initiator) this.restart(peer.pid);
      else {
        this.opts.send(peer.pid, { kind: 'reconnect', conn: peer.conn });
        this.scheduleRecovery(peer, 10_000);
      }
    }, delay);
  }

  private restart(pid: string) {
    this.drop(pid, false);
    void this.call(pid);
  }

  private drop(pid: string, notify = true) {
    const peer = this.peers.get(pid);
    if (!peer) return;
    this.peers.delete(pid);
    if (peer.flushTimer) clearTimeout(peer.flushTimer);
    if (peer.recoverTimer) clearTimeout(peer.recoverTimer);
    peer.pc.ontrack = null;
    peer.pc.onicecandidate = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.oniceconnectionstatechange = null;
    peer.pc.close();
    if (notify) this.opts.onChange();
  }

  private setLink(peer: Peer, link: PeerLink) {
    if (peer.link === link) return;
    peer.link = link;
    this.opts.onChange();
  }

  private async flushPending(peer: Peer) {
    const list = peer.pending.splice(0);
    for (const candidate of list) await peer.pc.addIceCandidate(candidate).catch(() => undefined);
  }

  // ---- Media ------------------------------------------------------------------------------------

  private async attachTracks(peer: Peer, answering = false) {
    for (const transceiver of peer.pc.getTransceivers()) {
      const kind = transceiver.receiver.track?.kind;
      if (kind !== 'audio' && kind !== 'video') continue;
      if (answering) transceiver.direction = 'sendrecv';
      const track = kind === 'audio' ? this.audioTrack : this.videoTrack;
      if (transceiver.sender.track !== track) await transceiver.sender.replaceTrack(track).catch(() => undefined);
    }
    void this.applyProfile(peer);
  }

  private async applyProfile(peer: Peer) {
    const sender = peer.pc.getTransceivers().find((transceiver) => transceiver.receiver.track?.kind === 'video')?.sender;
    if (!sender?.track) return;
    const params = sender.getParameters();
    // Before negotiation finishes some browsers report no encodings; the profile is applied once connected.
    if (!params.encodings?.length) return;
    params.encodings[0].maxBitrate = this.profile.maxBitrate;
    params.encodings[0].scaleResolutionDownBy = this.profile.scale;
    params.encodings[0].maxFramerate = this.profile.maxFramerate;
    await sender.setParameters(params).catch(() => undefined);
  }

  /** Round-trip time and packet loss of each connection, shown as signal bars. */
  private async measure() {
    let changed = false;
    for (const peer of this.peers.values()) {
      if (peer.link !== 'connected') continue;
      try {
        const report = await peer.pc.getStats();
        let rtt: number | null = null;
        let lost = 0;
        let received = 0;
        report.forEach((stat) => {
          if (stat.type === 'candidate-pair' && (stat.nominated || stat.selected) && stat.state === 'succeeded' && typeof stat.currentRoundTripTime === 'number') rtt = stat.currentRoundTripTime;
          if (stat.type === 'inbound-rtp') {
            lost += stat.packetsLost ?? 0;
            received += stat.packetsReceived ?? 0;
          }
        });
        const previous = peer.lastStats;
        peer.lastStats = { lost, received };
        const lossRate = previous ? Math.max(0, lost - previous.lost) / Math.max(1, received - previous.received + Math.max(0, lost - previous.lost)) : 0;
        const roundTrip = rtt ?? 0;
        const quality: LinkQuality = roundTrip < 0.3 && lossRate < 0.03 ? 'good' : roundTrip < 0.6 && lossRate < 0.1 ? 'fair' : 'poor';
        if (quality !== peer.quality) {
          peer.quality = quality;
          changed = true;
        }
      } catch {
        // Stats are a nicety; skip this round.
      }
    }
    if (changed) this.opts.onChange();
  }
}

// ---- Who is speaking ----------------------------------------------------------------------------

type AudioContextClass = typeof AudioContext;
const AudioContextImpl: AudioContextClass | undefined =
  typeof window === 'undefined' ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext;

let sharedContext: AudioContext | null = null;

/** One audio context for the whole page (iPads allow only a few); null where the browser has none. */
export const getAudioContext = () => {
  if (!sharedContext && AudioContextImpl) sharedContext = new AudioContextImpl();
  return sharedContext;
};

/** Needs a tap or click first on iPads and in Chrome. */
export const resumeAudio = () => {
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined);
};

/** Measures how loud each stream is, for the speaking highlight and the microphone meter. */
export class AudioLevels {
  readonly ctx: AudioContext | null = getAudioContext();
  private nodes = new Map<string, { track: MediaStreamTrack; source: MediaStreamAudioSourceNode; analyser: AnalyserNode; data: Float32Array<ArrayBuffer> }>();

  track(id: string, stream: MediaStream | null) {
    const track = stream?.getAudioTracks()[0] ?? null;
    const current = this.nodes.get(id);
    if (current?.track === track) return;
    if (current) {
      current.source.disconnect();
      this.nodes.delete(id);
    }
    if (!track || !this.ctx) return;
    try {
      const source = this.ctx.createMediaStreamSource(new MediaStream([track]));
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      this.nodes.set(id, { track, source, analyser, data: new Float32Array(analyser.fftSize) });
    } catch {
      // Not measurable on this browser; the tile just never lights up.
    }
  }

  forgetExcept(ids: Set<string>) {
    [...this.nodes.keys()].filter((id) => !ids.has(id)).forEach((id) => this.track(id, null));
  }

  /** Loudness (root mean square, 0–1) of each stream that has sound enabled. */
  levels() {
    const result = new Map<string, number>();
    this.nodes.forEach((node, id) => {
      if (!node.track.enabled || node.track.readyState !== 'live') return;
      node.analyser.getFloatTimeDomainData(node.data);
      let sum = 0;
      for (let i = 0; i < node.data.length; i += 1) sum += node.data[i] * node.data[i];
      result.set(id, Math.sqrt(sum / node.data.length));
    });
    return result;
  }

  /** Disconnects every stream; the shared audio context stays open for the next use. */
  close() {
    this.nodes.forEach((node) => node.source.disconnect());
    this.nodes.clear();
  }
}

// ---- Recording (audio of everyone in the room, on the host's device) ----------------------------

const RECORDING_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export const recordingMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  return RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
};

export const recordingExtension = (mimeType: string) => (mimeType.startsWith('audio/mp4') ? 'm4a' : mimeType.startsWith('audio/ogg') ? 'ogg' : 'webm');

export class CallRecorder {
  private destination: MediaStreamAudioDestinationNode;
  private sources = new Map<string, { track: MediaStreamTrack; node: MediaStreamAudioSourceNode }>();
  private recorder: MediaRecorder;
  private chunks: Blob[] = [];
  readonly mimeType: string;
  readonly startedAt = Date.now();

  private seq = 0;

  /** `onChunk` gets each second of the recording as it is written (for the backup on this device). */
  constructor(
    private readonly ctx: AudioContext,
    onChunk?: (blob: Blob, seq: number) => void
  ) {
    const mimeType = recordingMimeType();
    if (!mimeType) throw new Error('Recording is not supported on this browser.');
    this.mimeType = mimeType;
    this.destination = ctx.createMediaStreamDestination();
    this.recorder = new MediaRecorder(this.destination.stream, { mimeType, audioBitsPerSecond: 64_000 });
    this.recorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      this.chunks.push(event.data);
      onChunk?.(event.data, this.seq++);
    };
    this.recorder.start(1_000);
  }

  /** Adds (or updates) one person's audio in the mix; null takes it out. */
  set(id: string, stream: MediaStream | null) {
    const track = stream?.getAudioTracks()[0] ?? null;
    const current = this.sources.get(id);
    if (current?.track === track) return;
    if (current) {
      current.node.disconnect();
      this.sources.delete(id);
    }
    if (!track) return;
    try {
      const node = this.ctx.createMediaStreamSource(new MediaStream([track]));
      node.connect(this.destination);
      this.sources.set(id, { track, node });
    } catch {
      // That person is left out of the recording rather than stopping it.
    }
  }

  forgetExcept(ids: Set<string>) {
    [...this.sources.keys()].filter((id) => !ids.has(id)).forEach((id) => this.set(id, null));
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const finish = () => {
        this.sources.forEach((source) => source.node.disconnect());
        this.sources.clear();
        // Written as a stream, the file has no length of its own; add it so players can seek anywhere.
        const blob = new Blob(this.chunks, { type: this.mimeType.split(';')[0] });
        void withWebmDuration(blob, Date.now() - this.startedAt).then(resolve, () => resolve(blob));
      };
      if (this.recorder.state === 'inactive') return finish();
      this.recorder.onstop = finish;
      this.recorder.stop();
    });
  }
}

// ---- Devices ------------------------------------------------------------------------------------

export const AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
export const VIDEO_CONSTRAINTS: MediaTrackConstraints = { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24, max: 30 } };

export const mediaAvailable = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** A phone or tablet (iPads included, which report themselves as Macs). */
export const isMobileDevice = () => typeof navigator !== 'undefined' && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || isIpad());

/** Screen sharing works on computers; iPads and phones cannot share their screen from a browser (they present a file). */
export const canShareScreen = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && !isMobileDevice();

export const supportsSpeakerChoice = () => typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

// iPads report themselves as Macs; a Mac has no touch screen.
const isIpad = () => typeof navigator !== 'undefined' && /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;

/** Short description of this device for the attendance record, e.g. `iPad · Safari`. */
export const describeDevice = () => {
  const ua = navigator.userAgent;
  const device = /iPad/.test(ua) || isIpad()
    ? 'iPad'
    : /iPhone/.test(ua)
      ? 'iPhone'
      : /Android/.test(ua)
        ? /Mobile/.test(ua)
          ? 'Android phone'
          : 'Android tablet'
        : /Windows/.test(ua)
          ? 'Windows computer'
          : /Macintosh/.test(ua)
            ? 'Mac'
            : /CrOS/.test(ua)
              ? 'Chromebook'
              : /Linux/.test(ua)
                ? 'Linux computer'
                : 'Device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Browser';
  return `${device} · ${browser}`;
};

export const mediaErrorMessage = (error: unknown, what: 'camera' | 'microphone') => {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return `Access to the ${what} was blocked. Allow it in the browser's site settings (on an iPad: Settings › Safari › ${what === 'camera' ? 'Camera' : 'Microphone'}), then try again.`;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return `No ${what} was found on this device.`;
  if (name === 'NotReadableError' || name === 'AbortError') return `The ${what} is being used by another app. Close it and try again.`;
  return `The ${what} could not be started.`;
};

export const openMic = (deviceId?: string) =>
  navigator.mediaDevices.getUserMedia({ audio: { ...AUDIO_CONSTRAINTS, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } }).then((stream) => stream.getAudioTracks()[0]);

export const openCamera = (deviceId?: string) =>
  navigator.mediaDevices
    .getUserMedia({ video: { ...VIDEO_CONSTRAINTS, ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }) } })
    .then((stream) => stream.getVideoTracks()[0]);

/** Keeps the tablet's screen from going to sleep while in the room. */
export const requestWakeLock = async () => {
  try {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    return (await wakeLock?.request('screen')) ?? null;
  } catch {
    return null;
  }
};
