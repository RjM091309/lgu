import { useSyncExternalStore } from 'react';
import type { UserAccount } from '@/lib/access-store';
import { inviteesFor } from '@/lib/attendance';
import type { MobileAccount } from '@/lib/mobile-accounts';
import { mockCommitteeAssignments, type Session } from '@/lib/mock-data';
import { buildAgenda } from '@/lib/sessions';

// Live E-Session rooms (/es): the room state kept by the LIMS server (server/esession-rooms.mjs), the
// lobby's list of rooms, and the connection a device holds while it is in a room. Audio and video go
// directly between devices (see esession-rtc.ts); this file only carries the room's state and the
// messages that connect devices to each other.

// ---- Types shared with the server ---------------------------------------------------------------

export interface Person {
  inviteeId: string;
  name: string;
}

/** Host: the Secretariat's administrators. Presiding: the Vice Mayor, or the committee chair at a hearing. */
export type RoomRole = 'host' | 'presiding' | 'participant';

export interface RoomSummary {
  roomId: string;
  sessionId: string;
  title: string;
  type: Session['type'];
  date: string;
  time: string;
  location: string;
  status: 'live' | 'ended';
  /** Epoch milliseconds, from the server's clock. */
  startedAt: number;
  startedBy: Person;
  endedAt: number | null;
  endedBy: Person | null;
  /** When the first person entered (epoch ms), or null if nobody has yet. */
  liveSince: number | null;
  /** Live but nobody in the call; members wait for a host or the presiding officer. */
  onHold: boolean;
  locked: boolean;
  /** Invitees join without waiting to be admitted. */
  autoAdmit: boolean;
  recording: boolean;
  participantCount: number;
  participants: (Person & { abbr: string; group: 'member' | 'staff'; device?: string })[];
  /** The agenda item being taken up (live rooms). */
  agendaItem?: string | null;
  /** Everyone who was in the room at some point. */
  attendeeCount: number;
  invitees: string[];
}

export interface Participant extends Person {
  pid: string;
  /** Order of joining; the later of two devices starts the connection between them. */
  seq: number;
  detail: string;
  abbr: string;
  group: 'member' | 'staff';
  role: RoomRole;
  audio: boolean;
  video: boolean;
  screen: boolean;
  /** When the hand went up (epoch ms), or null. */
  hand: number | null;
  /** False while the device is reconnecting. */
  connected: boolean;
  joinedAt: number | null;
  device: string;
}

export interface WaitingParticipant extends Person {
  pid: string;
  detail: string;
  abbr: string;
  group: 'member' | 'staff';
  requestedAt: number;
  device: string;
}

export interface RollCall {
  at: number;
  by: Person;
  present: Person[];
  presentCount: number;
  memberTotal: number;
  quorum: number;
  hasQuorum: boolean;
}

export interface RoomView extends RoomSummary {
  agenda: string[];
  agendaIndex: number;
  presidingId: string | null;
  memberTotal: number;
  quorum: number;
  autoAdmit: boolean;
  /** pid of the participant who has the floor. */
  floor: string | null;
  recordingBy: (Person & { pid: string; since: number }) | null;
  participantsList: Participant[];
  /** Only sent to hosts and the presiding officer. */
  waitingList: WaitingParticipant[];
  rollCalls: RollCall[];
}

export interface ChatMessage {
  id: string;
  at: number;
  from: Person & { pid: string; abbr: string };
  text: string;
}

export type AuditType =
  | 'started'
  | 'ended'
  | 'join-request'
  | 'admitted'
  | 'denied'
  | 'joined'
  | 'left'
  | 'left-waiting'
  | 'reconnected'
  | 'removed'
  | 'muted'
  | 'muted-all'
  | 'locked'
  | 'unlocked'
  | 'auto-admit-on'
  | 'auto-admit-off'
  | 'hand-raised'
  | 'hand-lowered'
  | 'floor-granted'
  | 'floor-cleared'
  | 'agenda'
  | 'roll-call'
  | 'chat'
  | 'screen-started'
  | 'screen-stopped'
  | 'recording-started'
  | 'recording-stopped'
  | 'recording-saved';

