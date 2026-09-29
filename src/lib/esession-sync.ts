import { useSyncExternalStore } from 'react';
import { mockAttendanceMarks, mockAttendanceSessions, mockCommitteeAssignments, mockMembers, mockPastSessions, mockSessions, type Session } from '@/lib/mock-data';
import { isNativeApp } from '@/lib/native';

// E-Session state shared by the web calendar and the mobile app (/m): attendance responses, sessions
// scheduled during the demo, and reminders. The local server (server/esession-sync.mjs) keeps one copy
// in memory and streams every change to each open browser, so a response given on a phone shows up on
// the Secretariat's screen at once. Without the server (a static host) everything still works, per browser.
// The Android app (APK) is not served by the LIMS server, so it connects to the address entered in the app,
// and polls through Android's HTTP client (CapacitorHttp) instead of holding an event stream open.

export type RsvpStatus = 'attending' | 'declined';

export interface Rsvp {
  status: RsvpStatus;
  reason?: string;
  /** Local Manila time, `YYYY-MM-DDTHH:mm`. */
  respondedAt: string;
  /** Name of whoever recorded the response (the invitee or the Secretariat on their behalf). */
  recordedBy: string;
}

export interface Notice {
  id: string;
  kind: 'scheduled' | 'reminder' | 'announcement';
  sessionId: string;
  /** Announcements only: the message pushed from the Session Platform. */
  text?: string;
  /** Reminders only: who was reminded. A newly scheduled session concerns everyone invited to it. */
  inviteeIds?: string[];
  /** Local Manila time, `YYYY-MM-DDTHH:mm`. */
  at: string;
  from: string;
}

export type SyncStatus = 'connecting' | 'live' | 'offline';

/** A phone running LIMS Mobile (the Android app or the browser at /m), as the server last saw it. */
export interface MobileDevice {
  id: string;
  platform: 'app' | 'browser';
  /** e.g. `Samsung SM-A546E`, `iPhone`. */
  model: string;
  /** e.g. `Android 14`. */
  os: string;
  /** Who is signed in on it; null while it shows the sign-in screen. */
  account: { inviteeId: string; name: string; detail: string } | null;
  online: boolean;
  /** Epoch milliseconds. */
  connectedAt: number;
  lastSeen: number;
}

export type PresenceReport = Pick<MobileDevice, 'platform' | 'model' | 'os' | 'account'> & { deviceId: string };

interface ESessionState {
  rsvps: Record<string, Rsvp>;
  /** Sessions scheduled in the app, on top of the sample sessions. */
  scheduled: Session[];
  notices: Notice[];
  devices: MobileDevice[];
  status: SyncStatus;
}

interface ServerState {
  seeded: boolean;
  version: number;
  rsvps: Record<string, Rsvp>;
  sessions: Session[];
  notices: Notice[];
  devices?: MobileDevice[];
}

export const rsvpKey = (sessionId: string, inviteeId: string) => `${sessionId}|${inviteeId}`;

const SAMPLE_RSVPS: Record<string, Rsvp> = {
  [rsvpKey('s1', 'member:m1')]: { status: 'attending', respondedAt: '2026-09-24T10:12', recordedBy: 'SB Secretary' },
  [rsvpKey('s1', 'member:m2')]: { status: 'attending', respondedAt: '2026-09-24T10:14', recordedBy: 'SB Secretary' },
  [rsvpKey('s1', 'member:m3')]: { status: 'attending', respondedAt: '2026-09-24T13:40', recordedBy: 'SB Secretary' },
  [rsvpKey('s1', 'member:m4')]: { status: 'declined', reason: 'On official travel to Tarlac City', respondedAt: '2026-09-25T08:05', recordedBy: 'SB Secretary' },
  [rsvpKey('s1', 'member:m5')]: { status: 'attending', respondedAt: '2026-09-25T09:30', recordedBy: 'SB Secretary' },
  [rsvpKey('s1', 'member:m6')]: { status: 'attending', respondedAt: '2026-09-25T09:31', recordedBy: 'SB Secretary' },
  [rsvpKey('s1', 'member:m11')]: { status: 'attending', respondedAt: '2026-09-25T11:02', recordedBy: 'SB Secretary' },
  [rsvpKey('s1', 'user:USR-002')]: { status: 'attending', respondedAt: '2026-09-24T10:00', recordedBy: 'SB Secretary' },
  [rsvpKey('s1', 'user:USR-005')]: { status: 'attending', respondedAt: '2026-09-24T16:20', recordedBy: 'Journal and Minutes Officer' },
  [rsvpKey('s2', 'member:m3')]: { status: 'attending', respondedAt: '2026-09-25T14:10', recordedBy: 'SB Committee Staff' },
  [rsvpKey('s2', 'member:m11')]: { status: 'declined', reason: 'Barangay assembly on the same afternoon', respondedAt: '2026-09-25T15:45', recordedBy: 'SB Committee Staff' },
  ...pastSessionRsvps(),
};

/**
 * Responses for the sessions already held. Members of the body follow the attendance register where the
 * session is in it; the others (June sessions, hearings) have a few absences spread among the members.
 * The Secretariat accounts (and committee staff, for hearings) all attended.
 */
