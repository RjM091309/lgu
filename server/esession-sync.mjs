// Shared E-Session state for the web calendar, the mobile app (/m), and the Android app on the same local network.
// Kept in memory only: attendance responses, sessions scheduled during the demo, and reminders.
// Restarting the server returns everything to the sample data.
//
// Used by the Vite dev/preview server (vite.config.ts) and by the production server (server/index.mjs).

import { createReadStream, statSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createFileStore, isFileId, toFileMeta } from './session-file-store.mjs';

const MAX_BODY_BYTES = 64 * 1024;
// The first browser hands over the sample responses and the editable sample calendar in one request.
const MAX_SEED_BYTES = 256 * 1024;
const MAX_SEED_SESSIONS = 100;
// Built by `npm run apk`; offered to phones from the web app's Mobile app window.
const APK_FILE = fileURLToPath(new URL('../downloads/LIMS-Mobile.apk', import.meta.url));
const MAX_NOTICES = 50;
const KEEPALIVE_MS = 25_000;
// Phones running LIMS Mobile report in every few seconds; one that stops is shown offline, then dropped.
const DEVICE_OFFLINE_MS = 15_000;
const DEVICE_FORGET_MS = 30 * 60_000;
const DEVICE_PLATFORMS = ['app', 'browser'];

const SESSION_TYPES = ['Regular', 'Special', 'Committee Hearing', 'Meeting'];
const MAX_INVITEES = 200;
const MAX_AGENDA_ITEMS = 40;
const RSVP_STATUSES = ['attending', 'declined'];
const ID_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(0[1-9]|1[0-2]):[0-5]\d (AM|PM)$/;
const STAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
// The Android app (capacitor.config.ts) loads its screens from http://localhost on the phone, so its
// calls to this server are cross-origin.
const APP_ORIGINS = ['http://localhost', 'https://localhost', 'capacitor://localhost'];

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

const readJsonBody = (req, limit = MAX_BODY_BYTES) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });

const text = (value, max) => (typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null);

const toRsvp = (value) => {
  if (!value || !RSVP_STATUSES.includes(value.status)) return null;
  const respondedAt = typeof value.respondedAt === 'string' && STAMP_PATTERN.test(value.respondedAt) ? value.respondedAt : null;
  const recordedBy = text(value.recordedBy, 120);
  if (!respondedAt || !recordedBy) return null;
  const reason = text(value.reason, 200);
  return { status: value.status, ...(reason ? { reason } : {}), respondedAt, recordedBy };
};

const toSession = (value) => {
  const id = typeof value?.id === 'string' && ID_PATTERN.test(value.id) ? value.id : null;
  const title = text(value?.title, 160);
  const location = text(value?.location, 160);
  const date = typeof value?.date === 'string' && DATE_PATTERN.test(value.date) ? value.date : null;
  const time = typeof value?.time === 'string' && TIME_PATTERN.test(value.time) ? value.time : null;
  const type = SESSION_TYPES.includes(value?.type) ? value.type : null;
  if (!id || !title || !location || !date || !time || !type) return null;
  const committeeId = type === 'Committee Hearing' && typeof value.committeeId === 'string' && ID_PATTERN.test(value.committeeId) ? value.committeeId : undefined;
  if (type === 'Committee Hearing' && !committeeId) return null;
  const purpose = type === 'Special' ? text(value.purpose, 300) : null;
  // A meeting's invitees are chosen when it is set up; sessions and hearings invite by type.
  const invitees =
    type === 'Meeting' && Array.isArray(value.invitees) ? [...new Set(value.invitees.filter((entry) => typeof entry === 'string' && ID_PATTERN.test(entry)))].slice(0, MAX_INVITEES) : null;
  if (type === 'Meeting' && !invitees?.length) return null;
  const agenda = type === 'Meeting' && Array.isArray(value.agenda) ? value.agenda.map((item) => text(item, 300)).filter(Boolean).slice(0, MAX_AGENDA_ITEMS) : [];
  return {
    id,
    title,
    date,
    time,
    location,
    type,
    ...(committeeId ? { committeeId } : {}),
    ...(purpose ? { purpose } : {}),
    ...(invitees ? { invitees } : {}),
    ...(agenda.length ? { agenda } : {}),
  };
};

const lanUrls = (port) =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => `http://${entry.address}:${port}/m`);

const apkInfo = () => {
  try {
    const stat = statSync(APK_FILE);
    return { size: stat.size, builtAt: stat.mtime.toISOString() };
  } catch {
    return null;
  }
};