export interface AuditEvent {
  id: number;
  at: number;
  type: AuditType;
  actor?: Person;
  target?: Person;
  detail?: string;
}

export interface AttendanceEntry extends Person {
  detail: string;
  abbr: string;
  group: 'member' | 'staff';
  role: RoomRole;
  stints: { joinedAt: number; leftAt: number | null; device: string; reason: string | null }[];
}

export interface RoomAudit {
  room: RoomSummary;
  agenda: string[];
  presidingId: string | null;
  memberTotal: number;
  quorum: number;
  events: AuditEvent[];
  chat: ChatMessage[];
  rollCalls: RollCall[];
  attendance: AttendanceEntry[];
}

/** What a device learns about itself through its event stream. */
export type RoomStatus =
  | { state: 'waiting' | 'joined' }
  | { state: 'denied' | 'removed'; by?: string }
  | { state: 'ended'; by?: string | null }
  | { state: 'replaced' };

// ---- Sign-in ------------------------------------------------------------------------------------

// The same accounts as LIMS Mobile: members of the body sign in by position, Secretariat and committee
// staff with their portal usernames. "Remember me" keeps the sign-in in localStorage; otherwise it lasts
// for the browser tab, as on the Staff Portal.
const ACCOUNT_KEY = 'lims-es-account';

export const readESessionAccount = () => {
  try {
    return localStorage.getItem(ACCOUNT_KEY) ?? sessionStorage.getItem(ACCOUNT_KEY);
  } catch {
    return null;
  }
};

export const writeESessionAccount = (inviteeId: string | null, remember = false) => {
  try {
    localStorage.removeItem(ACCOUNT_KEY);
    sessionStorage.removeItem(ACCOUNT_KEY);
    if (inviteeId) (remember ? localStorage : sessionStorage).setItem(ACCOUNT_KEY, inviteeId);
  } catch {
    // Storage unavailable (private mode): the sign-in lasts until the page is closed.
  }
};

// ---- Roles --------------------------------------------------------------------------------------

/** The Vice Mayor presides over regular and special sessions; the committee chair over a hearing. Hosts run meetings. */
export const presidingIdFor = (session: Pick<Session, 'type' | 'committeeId'>) => {
  if (session.type === 'Meeting') return null;
  const assignment = session.type === 'Committee Hearing' && session.committeeId ? mockCommitteeAssignments[session.committeeId] : undefined;
  return `member:${assignment?.chair ?? 'm1'}`;
};

export const roleIn = (account: MobileAccount, session: Pick<Session, 'type' | 'committeeId'>): RoomRole =>
  account.canManage ? 'host' : account.inviteeId === presidingIdFor(session) ? 'presiding' : 'participant';

export const ROLE_LABEL: Record<RoomRole, string> = { host: 'Host', presiding: 'Presiding Officer', participant: 'Participant' };

export const roleLabelFor = (role: RoomRole, session: Pick<Session, 'type'>) =>
  role === 'presiding' && session.type === 'Committee Hearing' ? 'Committee Chair' : ROLE_LABEL[role];

export const canModerate = (role: RoomRole) => role === 'host' || role === 'presiding';

/** Members expected at the session and the majority of them needed to transact business. */
export const quorumFor = (session: Session, users: UserAccount[]) => {
  const memberTotal = inviteesFor(session, users).filter((invitee) => invitee.group === 'member').length;
  return { memberTotal, quorum: Math.floor(memberTotal / 2) + 1 };
};

export const toRoomAccount = (account: MobileAccount) => ({
  inviteeId: account.inviteeId,
  name: account.name,
  detail: account.detail,
  abbr: account.abbr,
  group: account.group,
  canManage: account.canManage,
});

// ---- Server calls -------------------------------------------------------------------------------

export class RoomError extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(code);
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new RoomError('offline', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new RoomError(typeof data.error === 'string' ? data.error : `http_${res.status}`, res.status);
  return data as T;
}