function pastSessionRsvps() {
  const reasons = ['On official travel', 'On leave', 'Health reasons', 'Schedule conflict'];
  const rsvps: Record<string, Rsvp> = {};
  mockPastSessions.forEach((session, sessionIndex) => {
    const hearing = session.type === 'Committee Hearing';
    const recordedBy = hearing ? 'SB Committee Staff' : 'SB Secretary';
    const answered = new Date(`${session.date}T00:00:00Z`);
    answered.setUTCDate(answered.getUTCDate() - 3);
    const respondedAt = (minute: number) => `${answered.toISOString().slice(0, 10)}T${String(9 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

    const register = mockAttendanceSessions.findIndex((entry) => entry.date === session.date);
    const assignment = session.committeeId ? mockCommitteeAssignments[session.committeeId] : undefined;
    const memberIds = assignment ? [assignment.chair, assignment.viceChair, ...assignment.members] : mockMembers.map((member) => member.id);
    memberIds.forEach((memberId, memberIndex) => {
      const absent = register >= 0 ? mockAttendanceMarks[memberId]?.[register] === 'A' : (sessionIndex * 5 + memberIndex * 3) % 11 === 0;
      rsvps[rsvpKey(session.id, `member:${memberId}`)] = absent
        ? { status: 'declined', reason: reasons[(sessionIndex + memberIndex) % reasons.length], respondedAt: respondedAt(memberIndex * 7), recordedBy }
        : { status: 'attending', respondedAt: respondedAt(memberIndex * 7), recordedBy };
    });

    const staff = hearing ? ['USR-001', 'USR-002', 'USR-003', 'USR-005', 'USR-004', 'USR-006'] : ['USR-001', 'USR-002', 'USR-003', 'USR-005'];
    staff.forEach((userId, index) => {
      rsvps[rsvpKey(session.id, `user:${userId}`)] = { status: 'attending', respondedAt: respondedAt(index * 5), recordedBy };
    });
  });
  return rsvps;
}

let state: ESessionState = { rsvps: SAMPLE_RSVPS, scheduled: [], notices: [], devices: [], status: 'connecting' };

const listeners = new Set<() => void>();
const setState = (next: Partial<ESessionState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

let source: EventSource | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastVersion = -1;
const POLL_MS = 1500;

const SERVER_KEY = 'lims-server';

// The browser app talks to the server that served it; the Android app to the address saved on the phone.
let serverBase = (() => {
  if (!isNativeApp) return '';
  try {
    return localStorage.getItem(SERVER_KEY) ?? '';
  } catch {
    return '';
  }
})();

/** `192.168.1.10:2510`, `http://192.168.1.10:2510/m` → `http://192.168.1.10:2510`; null if it is not an address. */
export const normalizeServerAddress = (input: string) => {
  const match = input.trim().match(/^(https?:\/\/)?([A-Za-z0-9.-]+)(:\d{1,5})?(\/.*)?$/i);
  if (!match || !/[A-Za-z0-9]/.test(match[2])) return null;
  try {
    return new URL(`${match[1]?.toLowerCase() ?? 'http://'}${match[2]}${match[3] ?? ''}`).origin;
  } catch {
    return null;
  }
};

/** The LIMS server the Android app connects to (empty in the browser app, or before one is entered). */
export const getServerAddress = () => serverBase;

/** Points the Android app at a LIMS server and reconnects, starting again from that server's data. */
export const setServerAddress = (origin: string) => {
  serverBase = origin;
  try {
    localStorage.setItem(SERVER_KEY, origin);
  } catch {
    // Storage unavailable: the address lasts until the app is closed.
  }
  source?.close();
  source = null;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  lastVersion = -1;
  setState({ rsvps: SAMPLE_RSVPS, scheduled: [], notices: [], devices: [], status: 'connecting' });
  connect();
};

const applyServer = (server: ServerState) => {
  // Polling sees the same state until something changes; only re-render when it does.
  if (server.version === lastVersion && state.status === 'live') return;
  lastVersion = server.version;
  if (!server.seeded) {
    // First browser to connect since the server started hands it the sample responses (the server
    // ignores any seed after the first).
    void send('POST', '/api/esession/seed', { rsvps: SAMPLE_RSVPS });
    setState({ status: 'live' });
    return;
  }
  setState({ rsvps: server.rsvps, scheduled: server.sessions, notices: server.notices, devices: server.devices ?? [], status: 'live' });
};

const poll = async () => {
  const base = serverBase;
  try {
    const res = await fetch(`${base}/api/esession/state`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const server = (await res.json()) as ServerState;
    if (base === serverBase) applyServer(server);
  } catch {
    // Unreachable for now: keep this phone's copy and try again on the next tick.
    if (base === serverBase && state.status !== 'offline') setState({ status: 'offline' });
  }
};

const connect = () => {
  if (source || pollTimer) return;
  if (isNativeApp) {
    if (!serverBase) {
      if (state.status !== 'offline') setState({ status: 'offline' });
      return;
    }
    void poll();
    pollTimer = setInterval(() => void poll(), POLL_MS);
    return;
  }
  if (typeof EventSource === 'undefined') {
    if (state.status !== 'offline') setState({ status: 'offline' });
    return;
  }
  source = new EventSource(`${serverBase}/api/esession/events`);
  source.onmessage = (event) => {
    try {
      applyServer(JSON.parse(event.data) as ServerState);
    } catch {
      // A malformed message is skipped; the next change sends the full state again.
    }
  };
  source.onerror = () => {
    // EventSource retries on its own while the server is restarting; if it gave up (no sync server,
    // e.g. a static host), the app carries on with this browser's copy.
    setState({ status: 'offline' });
    if (source?.readyState === EventSource.CLOSED) source = null;
  };
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  connect();
  return () => listeners.delete(listener);
};

async function send(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown) {
  if (state.status !== 'live' && url !== '/api/esession/seed') return;
  try {
    await fetch(`${serverBase}${url}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  } catch {
    setState({ status: 'offline' });
  }
}

export const useESessionState = () => useSyncExternalStore(subscribe, () => state);
/** Phones running LIMS Mobile that have connected to this server. */
export const useMobileDevices = () => useSyncExternalStore(subscribe, () => state.devices);
export const useSyncStatus = () => useSyncExternalStore(subscribe, () => state.status);

const byDate = (a: Session, b: Session) => a.date.localeCompare(b.date) || toMinutes(a.time) - toMinutes(b.time);

/** `09:00 AM` → minutes after midnight. */
export const toMinutes = (time: string) => {
  const [clock, meridiem] = time.split(' ');
  const [hour, minute] = clock.split(':').map(Number);
  return (hour % 12) * 60 + (meridiem === 'PM' ? 720 : 0) + minute;
};

let sessionsCache: { scheduled: Session[]; all: Session[] } | null = null;
const allSessions = () => {
  if (sessionsCache?.scheduled !== state.scheduled) {
    sessionsCache = { scheduled: state.scheduled, all: [...mockPastSessions, ...mockSessions, ...state.scheduled].sort(byDate) };
  }
  return sessionsCache.all;
};

/** Sample sessions (held and upcoming) plus any scheduled in the app, in date order. */
export const useCalendarSessions = () => useSyncExternalStore(subscribe, allSessions);

/** Records a response; `null` clears it back to "no response". */
export const setRsvp = (sessionId: string, inviteeId: string, rsvp: Rsvp | null) => {
  const rsvps = { ...state.rsvps };
  if (rsvp) rsvps[rsvpKey(sessionId, inviteeId)] = rsvp;
  else delete rsvps[rsvpKey(sessionId, inviteeId)];
  setState({ rsvps });
  void send('PUT', '/api/esession/rsvp', { sessionId, inviteeId, rsvp });
};

const newNoticeId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const scheduleSession = (session: Session, from: string, at: string) => {
  setState({
    scheduled: [...state.scheduled, session],
    notices: [{ id: newNoticeId(), kind: 'scheduled', sessionId: session.id, at, from }, ...state.notices],
  });
  void send('POST', '/api/esession/sessions', { session, from, at });
};

/** Removes a session scheduled in the app (the sample sessions stay). */
export const cancelScheduledSession = (id: string) => {
  const prefix = `${id}|`;
  setState({
    scheduled: state.scheduled.filter((entry) => entry.id !== id),
    rsvps: Object.fromEntries(Object.entries(state.rsvps).filter(([key]) => !key.startsWith(prefix))),
    notices: state.notices.filter((notice) => notice.sessionId !== id),
  });
  void send('DELETE', `/api/esession/sessions/${encodeURIComponent(id)}`);
};

export const isScheduledInApp = (id: string) => state.scheduled.some((entry) => entry.id === id);

export const sendReminder = (sessionId: string, inviteeIds: string[], from: string, at: string) => {
  setState({ notices: [{ id: newNoticeId(), kind: 'reminder', sessionId, inviteeIds, at, from }, ...state.notices] });
  void send('POST', '/api/esession/remind', { sessionId, inviteeIds, from, at });
};

/** A message from the Session Platform to every phone. */
export const sendAnnouncement = (sessionId: string, text: string, from: string, at: string) => {
  setState({ notices: [{ id: newNoticeId(), kind: 'announcement', sessionId, text, at, from }, ...state.notices] });
  void send('POST', '/api/esession/announce', { sessionId, text, from, at });
};

/** A phone checking in: keeps it listed as connected on the Session Platform. */
export const reportPresence = (report: PresenceReport) => void send('POST', '/api/esession/presence', report);

/** A browser tab closing: shows the phone as offline at once instead of after the timeout. */
export const reportLeaving = (report: PresenceReport) => {
  if (isNativeApp || state.status !== 'live') return;
  try {
    navigator.sendBeacon(`${serverBase}/api/esession/presence`, new Blob([JSON.stringify({ ...report, leaving: true })], { type: 'application/json' }));
  } catch {
    // The server marks it offline when the check-ins stop.
  }
};

export const newSessionId = () => `sched-${Date.now().toString(36)}`;

/** Current Manila time, `YYYY-MM-DDTHH:mm`. */
export const nowInManila = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};