/** @returns connect/express-style middleware handling /api/esession/* */
export function createESessionSyncHandler() {
  // `seeded` stays false until the first browser sends the sample responses and the editable sample
  // calendar, so the sample data lives in one place (src/lib/esession-sync.ts). A restart starts over.
  // `started`: sessions whose e-session has been started since then (told by esession-rooms.mjs); they can
  // no longer be edited or cancelled.
  // `calendarSeeded` is kept apart, so a browser still running an older copy of the app (which seeds only the
  // responses) cannot leave the calendar empty.
  // `files`: Session Files added during the demo (contents in session-file-store.mjs). An entry whose id is one of
  // the sample files replaces it; `deleted: true` hides a sample file.
  let state = { seeded: false, calendarSeeded: false, version: 0, rsvps: {}, sessions: [], notices: [], devices: [], started: [], files: [] };
  const fileStore = createFileStore();
  let fileSeq = 0;
  const clients = new Set();

  const publish = () => {
    state = { ...state, version: state.version + 1 };
    const message = `data: ${JSON.stringify(state)}\n\n`;
    clients.forEach((res) => res.write(message));
  };

  const addNotice = (notice) => {
    state.notices = [{ id: `n${state.version + 1}-${Date.now().toString(36)}`, at: notice.at, ...notice }, ...state.notices].slice(0, MAX_NOTICES);
  };

  // Marks phones that stopped reporting as offline, and forgets them after a while.
  const sweepDevices = () => {
    const now = Date.now();
    let changed = false;
    const devices = state.devices.flatMap((device) => {
      if (now - device.lastSeen > DEVICE_FORGET_MS) {
        changed = true;
        return [];
      }
      if (device.online && now - device.lastSeen > DEVICE_OFFLINE_MS) {
        changed = true;
        return [{ ...device, online: false }];
      }
      return [device];
    });
    if (changed) {
      state = { ...state, devices };
      publish();
    }
  };
  setInterval(sweepDevices, 5_000).unref();

  const toAccount = (value) => {
    const inviteeId = typeof value?.inviteeId === 'string' && ID_PATTERN.test(value.inviteeId) ? value.inviteeId : null;
    const name = text(value?.name, 120);
    if (!inviteeId || !name) return null;
    return { inviteeId, name, detail: text(value.detail, 160) ?? '' };
  };

  async function eSessionSyncHandler(req, res, next) {
    const path = (req.url || '').split('?')[0];
    if (!path.startsWith('/api/esession/')) {
      next();
      return;
    }

    const origin = req.headers.origin;
    if (origin && APP_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Meta');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (path === '/api/esession/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(`data: ${JSON.stringify(state)}\n\n`);
      clients.add(res);
      const keepAlive = setInterval(() => res.write(': ping\n\n'), KEEPALIVE_MS);
      req.on('close', () => {
        clearInterval(keepAlive);
        clients.delete(res);
      });
      return;
    }

    // The Android app polls this instead of the event stream (see src/lib/esession-sync.ts).
    if (path === '/api/esession/state' && req.method === 'GET') {
      sendJson(res, 200, state);
      return;
    }

    if (path === '/api/esession/info' && req.method === 'GET') {
      sendJson(res, 200, { mobileUrls: lanUrls(req.socket.localPort), apk: apkInfo() });
      return;
    }

    if (path === '/api/esession/apk' && req.method === 'GET') {
      const apk = apkInfo();
      if (!apk) {
        sendJson(res, 404, { error: 'apk_not_built' });
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': apk.size,
        'Content-Disposition': 'attachment; filename="LIMS-Mobile.apk"',
        'Cache-Control': 'no-store',
      });
      createReadStream(APK_FILE).pipe(res);
      return;
    }

    // ---- Session Files ----
    const contentMatch = path.match(/^\/api\/esession\/files\/([A-Za-z0-9_-]{1,64})\/content$/);
    if (contentMatch && (req.method === 'GET' || req.method === 'HEAD')) {
      const entry = state.files.find((file) => file.id === contentMatch[1] && !file.deleted);
      if (!entry) {
        sendJson(res, 404, { error: 'not_found' });
        return;
      }
      fileStore.send(req, res, entry.id, entry.name);
      return;
    }

    // A new file, or new contents for an existing one (`?id=`: a recording attached to a listed row).
    if (path === '/api/esession/files' && req.method === 'POST') {
      let meta = null;
      try {
        meta = toFileMeta(JSON.parse(decodeURIComponent(String(req.headers['x-file-meta'] ?? ''))));
      } catch {
        meta = null;
      }
      const target = new URL(req.url, 'http://localhost').searchParams.get('id');
      if (!meta || (target !== null && !isFileId(target))) {
        req.resume();
        sendJson(res, 400, { error: 'invalid_file' });
        return;
      }
      const id = target ?? `up-${++fileSeq}`;
      try {
        const size = await fileStore.save(req, id);
        const previous = state.files.find((file) => file.id === id);
        const revision = (previous?.revision ?? 0) + 1;
        const entry = { ...meta, id, size, revision, src: `/api/esession/files/${id}/content?r=${revision}` };
        state = { ...state, files: [entry, ...state.files.filter((file) => file.id !== id)] };
        publish();
        sendJson(res, 200, entry);
      } catch (error) {
        sendJson(res, error.message === 'too_large' ? 413 : error.message === 'store_full' ? 507 : 400, { error: error.message });
      }
      return;
    }

    const fileMatch = path.match(/^\/api\/esession\/files\/([A-Za-z0-9_-]{1,64})$/);
    if (fileMatch && req.method === 'DELETE') {
      const id = fileMatch[1];
      const previous = state.files.find((file) => file.id === id);
      fileStore.remove(id);
      // A file added here goes away; a sample file (or a sample row given new contents) stays hidden.
      const isUpload = previous?.source === 'upload' && id.startsWith('up-');
      state = { ...state, files: [...(isUpload ? [] : [{ id, deleted: true }]), ...state.files.filter((file) => file.id !== id)] };
      publish();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }

    let body = {};
    if (req.method !== 'DELETE') {
      try {
        body = await readJsonBody(req, path === '/api/esession/seed' ? MAX_SEED_BYTES : MAX_BODY_BYTES);
      } catch (error) {
        sendJson(res, error.message === 'too_large' ? 413 : 400, { error: error.message });
        return;
      }
    }

    if (path === '/api/esession/seed' && req.method === 'POST') {
      let changed = false;
      if (!state.calendarSeeded && Array.isArray(body.sessions)) {
        const seededSessions = body.sessions.slice(0, MAX_SEED_SESSIONS).map(toSession).filter(Boolean);
        // Anything scheduled in the moment before the seed arrived is kept.
        const sessions = [...seededSessions, ...state.sessions.filter((entry) => !seededSessions.some((seed) => seed.id === entry.id))];
        state = { ...state, calendarSeeded: true, sessions };
        changed = true;
      }
      if (!state.seeded) {
        const rsvps = {};
        Object.entries(body.rsvps ?? {}).forEach(([key, value]) => {
          const rsvp = toRsvp(value);
          if (rsvp && key.length <= 130) rsvps[key] = rsvp;
        });
        state = { ...state, seeded: true, rsvps: { ...rsvps, ...state.rsvps } };
        changed = true;
      }
      if (changed) publish();
      sendJson(res, 200, state);
      return;
    }

    if (path === '/api/esession/rsvp' && req.method === 'PUT') {
      const sessionId = typeof body.sessionId === 'string' && ID_PATTERN.test(body.sessionId) ? body.sessionId : null;
      const inviteeId = typeof body.inviteeId === 'string' && ID_PATTERN.test(body.inviteeId) ? body.inviteeId : null;
      const rsvp = body.rsvp === null ? null : toRsvp(body.rsvp);
      if (!sessionId || !inviteeId || (body.rsvp !== null && !rsvp)) {
        sendJson(res, 400, { error: 'invalid_rsvp' });
        return;
      }
      const rsvps = { ...state.rsvps };
      if (rsvp) rsvps[`${sessionId}|${inviteeId}`] = rsvp;
      else delete rsvps[`${sessionId}|${inviteeId}`];
      state = { ...state, rsvps };
      publish();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (path === '/api/esession/sessions' && req.method === 'POST') {
      const session = toSession(body.session);
      const at = typeof body.at === 'string' && STAMP_PATTERN.test(body.at) ? body.at : null;
      const from = text(body.from, 120);
      if (!session || !at || !from) {
        sendJson(res, 400, { error: 'invalid_session' });
        return;
      }
      if (!state.sessions.some((entry) => entry.id === session.id)) {
        state = { ...state, sessions: [...state.sessions, session] };
        addNotice({ kind: 'scheduled', sessionId: session.id, at, from });
        publish();
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    const sessionMatch = path.match(/^\/api\/esession\/sessions\/([A-Za-z0-9:_-]{1,64})$/);
    if (sessionMatch && req.method === 'PUT') {
      const session = toSession(body.session);
      const at = typeof body.at === 'string' && STAMP_PATTERN.test(body.at) ? body.at : null;
      const from = text(body.from, 120);
      const changes = text(body.changes, 300);
      const previous = state.sessions.find((entry) => entry.id === sessionMatch[1]);
      if (!session || session.id !== sessionMatch[1] || !at || !from || !changes) {
        sendJson(res, 400, { error: 'invalid_session' });
        return;
      }
      if (!previous) {
        sendJson(res, 404, { error: 'session_not_found' });
        return;
      }
      if (state.started.includes(session.id)) {
        sendJson(res, 409, { error: 'already_started' });
        return;
      }
      // The kind of session and its committee are fixed once it is scheduled.
      if (previous.type !== session.type || previous.committeeId !== session.committeeId) {
        sendJson(res, 400, { error: 'invalid_session' });
        return;
      }
      // A new date or time clears the responses: everyone confirms again for the new schedule.
      const prefix = `${session.id}|`;
      const rescheduled = previous.date !== session.date || previous.time !== session.time;
      state = {
        ...state,
        sessions: state.sessions.map((entry) => (entry.id === session.id ? session : entry)),
        rsvps: rescheduled ? Object.fromEntries(Object.entries(state.rsvps).filter(([key]) => !key.startsWith(prefix))) : state.rsvps,
      };
      addNotice({ kind: 'updated', sessionId: session.id, text: changes, at, from });
      publish();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (sessionMatch && req.method === 'DELETE') {
      const id = sessionMatch[1];
      if (state.started.includes(id)) {
        sendJson(res, 409, { error: 'already_started' });
        return;
      }
      const prefix = `${id}|`;
      state = {
        ...state,
        sessions: state.sessions.filter((entry) => entry.id !== id),
        rsvps: Object.fromEntries(Object.entries(state.rsvps).filter(([key]) => !key.startsWith(prefix))),
        notices: state.notices.filter((notice) => notice.sessionId !== id),
      };
      publish();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (path === '/api/esession/presence' && req.method === 'POST') {
      const id = typeof body.deviceId === 'string' && ID_PATTERN.test(body.deviceId) ? body.deviceId : null;
      const platform = DEVICE_PLATFORMS.includes(body.platform) ? body.platform : null;
      if (!id || !platform) {
        sendJson(res, 400, { error: 'invalid_presence' });
        return;
      }
      const now = Date.now();
      const account = toAccount(body.account);
      const previous = state.devices.find((device) => device.id === id);
      const next = {
        id,
        platform,
        model: text(body.model, 80) ?? 'Phone',
        os: text(body.os, 40) ?? '',
        account,
        online: body.leaving !== true,
        // A phone that was offline and comes back starts a new connection.
        connectedAt: previous?.online ? previous.connectedAt : now,
        lastSeen: now,
      };
      const changed =
        !previous ||
        previous.online !== next.online ||
        previous.account?.inviteeId !== account?.inviteeId ||
        previous.model !== next.model ||
        previous.platform !== next.platform;
      state = { ...state, devices: previous ? state.devices.map((device) => (device.id === id ? next : device)) : [...state.devices, next] };
      // Routine check-ins only refresh lastSeen; tell the browsers only when something visible changed.
      if (changed) publish();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (path === '/api/esession/announce' && req.method === 'POST') {
      const sessionId = typeof body.sessionId === 'string' && ID_PATTERN.test(body.sessionId) ? body.sessionId : null;
      const message = text(body.text, 200);
      const at = typeof body.at === 'string' && STAMP_PATTERN.test(body.at) ? body.at : null;
      const from = text(body.from, 120);
      if (!sessionId || !message || !at || !from) {
        sendJson(res, 400, { error: 'invalid_announcement' });
        return;
      }
      addNotice({ kind: 'announcement', sessionId, text: message, at, from });
      publish();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (path === '/api/esession/remind' && req.method === 'POST') {
      const sessionId = typeof body.sessionId === 'string' && ID_PATTERN.test(body.sessionId) ? body.sessionId : null;
      const inviteeIds = Array.isArray(body.inviteeIds) ? body.inviteeIds.filter((id) => typeof id === 'string' && ID_PATTERN.test(id)).slice(0, 100) : [];
      const at = typeof body.at === 'string' && STAMP_PATTERN.test(body.at) ? body.at : null;
      const from = text(body.from, 120);
      if (!sessionId || inviteeIds.length === 0 || !at || !from) {
        sendJson(res, 400, { error: 'invalid_reminder' });
        return;
      }
      addNotice({ kind: 'reminder', sessionId, inviteeIds, at, from });
      publish();
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  }

  /** Called by the rooms server when a session's e-session starts: from then on it stays as scheduled. */
  eSessionSyncHandler.markStarted = (sessionId) => {
    if (typeof sessionId !== 'string' || state.started.includes(sessionId)) return;
    state = { ...state, started: [...state.started, sessionId] };
    publish();
  };
  return eSessionSyncHandler;
}
