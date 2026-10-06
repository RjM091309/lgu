// Live E-Session rooms (/es): video sittings of the Sanggunian held on tablets, phones, and computers.
// Audio and video travel directly between the devices (WebRTC, always encrypted). This server only
// introduces them to each other (signaling), keeps the room's state (who is in, the floor, the agenda,
// the waiting room), and writes the audit trail with its own clock, so a device cannot misstate when
// someone joined or left.
//
// Kept in memory like the rest of the E-Session sync (server/esession-sync.mjs): restarting the server
// ends any live room and clears the history. The attendance record is also saved to Session Files by
// the host's browser when a room ends.
//
// Sign-in is checked in the browser, as everywhere else in this prototype, so the account a device
// presents is trusted. Each participant then gets a random token that every later request must carry.
//
// Used by the Vite dev/preview server (vite.config.ts) and by the production server (server/index.mjs).

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getHttpsPort } from './https.mjs';

// Offers and answers carry the full session description (a few KB each).
const MAX_BODY_BYTES = 96 * 1024;
const KEEPALIVE_MS = 20_000;
// A device whose connection drops has this long to come back before it is counted as having left.
const DROP_GRACE_MS = 20_000;
// A live room nobody is in ends on its own after this long.
const EMPTY_ROOM_END_MS = 30 * 60_000;
const MAX_PARTICIPANTS = 24;
const MAX_ENDED_ROOMS = 100;
const MAX_EVENTS = 5_000;
const MAX_CHAT = 1_000;
const MAX_AGENDA_ITEMS = 80;
// Per participant: requests in any one second (ICE candidates come in bursts), and chat messages per 10 seconds.
const ACTION_LIMIT_PER_SECOND = 120;
const CHAT_LIMIT_PER_10S = 8;
// Per address: rooms joined or started per minute.
const JOIN_LIMIT_PER_MINUTE = 30;

const ID_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;
const ROOM_ID_PATTERN = /^es-[A-Za-z0-9_-]{8,32}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(0[1-9]|1[0-2]):[0-5]\d (AM|PM)$/;
const SESSION_TYPES = ['Regular', 'Special', 'Committee Hearing'];
const GROUPS = ['member', 'staff'];

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        resolve(value && typeof value === 'object' && !Array.isArray(value) ? value : {});
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });

const text = (value, max) => (typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null);
const id = (value) => (typeof value === 'string' && ID_PATTERN.test(value) ? value : null);
const newSecret = (bytes) => randomBytes(bytes).toString('base64url');
const sameSecret = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

const toAccount = (value) => {
  const inviteeId = id(value?.inviteeId);
  const name = text(value?.name, 120);
  const group = GROUPS.includes(value?.group) ? value.group : null;
  if (!inviteeId || !name || !group) return null;
  return {
    inviteeId,
    name,
    detail: text(value.detail, 160) ?? '',
    abbr: text(value.abbr, 6) ?? name.slice(0, 2).toUpperCase(),
    group,
    canManage: value.canManage === true,
  };
};

const toSession = (value) => {
  const sessionId = id(value?.id);
  const title = text(value?.title, 160);
  const location = text(value?.location, 160);
  const date = typeof value?.date === 'string' && DATE_PATTERN.test(value.date) ? value.date : null;
  const time = typeof value?.time === 'string' && TIME_PATTERN.test(value.time) ? value.time : null;
  const type = SESSION_TYPES.includes(value?.type) ? value.type : null;
  if (!sessionId || !title || !location || !date || !time || !type) return null;
  return { sessionId, title, location, date, time, type };
};

const person = (account) => ({ inviteeId: account.inviteeId, name: account.name });

