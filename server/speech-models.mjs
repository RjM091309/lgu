// Speech-to-text for Session Files runs in the browser (Whisper, through @huggingface/transformers), which on its
// own downloads the speech model from huggingface.co and its runtime from a public CDN. A session hall may have no
// internet, so both come through the LIMS server instead: the runtime ships with the app (node_modules), and the
// model is fetched once while there is internet and kept here, after which every device on the network
// transcribes without it. Unlike the demo data, the kept models survive restarts.
//
// Used by the Vite dev/preview server (vite.config.ts) and by the production server (server/index.mjs).

import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Readable } from 'node:stream';

const CACHE_DIR = fileURLToPath(new URL('../node_modules/.cache/lims-speech-models', import.meta.url));
const RUNTIME_DIR = fileURLToPath(new URL('../node_modules/@huggingface/transformers/dist', import.meta.url));
const UPSTREAM = 'https://huggingface.co';
// Only the models the app offers (src/lib/transcripts.ts).
const MODELS = ['onnx-community/whisper-base', 'onnx-community/whisper-tiny'];
const RUNTIME_FILES = { 'ort-wasm-simd-threaded.jsep.mjs': 'text/javascript', 'ort-wasm-simd-threaded.jsep.wasm': 'application/wasm' };
const SAFE_PATH = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;
const TYPES = { json: 'application/json', onnx: 'application/octet-stream', txt: 'text/plain' };

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

const sendFile = (req, res, file, type) => {
  let size;
  try {
    ({ size } = statSync(file));
  } catch {
    return sendJson(res, 404, { error: 'not_found' });
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Length', size);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  if (req.method === 'HEAD') return res.end();
  createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res);
};

const folderSize = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
        const full = path.join(dir, entry.name);
        return sum + (entry.isDirectory() ? folderSize(full) : entry.name.endsWith('.part') ? 0 : statSync(full).size);
      }, 0)
    : 0;

/** @returns connect/express-style middleware handling /api/speech/* */
export function createSpeechModelHandler() {
  mkdirSync(CACHE_DIR, { recursive: true });
  // Downloads under way, so two devices asking for the same file at once share one download.
  const pending = new Map();

  const fetchToCache = (url, target) => {
    if (pending.has(target)) return pending.get(target);
    const job = (async () => {
      const upstream = await fetch(url, { redirect: 'follow' });
      if (!upstream.ok || !upstream.body) return upstream.status;
      mkdirSync(path.dirname(target), { recursive: true });
      const temp = `${target}.${process.pid}.part`;
      await new Promise((resolve, reject) => {
        const out = createWriteStream(temp);
        Readable.fromWeb(upstream.body).on('error', reject).pipe(out).on('finish', resolve).on('error', reject);
      });
      renameSync(temp, target);
      return 200;
    })().finally(() => pending.delete(target));
    pending.set(target, job);
    return job;
  };

  return async function speechModelHandler(req, res, next) {
    const rawPath = (req.url || '').split('?')[0];
    if (!rawPath.startsWith('/api/speech/')) return next();
    // A malformed address (e.g. a stray %) is turned away here instead of throwing.
    let urlPath;
    try {
      urlPath = decodeURIComponent(rawPath);
    } catch {
      return sendJson(res, 400, { error: 'invalid_path' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method_not_allowed' });

    // Which models this server already keeps, for the transcript panel.
    if (urlPath === '/api/speech/status') {
      return sendJson(res, 200, { models: Object.fromEntries(MODELS.map((model) => [model, folderSize(path.join(CACHE_DIR, model))])) });
    }

    const runtime = urlPath.match(/^\/api\/speech\/runtime\/([^/]+)$/);
    if (runtime) {
      const type = RUNTIME_FILES[runtime[1]];
      if (!type) return sendJson(res, 404, { error: 'not_found' });
      return sendFile(req, res, path.join(RUNTIME_DIR, runtime[1]), type);
    }

    // /api/speech/models/<org>/<name>/resolve/<revision>/<file path>, the layout the library asks for.
    const model = urlPath.match(/^\/api\/speech\/models\/([^/]+\/[^/]+)\/resolve\/([A-Za-z0-9._-]+)\/(.+)$/);
    // No `.` or `..` as the revision or a path part, so the cache path stays inside the model's folder.
    if (!model || !MODELS.includes(model[1]) || /^\.+$/.test(model[2]) || !SAFE_PATH.test(model[3]) || model[3].split('/').some((part) => /^\.+$/.test(part))) return sendJson(res, 404, { error: 'not_found' });
    const [, name, revision, file] = model;
    const target = path.join(CACHE_DIR, name, revision, file);
    const type = TYPES[file.split('.').pop()] ?? 'application/octet-stream';
    try {
      if (!existsSync(target)) {
        const status = await fetchToCache(`${UPSTREAM}/${name}/resolve/${revision}/${file}`, target);
        // The library asks for some optional files that a model does not have; it expects a plain 404 then.
        if (status !== 200) return sendJson(res, status === 404 ? 404 : 502, { error: status === 404 ? 'not_found' : 'upstream_failed' });
      }
      sendFile(req, res, target, type);
    } catch {
      rmSync(`${target}.${process.pid}.part`, { force: true });
      // No internet and not kept yet: the transcript panel explains what to do.
      sendJson(res, 503, { error: 'model_unavailable' });
    }
  };
}