/** Plain-language reason for a failed room request. */
export const roomErrorMessage = (error: unknown) => {
  const code = error instanceof RoomError ? error.code : '';
  switch (code) {
    case 'offline':
      return 'The LIMS server could not be reached. Check the Wi-Fi connection and try again.';
    case 'not_invited':
      return 'You are not on the invitation list for this session.';
    case 'removed':
      return 'A host removed you from this e-session.';
    case 'on_hold':
      return 'Nobody is in the e-session yet. You can join once the host or presiding officer is in.';
    case 'locked':
      return 'The host has locked this e-session. Ask the Secretariat to unlock it.';
    case 'ended':
    case 'not_found':
      return 'This e-session has already ended.';
    case 'room_full':
      return 'The e-session is full.';
    case 'not_host':
      return 'Only the Secretariat can start an e-session.';
    case 'already_recording':
      return 'Another host is already recording this e-session.';
    case 'too_many_requests':
    case 'too_many_messages':
      return 'Too many requests at once. Wait a moment and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
};

export interface ServerInfo {
  httpsPort: number | null;
  iceServers: RTCIceServer[];
}

let infoPromise: Promise<ServerInfo> | null = null;
export const fetchServerInfo = () => {
  infoPromise ??= fetch('/api/es/info', { cache: 'no-store' })
    .then((res) => (res.ok ? (res.json() as Promise<ServerInfo>) : { httpsPort: null, iceServers: [] }))
    .catch(() => {
      infoPromise = null;
      return { httpsPort: null, iceServers: [] };
    });
  return infoPromise;
};

/** The same page on the server's https port, where the camera and microphone are allowed. */
export const secureUrlFor = (httpsPort: number | null) => {
  if (!httpsPort) return null;
  const url = new URL(window.location.href);
  url.protocol = 'https:';
  url.port = String(httpsPort);
  return url.toString();
};

/** Starts the e-session for a calendar session (or returns the one already live). */
export const startRoom = (account: MobileAccount, session: Session, users: UserAccount[]) =>
  post<{ roomId: string }>('/api/es/rooms', {
    account: toRoomAccount(account),
    session: { id: session.id, title: session.title, date: session.date, time: session.time, location: session.location, type: session.type },
    agenda: buildAgenda(session),
    invitees: inviteesFor(session, users).map((invitee) => invitee.id),
    presidingId: presidingIdFor(session),
    ...quorumFor(session, users),
  });

export interface JoinResult {
  pid: string;
  token: string;
  seq: number;
  state: 'waiting' | 'joined';
  role: RoomRole;
}

export const joinRoom = (roomId: string, account: MobileAccount, options: { device: string; audio: boolean; video: boolean }) =>
  post<JoinResult>(`/api/es/rooms/${encodeURIComponent(roomId)}/join`, { account: toRoomAccount(account), ...options });

export const fetchAudit = async (roomId: string): Promise<RoomAudit | null> => {
  try {
    const res = await fetch(`/api/es/rooms/${encodeURIComponent(roomId)}/audit`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as RoomAudit) : null;
  } catch {
    return null;
  }
};

// ---- Lobby: every live and ended room on this server -------------------------------------------

export type LobbyStatus = 'connecting' | 'live' | 'offline';

let lobby: { live: RoomSummary[]; ended: RoomSummary[]; status: LobbyStatus } = { live: [], ended: [], status: 'connecting' };
const lobbyListeners = new Set<() => void>();
let lobbySource: EventSource | null = null;

const setLobby = (next: Partial<typeof lobby>) => {
  lobby = { ...lobby, ...next };
  lobbyListeners.forEach((listener) => listener());
};

const connectLobby = () => {
  if (lobbySource || typeof EventSource === 'undefined') return;
  lobbySource = new EventSource('/api/es/events');
  lobbySource.addEventListener('rooms', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent<string>).data) as { live: RoomSummary[]; ended: RoomSummary[] };
      setLobby({ live: data.live, ended: data.ended, status: 'live' });
    } catch {
      // Skipped; the next change sends the full list again.
    }
  });
  lobbySource.onerror = () => {
    // EventSource retries on its own while the server restarts.
    if (lobby.status !== 'offline') setLobby({ status: 'offline' });
    if (lobbySource?.readyState === EventSource.CLOSED) {
      lobbySource = null;
      setTimeout(connectLobby, 3_000);
    }
  };
};

const subscribeLobby = (listener: () => void) => {
  lobbyListeners.add(listener);
  connectLobby();
  return () => lobbyListeners.delete(listener);
};

