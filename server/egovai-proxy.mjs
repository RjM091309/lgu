// Server-side proxy for the DICT eGovAI Agent Engine API.
// The API key and secret never reach the browser: the chat UI calls /api/egovai/*, and this
// handler adds the credentials and forwards the request to eGovAI.
//
// Used by the Vite dev/preview server (vite.config.ts) and by the production server (server/index.mjs).

import { Readable } from 'node:stream';

const EGOVAI_BASE_URL = 'https://egov-ai-core-ws.e.gov.ph';
const STREAM_URL = `${EGOVAI_BASE_URL}/api/v1/engines/generate_stream`;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_QUESTION_LENGTH = 2000;
const UPSTREAM_TIMEOUT_MS = 120_000;

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
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
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });

// Forward only the fields eGovAI documents, so the browser can't smuggle anything else upstream.
const toUpstreamBody = (body) => {
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > MAX_QUESTION_LENGTH) return null;

  const upstream = {
    question,
    session_id: typeof body.session_id === 'string' && body.session_id ? body.session_id : null,
  };
  const confirmation = body.confirmation;
  if (confirmation && typeof confirmation.token === 'string' && typeof confirmation.approved === 'boolean') {
    upstream.confirmation = { token: confirmation.token, approved: confirmation.approved };
  }
  return upstream;
};

/**
 * @param {{ EGOVAI_API_KEY?: string, EGOVAI_API_SECRET?: string, EGOVAI_ENGINE_CODE?: string }} env
 * @returns connect/express-style middleware handling /api/egovai/status and /api/egovai/stream
 */
export function createEgovAiHandler(env) {
  const apiKey = env.EGOVAI_API_KEY?.trim();
  const apiSecret = env.EGOVAI_API_SECRET?.trim();
  const engineCode = env.EGOVAI_ENGINE_CODE?.trim();
  const configured = Boolean(apiKey && apiSecret && engineCode);

  return async function egovAiHandler(req, res, next) {
    const path = (req.url || '').split('?')[0];

    if (path === '/api/egovai/status' && req.method === 'GET') {
      sendJson(res, 200, { configured });
      return;
    }

    if (path !== '/api/egovai/stream') {
      next();
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }
    if (!configured) {
      sendJson(res, 503, { error: 'not_configured' });
      return;
    }

    let upstreamBody;
    try {
      upstreamBody = toUpstreamBody(await readJsonBody(req));
    } catch (error) {
      sendJson(res, error.message === 'too_large' ? 413 : 400, { error: error.message });
      return;
    }
    if (!upstreamBody) {
      sendJson(res, 400, { error: 'invalid_question' });
      return;
    }

    // Stop calling eGovAI if the visitor closes the chat or the answer takes too long.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    res.on('close', () => controller.abort());

    try {
      const upstream = await fetch(STREAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'X-EGOVAI-API-KEY': apiKey,
          'X-EGOVAI-API-SECRET': apiSecret,
          'X-EGOVAI-AGENT-ENGINE-CODE': engineCode,
        },
        body: JSON.stringify(upstreamBody),
        signal: controller.signal,
      });

      if (!upstream.ok || !upstream.body) {
        // Don't echo eGovAI's error body to the browser; it may describe the credentials.
        console.error(`[egovai] upstream responded ${upstream.status}`);
        sendJson(res, 502, { error: 'upstream_error', status: upstream.status });
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      Readable.fromWeb(upstream.body)
        .on('error', () => res.end())
        .pipe(res);
    } catch (error) {
      if (res.headersSent) {
        res.end();
      } else if (!res.writableEnded) {
        console.error('[egovai] request failed:', error.name === 'AbortError' ? 'timed out or cancelled' : error.message);
        sendJson(res, 504, { error: 'upstream_unreachable' });
      }
    } finally {
      clearTimeout(timeout);
    }
  };
}