/** @returns connect/express-style middleware handling /api/es/* (and security headers for the /es pages). */
export function createESessionRoomsHandler(env = {}) {
  const iceServers = (() => {
    // Optional STUN/TURN servers (JSON array of RTCIceServer) for devices on different networks.
    // Not needed on one local network, where devices reach each other directly.
    try {
      const parsed = JSON.parse(env.ESESSION_ICE_SERVERS || '[]');
      return Array.isArray(parsed) ? parsed.filter((entry) => entry && (typeof entry.urls === 'string' || Array.isArray(entry.urls))) : [];
    } catch {
      return [];
    }
  })();

  /** Live rooms by room id, and ended ones (newest first) kept for the history. */
  const rooms = new Map();
  let ended = [];
  const lobbyClients = new Set();
  const joinsByAddress = new Map();

  // ---- Audit trail -------------------------------------------------------------------------------

  const audit = (room, type, { actor, target, detail } = {}) => {
    room.events.push({
      id: room.events.length + 1,
      at: Date.now(),
      type,
      ...(actor ? { actor: person(actor) } : {}),
      ...(target ? { target: person(target) } : {}),
      ...(detail ? { detail } : {}),
    });
    if (room.events.length > MAX_EVENTS) room.events.splice(0, room.events.length - MAX_EVENTS);
  };

  const attendanceOf = (room, account) => {
    let entry = room.attendance.get(account.inviteeId);
    if (!entry) {
      entry = { ...person(account), detail: account.detail, abbr: account.abbr, group: account.group, role: 'participant', stints: [] };
      room.attendance.set(account.inviteeId, entry);
    }
    return entry;
  };

  const openStint = (room, participant) => {
    const entry = attendanceOf(room, participant.account);
    entry.role = participant.role;
    entry.stints.push({ joinedAt: Date.now(), leftAt: null, device: participant.device, reason: null });
  };

  const closeStint = (room, participant, reason) => {
    const stint = room.attendance.get(participant.account.inviteeId)?.stints.at(-1);
    if (stint && stint.leftAt === null) {
      stint.leftAt = Date.now();
      stint.reason = reason;
    }
  };

  // ---- Views sent to browsers --------------------------------------------------------------------

  const joined = (room) => [...room.participants.values()].filter((p) => p.state === 'joined');
  const waiting = (room) => [...room.participants.values()].filter((p) => p.state === 'waiting');
  const canModerate = (p) => p.role === 'host' || p.role === 'presiding';

  const participantView = (p) => ({
    pid: p.pid,
    seq: p.seq,
    ...person(p.account),
    detail: p.account.detail,
    abbr: p.account.abbr,
    group: p.account.group,
    role: p.role,
    audio: p.audio,
    video: p.video,
    screen: p.screen,
    hand: p.hand,
    connected: p.connected,
    joinedAt: p.joinedAt,
    device: p.device,
  });

  const summaryOf = (room) => {
    const inRoom = joined(room);
    return {
      roomId: room.roomId,
      sessionId: room.sessionId,
      title: room.title,
      type: room.type,
      date: room.date,
      time: room.time,
      location: room.location,
      status: room.status,
      startedAt: room.startedAt,
      startedBy: room.startedBy,
      endedAt: room.endedAt,
      endedBy: room.endedBy,
      locked: room.locked,
      recording: room.recording !== null,
      participantCount: inRoom.length,
      participants: inRoom.slice(0, 12).map((p) => ({ inviteeId: p.account.inviteeId, name: p.account.name, abbr: p.account.abbr, group: p.account.group })),
      attendeeCount: room.attendance.size,
      invitees: [...room.invitees],
    };
  };

  const roomView = (room, forModerator) => ({
    ...summaryOf(room),
    agenda: room.agenda,
    agendaIndex: room.agendaIndex,
    presidingId: room.presidingId,
    memberTotal: room.memberTotal,
    quorum: room.quorum,
    autoAdmit: room.autoAdmit,
    floor: room.floor,
    recordingBy: room.recording ? { pid: room.recording.pid, ...room.recording.by, since: room.recording.since } : null,
    participantsList: joined(room).map(participantView),
    waitingList: forModerator ? waiting(room).map((p) => ({ pid: p.pid, ...person(p.account), detail: p.account.detail, abbr: p.account.abbr, group: p.account.group, requestedAt: p.requestedAt, device: p.device })) : [],
    rollCalls: room.rollCalls,
  });

  // ---- Event streams -----------------------------------------------------------------------------

  const write = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const sendTo = (p, event, data) => {
    if (p.stream) write(p.stream, event, data);
  };

  let lobbyQueued = false;
  const lobbyState = () => ({ live: [...rooms.values()].map(summaryOf), ended: ended.map(summaryOf) });
  const broadcastLobby = () => {
    if (lobbyQueued) return;
    lobbyQueued = true;
    setImmediate(() => {
      lobbyQueued = false;
      const state = lobbyState();
      lobbyClients.forEach((res) => write(res, 'rooms', state));
    });
  };

  // Batched per tick: one action often changes several things.
  const broadcastRoom = (room) => {
    if (room.queued) return;
    room.queued = true;
    setImmediate(() => {
      room.queued = false;
      if (room.status !== 'live') return;
      const full = roomView(room, true);
      const plain = { ...full, waitingList: [] };
      joined(room).forEach((p) => sendTo(p, 'room', canModerate(p) ? full : plain));
      broadcastLobby();
    });
  };

  const closeStream = (p) => {
    const stream = p.stream;
    p.stream = null;
    if (stream) setImmediate(() => stream.end());
  };

  // ---- Room lifecycle ----------------------------------------------------------------------------

  /** Takes a participant out of the room; `reason` is recorded in the audit trail. */
  const removeParticipant = (room, p, reason, status) => {
    if (!room.participants.has(p.pid)) return;
    room.participants.delete(p.pid);
    if (p.state === 'joined') {
      closeStint(room, p, reason);
      if (room.floor === p.pid) {
        room.floor = null;
        audit(room, 'floor-cleared', { target: p.account, detail: 'The speaker left the room' });
      }
      if (room.recording?.pid === p.pid) {
        room.recording = null;
        audit(room, 'recording-stopped', { actor: p.account, detail: 'Stopped because the recording device left' });
      }
      audit(room, 'left', { actor: p.account, detail: reason });
    } else {
      audit(room, 'left-waiting', { actor: p.account, detail: reason });
    }
    p.state = 'left';
    if (status) sendTo(p, 'status', status);
    closeStream(p);
    if (joined(room).length === 0) room.emptySince ??= Date.now();
    broadcastRoom(room);
  };

  const endRoom = (room, by) => {
    if (room.status !== 'live') return;
    room.status = 'ended';
    room.endedAt = Date.now();
    room.endedBy = by ? person(by) : null;
    if (room.recording) {
      audit(room, 'recording-stopped', { actor: room.recording.by, detail: 'Stopped when the e-session ended' });
      room.recording = null;
    }
    [...room.participants.values()].forEach((p) => {
      if (p.state === 'joined') closeStint(room, p, 'E-session ended');
      p.state = 'left';
      sendTo(p, 'status', { state: 'ended', by: room.endedBy?.name ?? null });
      closeStream(p);
    });
    room.participants.clear();
    audit(room, 'ended', by ? { actor: by } : { detail: `Ended automatically after ${EMPTY_ROOM_END_MS / 60_000} minutes with nobody in the room` });
    rooms.delete(room.roomId);
    ended = [room, ...ended].slice(0, MAX_ENDED_ROOMS);
    broadcastLobby();
  };

  const admit = (room, p, by) => {
    p.state = 'joined';
    p.joinedAt = Date.now();
    room.emptySince = null;
    openStint(room, p);
    if (by) audit(room, 'admitted', { actor: by, target: p.account });
    audit(room, 'joined', { actor: p.account, detail: p.device });
    sendTo(p, 'status', { state: 'joined' });
    sendTo(p, 'chat-history', room.chat);
    broadcastRoom(room);
  };

  // Devices that stopped answering are counted as having left; empty rooms end on their own.
  const sweep = () => {
    const now = Date.now();
    rooms.forEach((room) => {
      room.participants.forEach((p) => {
        if (!p.connected && p.droppedAt !== null && now - p.droppedAt > DROP_GRACE_MS) {
          removeParticipant(room, p, p.everConnected ? 'Connection lost' : 'Never connected');
        }
      });
      if (room.status === 'live' && room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_END_MS) endRoom(room, null);
    });
    joinsByAddress.forEach((times, address) => {
      const recent = times.filter((time) => now - time < 60_000);
      if (recent.length) joinsByAddress.set(address, recent);
      else joinsByAddress.delete(address);
    });
  };
  setInterval(sweep, 5_000).unref();

  const allowJoin = (req) => {
    const address = req.socket.remoteAddress ?? 'unknown';
    const times = (joinsByAddress.get(address) ?? []).filter((time) => Date.now() - time < 60_000);
    if (times.length >= JOIN_LIMIT_PER_MINUTE) return false;
    times.push(Date.now());
    joinsByAddress.set(address, times);
    return true;
  };

  const withinLimit = (p, key, limit, windowMs) => {
    const now = Date.now();
    const bucket = p.limits[key];
    if (!bucket || now - bucket.start >= windowMs) {
      p.limits[key] = { start: now, count: 1 };
      return true;
    }
    bucket.count += 1;
    return bucket.count <= limit;
  };

  const findRoom = (roomId) => (ROOM_ID_PATTERN.test(roomId) ? rooms.get(roomId) ?? ended.find((room) => room.roomId === roomId) ?? null : null);

  const authParticipant = (room, pid, token) => {
    const p = typeof pid === 'string' ? room.participants.get(pid) : undefined;
    return p && sameSecret(p.token, token) ? p : null;
  };

  // ---- Request handlers --------------------------------------------------------------------------

  const startRoom = (req, res, body) => {
    const account = toAccount(body.account);
    const session = toSession(body.session);
    if (!account || !session) return sendJson(res, 400, { error: 'invalid_room' });
    if (!account.canManage) return sendJson(res, 403, { error: 'not_host' });
    if (!allowJoin(req)) return sendJson(res, 429, { error: 'too_many_requests' });

    const existing = [...rooms.values()].find((room) => room.sessionId === session.sessionId);
    if (existing) return sendJson(res, 200, { roomId: existing.roomId });

    const agenda = Array.isArray(body.agenda) ? body.agenda.map((item) => text(item, 400)).filter(Boolean).slice(0, MAX_AGENDA_ITEMS) : [];
    const invitees = Array.isArray(body.invitees) ? body.invitees.map(id).filter(Boolean).slice(0, 200) : [];
    const memberTotal = Number.isInteger(body.memberTotal) && body.memberTotal >= 0 && body.memberTotal <= 200 ? body.memberTotal : 0;
    const quorum = Number.isInteger(body.quorum) && body.quorum >= 0 && body.quorum <= memberTotal ? body.quorum : Math.floor(memberTotal / 2) + 1;

    const room = {
      roomId: `es-${newSecret(12)}`,
      ...session,
      agenda,
      agendaIndex: 0,
      presidingId: id(body.presidingId),
      invitees: new Set(invitees),
      memberTotal,
      quorum,
      status: 'live',
      startedAt: Date.now(),
      startedBy: person(account),
      endedAt: null,
      endedBy: null,
      locked: false,
      autoAdmit: false,
      floor: null,
      recording: null,
      participants: new Map(),
      removed: new Set(),
      seq: 0,
      events: [],
      chat: [],
      rollCalls: [],
      attendance: new Map(),
      emptySince: Date.now(),
      queued: false,
    };
    rooms.set(room.roomId, room);
    audit(room, 'started', { actor: account, detail: `${session.title} · ${session.type}` });
    broadcastLobby();
    return sendJson(res, 200, { roomId: room.roomId });
  };

  const joinRoom = (req, res, room, body) => {
    if (room.status !== 'live') return sendJson(res, 410, { error: 'ended' });
    const account = toAccount(body.account);
    if (!account) return sendJson(res, 400, { error: 'invalid_account' });
    if (!allowJoin(req)) return sendJson(res, 429, { error: 'too_many_requests' });
    if (!account.canManage && !room.invitees.has(account.inviteeId)) return sendJson(res, 403, { error: 'not_invited' });
    if (room.removed.has(account.inviteeId)) return sendJson(res, 403, { error: 'removed' });

    const role = account.canManage ? 'host' : account.inviteeId === room.presidingId ? 'presiding' : 'participant';
    if (room.locked && role === 'participant') return sendJson(res, 423, { error: 'locked' });

    // One device per person: joining again (another tablet, a reloaded tab) takes over from the earlier one.
    const earlier = [...room.participants.values()].find((p) => p.account.inviteeId === account.inviteeId);
    if (earlier) removeParticipant(room, earlier, 'Joined again from another device', { state: 'replaced' });

    if (room.participants.size >= MAX_PARTICIPANTS) return sendJson(res, 503, { error: 'room_full' });

    room.seq += 1;
    const p = {
      pid: `p${room.seq}-${newSecret(6)}`,
      token: newSecret(24),
      seq: room.seq,
      account,
      role,
      state: 'waiting',
      audio: body.audio === true,
      video: body.video === true,
      screen: false,
      hand: null,
      device: text(body.device, 80) ?? 'Browser',
      stream: null,
      connected: false,
      everConnected: false,
      // Counts from now until the device opens its event stream.
      droppedAt: Date.now(),
      requestedAt: Date.now(),
      joinedAt: null,
      limits: {},
    };
    room.participants.set(p.pid, p);

    // Hosts and the presiding officer go straight in; others wait for a host unless the room admits invitees automatically.
    if (role !== 'participant' || room.autoAdmit) admit(room, p, null);
    else {
      audit(room, 'join-request', { actor: p.account, detail: p.device });
      broadcastRoom(room);
    }
    return sendJson(res, 200, { pid: p.pid, token: p.token, seq: p.seq, state: p.state, role });
  };

  const openStream = (req, res, room, query) => {
    const p = authParticipant(room, query.get('pid'), query.get('token'));
    if (!p) return sendJson(res, room.status === 'live' ? 401 : 410, { error: room.status === 'live' ? 'not_in_room' : 'ended' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (p.stream && p.stream !== res) p.stream.end();
    p.stream = res;
    if (p.everConnected && !p.connected && p.state === 'joined') audit(room, 'reconnected', { actor: p.account });
    p.connected = true;
    p.everConnected = true;
    p.droppedAt = null;
    write(res, 'status', { state: p.state });
    if (p.state === 'joined') {
      write(res, 'room', roomView(room, canModerate(p)));
      write(res, 'chat-history', room.chat);
    }
    broadcastRoom(room);
    const keepAlive = setInterval(() => res.write(': ping\n\n'), KEEPALIVE_MS);
    req.on('close', () => {
      clearInterval(keepAlive);
      if (p.stream !== res) return;
      p.stream = null;
      p.connected = false;
      p.droppedAt = Date.now();
      if (room.participants.has(p.pid)) broadcastRoom(room);
    });
  };

  const targetOf = (room, body) => (typeof body.target === 'string' ? room.participants.get(body.target) ?? null : null);

  const act = (res, room, body) => {
    if (room.status !== 'live') return sendJson(res, 410, { error: 'ended' });
    const p = authParticipant(room, body.pid, body.token);
    if (!p) return sendJson(res, 401, { error: 'not_in_room' });
    if (!withinLimit(p, 'actions', ACTION_LIMIT_PER_SECOND, 1_000)) return sendJson(res, 429, { error: 'too_many_requests' });

    const type = body.type;
    if (type === 'leave') {
      removeParticipant(room, p, p.state === 'joined' ? 'Left the e-session' : 'Stopped waiting');
      return sendJson(res, 200, { ok: true });
    }
    if (p.state !== 'joined') return sendJson(res, 403, { error: 'not_admitted' });

    const ok = () => {
      broadcastRoom(room);
      return sendJson(res, 200, { ok: true });
    };
    const forbidden = () => sendJson(res, 403, { error: 'not_allowed' });
    const isHost = p.role === 'host';

    switch (type) {
      case 'signal': {
        const target = targetOf(room, body);
        if (!target || target.state !== 'joined' || target === p || !body.data || typeof body.data !== 'object') return sendJson(res, 400, { error: 'invalid_signal' });
        sendTo(target, 'signal', { from: p.pid, data: body.data });
        return sendJson(res, 200, { ok: true });
      }
      case 'state': {
        const screen = body.screen === true;
        if (screen !== p.screen) audit(room, screen ? 'screen-started' : 'screen-stopped', { actor: p.account });
        p.audio = body.audio === true;
        p.video = body.video === true;
        p.screen = screen;
        return ok();
      }
      case 'hand': {
        const raised = body.raised === true;
        if (raised === (p.hand !== null)) return sendJson(res, 200, { ok: true });
        p.hand = raised ? Date.now() : null;
        audit(room, raised ? 'hand-raised' : 'hand-lowered', { actor: p.account });
        return ok();
      }
      case 'chat': {
        const message = text(body.text, 500);
        if (!message) return sendJson(res, 400, { error: 'invalid_chat' });
        if (!withinLimit(p, 'chat', CHAT_LIMIT_PER_10S, 10_000)) return sendJson(res, 429, { error: 'too_many_messages' });
        const entry = { id: `${room.chat.length + 1}-${newSecret(4)}`, at: Date.now(), from: { pid: p.pid, ...person(p.account), abbr: p.account.abbr }, text: message };
        room.chat.push(entry);
        if (room.chat.length > MAX_CHAT) room.chat.shift();
        audit(room, 'chat', { actor: p.account, detail: message });
        joined(room).forEach((other) => sendTo(other, 'chat', entry));
        return sendJson(res, 200, { ok: true });
      }

      // The presiding officer and the hosts run the floor and the agenda.
      case 'mute': {
        const target = targetOf(room, body);
        if (!canModerate(p)) return forbidden();
        if (!target || target.state !== 'joined' || target === p) return sendJson(res, 400, { error: 'invalid_target' });
        sendTo(target, 'control', { type: 'mute', by: p.account.name });
        audit(room, 'muted', { actor: p.account, target: target.account });
        return ok();
      }
      case 'mute-all': {
        if (!canModerate(p)) return forbidden();
        joined(room)
          .filter((other) => other !== p && other.pid !== room.floor)
          .forEach((other) => sendTo(other, 'control', { type: 'mute', by: p.account.name }));
        audit(room, 'muted-all', { actor: p.account, detail: room.floor ? 'Everyone except the speaker with the floor' : undefined });
        return ok();
      }
      case 'floor': {
        if (!canModerate(p)) return forbidden();
        if (body.target === null) {
          if (room.floor) audit(room, 'floor-cleared', { actor: p.account, target: room.participants.get(room.floor)?.account });
          room.floor = null;
          return ok();
        }
        const target = targetOf(room, body);
        if (!target || target.state !== 'joined') return sendJson(res, 400, { error: 'invalid_target' });
        room.floor = target.pid;
        target.hand = null;
        sendTo(target, 'control', { type: 'floor', by: p.account.name });
        audit(room, 'floor-granted', { actor: p.account, target: target.account });
        return ok();
      }
      case 'agenda': {
        if (!canModerate(p)) return forbidden();
        const index = body.index;
        if (!Number.isInteger(index) || index < 0 || index >= room.agenda.length) return sendJson(res, 400, { error: 'invalid_agenda' });
        room.agendaIndex = index;
        audit(room, 'agenda', { actor: p.account, detail: `${index + 1}. ${room.agenda[index]}` });
        return ok();
      }
      case 'roll-call': {
        if (!canModerate(p)) return forbidden();
        const present = joined(room).filter((other) => other.account.group === 'member');
        const call = {
          at: Date.now(),
          by: person(p.account),
          present: present.map((other) => person(other.account)),
          presentCount: present.length,
          memberTotal: room.memberTotal,
          quorum: room.quorum,
          hasQuorum: present.length >= room.quorum,
        };
        room.rollCalls.push(call);
        audit(room, 'roll-call', {
          actor: p.account,
          detail: `${call.presentCount} of ${call.memberTotal} members present · ${call.hasQuorum ? 'quorum declared' : `no quorum (${call.quorum} needed)`}`,
        });
        return ok();
      }

      // Hosts (the Secretariat's administrators) run the room itself.
      case 'admit':
      case 'deny': {
        if (!isHost) return forbidden();
        const target = targetOf(room, body);
        if (!target || target.state !== 'waiting') return sendJson(res, 400, { error: 'invalid_target' });
        if (type === 'admit') admit(room, target, p.account);
        else {
          audit(room, 'denied', { actor: p.account, target: target.account });
          removeParticipant(room, target, `Not admitted by ${p.account.name}`, { state: 'denied', by: p.account.name });
        }
        return ok();
      }
      case 'remove': {
        if (!isHost) return forbidden();
        const target = targetOf(room, body);
        if (!target || target === p) return sendJson(res, 400, { error: 'invalid_target' });
        room.removed.add(target.account.inviteeId);
        audit(room, 'removed', { actor: p.account, target: target.account });
        removeParticipant(room, target, `Removed by ${p.account.name}`, { state: 'removed', by: p.account.name });
        return ok();
      }
      case 'lock': {
        if (!isHost) return forbidden();
        const locked = body.locked === true;
        if (locked !== room.locked) audit(room, locked ? 'locked' : 'unlocked', { actor: p.account });
        room.locked = locked;
        return ok();
      }
      case 'auto-admit': {
        if (!isHost) return forbidden();
        const on = body.on === true;
        if (on !== room.autoAdmit) audit(room, on ? 'auto-admit-on' : 'auto-admit-off', { actor: p.account });
        room.autoAdmit = on;
        if (on) waiting(room).forEach((other) => admit(room, other, p.account));
        return ok();
      }
      case 'recording': {
        const on = body.on === true;
        if (on) {
          if (!isHost) return forbidden();
          if (room.recording && room.recording.pid !== p.pid) return sendJson(res, 409, { error: 'already_recording' });
          if (!room.recording) {
            room.recording = { pid: p.pid, by: person(p.account), since: Date.now() };
            audit(room, 'recording-started', { actor: p.account });
          }
        } else if (room.recording) {
          if (room.recording.pid !== p.pid && !isHost) return forbidden();
          room.recording = null;
          audit(room, 'recording-stopped', { actor: p.account });
        }
        return ok();
      }
      case 'recording-saved': {
        const name = text(body.name, 200);
        if (!isHost || !name) return sendJson(res, 400, { error: 'invalid_file' });
        audit(room, 'recording-saved', { actor: p.account, detail: name });
        return sendJson(res, 200, { ok: true });
      }
      case 'end': {
        if (!isHost) return forbidden();
        endRoom(room, p.account);
        return sendJson(res, 200, { ok: true });
      }
      default:
        return sendJson(res, 400, { error: 'unknown_action' });
    }
  };

  const auditOf = (room) => ({
    room: summaryOf(room),
    agenda: room.agenda,
    presidingId: room.presidingId,
    memberTotal: room.memberTotal,
    quorum: room.quorum,
    events: room.events,
    chat: room.chat,
    rollCalls: room.rollCalls,
    attendance: [...room.attendance.values()],
  });

  return async function eSessionRoomsHandler(req, res, next) {
    const url = new URL(req.url || '/', 'http://localhost');
    const path = url.pathname;

    // The room pages use the camera and microphone: never let another site frame them.
    if (path === '/es' || path.startsWith('/es/')) {
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
      res.setHeader('Referrer-Policy', 'same-origin');
      res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self), screen-wake-lock=(self)');
      next();
      return;
    }
    if (!path.startsWith('/api/es/')) {
      next();
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'GET') {
      if (path === '/api/es/info') return sendJson(res, 200, { httpsPort: getHttpsPort(), iceServers });
      if (path === '/api/es/rooms') return sendJson(res, 200, lobbyState());
      if (path === '/api/es/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        write(res, 'rooms', lobbyState());
        lobbyClients.add(res);
        const keepAlive = setInterval(() => res.write(': ping\n\n'), KEEPALIVE_MS);
        req.on('close', () => {
          clearInterval(keepAlive);
          lobbyClients.delete(res);
        });
        return;
      }
      const streamMatch = path.match(/^\/api\/es\/rooms\/([^/]+)\/stream$/);
      if (streamMatch) {
        const room = findRoom(streamMatch[1]);
        if (!room) return sendJson(res, 404, { error: 'not_found' });
        return openStream(req, res, room, url.searchParams);
      }
      const auditMatch = path.match(/^\/api\/es\/rooms\/([^/]+)\/audit$/);
      if (auditMatch) {
        const room = findRoom(auditMatch[1]);
        return room ? sendJson(res, 200, auditOf(room)) : sendJson(res, 404, { error: 'not_found' });
      }
      return sendJson(res, 404, { error: 'not_found' });
    }

    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      return sendJson(res, error.message === 'too_large' ? 413 : 400, { error: error.message });
    }

    if (path === '/api/es/rooms') return startRoom(req, res, body);
    const match = path.match(/^\/api\/es\/rooms\/([^/]+)\/(join|action)$/);
    if (match) {
      const room = findRoom(match[1]);
      if (!room) return sendJson(res, 404, { error: 'not_found' });
      return match[2] === 'join' ? joinRoom(req, res, room, body) : act(res, room, body);
    }
    return sendJson(res, 404, { error: 'not_found' });
  };
}
