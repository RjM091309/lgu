// Files added to Session Files during the demo (uploads, e-session recordings and attendance records, attached
// media, amendments), kept on the LIMS server so every device sees the same folders. The contents go to a cache
// folder that is emptied whenever the server starts, so a restart returns Session Files to the sample files that
// ship with the app, like the rest of the demo data. The list of files itself travels with the E-Session sync state.

import { createReadStream, createWriteStream, mkdirSync, renameSync, rmSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = fileURLToPath(new URL('../node_modules/.cache/lims-session-files', import.meta.url));
// Recordings of a long sitting can pass the 100 MB limit of a manual upload.
const MAX_FILE_BYTES = 250 * 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

const CATEGORIES = ['Agenda', 'Order of Business', 'Minutes', 'Audio Recording', 'Video Recording', 'Enacted Ordinance', 'Resolution', 'Supporting Document'];
const KINDS = ['pdf', 'audio', 'video', 'image', 'other'];
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = {
  pdf: 'application/pdf',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  webm: 'video/webm',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
};

const text = (value, max) => (typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null);

/** The details of a file as the browser describes them; anything unexpected is dropped. */
export const toFileMeta = (value) => {
  const name = text(value?.name, 200);
  const category = CATEGORIES.includes(value?.category) ? value.category : null;
  const kind = KINDS.includes(value?.kind) ? value.kind : null;
  const sessionId = typeof value?.sessionId === 'string' && ID_PATTERN.test(value.sessionId) ? value.sessionId : null;
  const uploadedAt = typeof value?.uploadedAt === 'string' && DATE_PATTERN.test(value.uploadedAt) ? value.uploadedAt : null;
  const uploadedBy = text(value?.uploadedBy, 120);
  if (!name || !category || !kind || !sessionId || !uploadedAt || !uploadedBy) return null;
  const optional = {
    uploadedByRole: text(value.uploadedByRole, 120),
    versionOf: typeof value.versionOf === 'string' && ID_PATTERN.test(value.versionOf) ? value.versionOf : null,
    version: Number.isInteger(value.version) && value.version > 0 && value.version < 1000 ? value.version : null,
    changeNote: text(value.changeNote, 500),
    note: text(value.note, 500),
  };
  return {
    name,
    category,
    kind,
    sessionId,
    uploadedAt,
    uploadedBy,
    source: value.source === 'system' ? 'system' : 'upload',
    ...Object.fromEntries(Object.entries(optional).filter(([, entry]) => entry !== null)),
  };
};

export const isFileId = (value) => typeof value === 'string' && ID_PATTERN.test(value);

export function createFileStore() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  const sizes = new Map();
  const total = () => [...sizes.values()].reduce((sum, size) => sum + size, 0);
  const pathOf = (id) => path.join(DIR, id);

  return {
    /** Writes the request body as the file's contents. Resolves to its size, or rejects with a reason code. */
    save: (req, id) =>
      new Promise((resolve, reject) => {
        const declared = Number(req.headers['content-length']);
        if (Number.isFinite(declared) && declared > MAX_FILE_BYTES) return reject(new Error('too_large'));
        if (total() - (sizes.get(id) ?? 0) + (Number.isFinite(declared) ? declared : 0) > MAX_TOTAL_BYTES) return reject(new Error('store_full'));
        const temp = `${pathOf(id)}.part`;
        const out = createWriteStream(temp);
        let size = 0;
        let failed = false;
        const fail = (reason) => {
          if (failed) return;
          failed = true;
          out.destroy();
          try {
            unlinkSync(temp);
          } catch {
            // Never written.
          }
          reject(new Error(reason));
        };
        req.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_FILE_BYTES) {
            fail('too_large');
            req.destroy();
          }
        });
        req.on('error', () => fail('upload_failed'));
        out.on('error', () => fail('upload_failed'));
        out.on('finish', () => {
          if (failed) return;
          if (size === 0) return fail('empty');
          try {
            // Renamed into place only when complete, so a broken upload never replaces a good file.
            renameSync(temp, pathOf(id));
            sizes.set(id, size);
            resolve(size);
          } catch {
            fail('upload_failed');
          }
        });
        req.pipe(out);
      }),

    /** Streams a file's contents, with byte ranges so audio and video can be scrubbed. */
    send: (req, res, id, name) => {
      const size = sizes.get(id);
      if (size === undefined) {
        res.statusCode = 404;
        res.end();
        return;
      }
      const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
      res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(name)}`);
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        if (start >= size || start > end) {
          res.statusCode = 416;
          res.setHeader('Content-Range', `bytes */${size}`);
          res.end();
          return;
        }
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
        res.setHeader('Content-Length', end - start + 1);
        createReadStream(pathOf(id), { start, end }).pipe(res);
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Length', size);
      createReadStream(pathOf(id)).pipe(res);
    },

    has: (id) => sizes.has(id),

    remove: (id) => {
      sizes.delete(id);
      rmSync(pathOf(id), { force: true });
    },
  };
}