export const useLobby = () => useSyncExternalStore(subscribeLobby, () => lobby);

// ---- A device's connection to the room it is in -------------------------------------------------

export interface RoomHandlers {
  onStatus: (status: RoomStatus) => void;
  onRoom: (room: RoomView) => void;
  onSignal: (from: string, data: unknown) => void;
  onChat: (message: ChatMessage) => void;
  onChatHistory: (messages: ChatMessage[]) => void;
  onControl: (control: { type: 'mute' | 'floor'; by: string }) => void;
  /** The event stream is retrying (true) or back (false). */
  onReconnecting: (reconnecting: boolean) => void;
  /** The server no longer knows this device (it restarted, or the device was away too long). */
  onLost: () => void;
}

export class RoomConnection {
  private source: EventSource | null = null;
  private closed = false;

  constructor(
    readonly roomId: string,
    readonly pid: string,
    private readonly token: string,
    private readonly handlers: RoomHandlers
  ) {}

  open() {
    const url = `/api/es/rooms/${encodeURIComponent(this.roomId)}/stream?pid=${encodeURIComponent(this.pid)}&token=${encodeURIComponent(this.token)}`;
    const source = new EventSource(url);
    this.source = source;
    const on = <T,>(name: string, handle: (data: T) => void) =>
      source.addEventListener(name, (event) => {
        try {
          handle(JSON.parse((event as MessageEvent<string>).data) as T);
        } catch {
          // A malformed message is skipped.
        }
      });
    on<RoomStatus>('status', (status) => this.handlers.onStatus(status));
    on<RoomView>('room', (room) => this.handlers.onRoom(room));
    on<{ from: string; data: unknown }>('signal', ({ from, data }) => this.handlers.onSignal(from, data));
    on<ChatMessage>('chat', (message) => this.handlers.onChat(message));
    on<ChatMessage[]>('chat-history', (messages) => this.handlers.onChatHistory(messages));
    on<{ type: 'mute' | 'floor'; by: string }>('control', (control) => this.handlers.onControl(control));
    source.onopen = () => this.handlers.onReconnecting(false);
    source.onerror = () => {
      if (this.closed) return;
      if (source.readyState === EventSource.CLOSED) {
        this.closed = true;
        this.handlers.onLost();
      } else {
        this.handlers.onReconnecting(true);
      }
    };
  }

  /** Sends an action; resolves false (instead of throwing) for the routine ones that can just be retried. */
  act(type: string, payload: Record<string, unknown> = {}) {
    return post<{ ok: true }>(`/api/es/rooms/${encodeURIComponent(this.roomId)}/action`, { pid: this.pid, token: this.token, type, ...payload });
  }

  send(type: string, payload: Record<string, unknown> = {}) {
    return this.act(type, payload).then(
      () => true,
      () => false
    );
  }

  /** For a closing tab: tells the server at once instead of waiting for the connection to time out. */
  leaveBeacon() {
    try {
      navigator.sendBeacon(
        `/api/es/rooms/${encodeURIComponent(this.roomId)}/action`,
        new Blob([JSON.stringify({ pid: this.pid, token: this.token, type: 'leave', reason: 'page-closed' })], { type: 'application/json' })
      );
    } catch {
      // The server counts the device as gone once its connection stops.
    }
  }

  close() {
    this.closed = true;
    this.source?.close();
    this.source = null;
  }
}

// ---- Formatting ---------------------------------------------------------------------------------

export const clockTime = (ms: number) => new Date(ms).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
export const clockTimeWithSeconds = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit' });
export const dateTime = (ms: number) =>
  new Date(ms).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** `1:05:09` or `05:09`. */
export const elapsedClock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** `2 h 05 min`, `12 min`, `< 1 min`. */
export const durationText = (ms: number) => {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return '< 1 min';
  const h = Math.floor(minutes / 60);
  return h ? `${h} h ${String(minutes % 60).padStart(2, '0')} min` : `${minutes} min`;
};

/** Total time a person was in the room (an open stint counts until `now`). */
export const timeInRoom = (entry: AttendanceEntry, now = Date.now()) => entry.stints.reduce((sum, stint) => sum + ((stint.leftAt ?? now) - stint.joinedAt), 0);
