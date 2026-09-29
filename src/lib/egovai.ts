// Client for the DICT eGovAI Agent Engine, reached through our own proxy (/api/egovai/*).
// When the proxy has no credentials yet, the chat runs the local LIMS assistant (lims-assistant.ts) over
// the sample records so the flow can be shown before the LGU's eGovAI access is approved.

import { answerQuestion } from '@/lib/lims-assistant';

export interface PendingConfirmation {
  token: string;
  message: string;
}

export type EgovAiEvent =
  | { type: 'progress'; label: string }
  | { type: 'chunk'; content: string }
  | {
      type: 'complete';
      sessionId: string | null;
      sources: string[];
      pendingConfirmation: PendingConfirmation | null;
      /** Suggested next questions (demo engine only). */
      followUps?: string[];
    }
  | { type: 'error'; message: string };

export interface AskOptions {
  question: string;
  sessionId: string | null;
  confirmation?: { token: string; approved: boolean };
  /** The portal's language; the demo engine answers in it when the question doesn't show a language. */
  lang?: 'EN' | 'FIL';
  signal: AbortSignal;
  onEvent: (event: EgovAiEvent) => void;
}

export type EgovAiMode = 'live' | 'demo';

export async function getEgovAiMode(): Promise<EgovAiMode> {
  try {
    const res = await fetch('/api/egovai/status');
    if (!res.ok) return 'demo';
    const data = await res.json();
    return data?.configured ? 'live' : 'demo';
  } catch {
    return 'demo';
  }
}

export function ask(mode: EgovAiMode, options: AskOptions): Promise<void> {
  return mode === 'live' ? askLive(options) : askDemo(options);
}

// ---------------------------------------------------------------------------
// Live engine (Server-Sent Events from eGovAI, passed through the proxy)
// ---------------------------------------------------------------------------

const FRIENDLY_ERROR = 'The assistant is unable to answer right now. Please try again later.';

async function askLive({ question, sessionId, confirmation, signal, onEvent }: AskOptions) {
  const res = await fetch('/api/egovai/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, session_id: sessionId, ...(confirmation ? { confirmation } : {}) }),
    signal,
  });
  if (!res.ok || !res.body) {
    onEvent({ type: 'error', message: FRIENDLY_ERROR });
    return;
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let finished = false;

  const emit = (event: EgovAiEvent | null) => {
    if (!event || finished) return;
    if (event.type === 'complete' || event.type === 'error') finished = true;
    onEvent(event);
  };

  while (!finished) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    // SSE messages are separated by a blank line.
    let boundary: RegExpExecArray | null;
    while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
      emit(parseSseMessage(buffer.slice(0, boundary.index)));
      buffer = buffer.slice(boundary.index + boundary[0].length);
    }
  }
  if (buffer.trim()) emit(parseSseMessage(buffer));
  if (!finished) onEvent({ type: 'error', message: FRIENDLY_ERROR });
  reader.cancel().catch(() => {});
}

// The docs name the events (progress, chunk, complete, error) but not the exact field names, so accept
// the event name from either the SSE "event:" line or a "type"/"event" field, and common content keys.
function parseSseMessage(raw: string): EgovAiEvent | null {
  let eventName = '';
  const dataLines: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
  }
  if (!dataLines.length) return null;
  const dataText = dataLines.join('\n');
  if (dataText === '[DONE]') return { type: 'complete', sessionId: null, sources: [], pendingConfirmation: null };

  let data: Record<string, any>;
  try {
    data = JSON.parse(dataText);
  } catch {
    // Plain-text data is treated as answer content.
    return { type: 'chunk', content: dataText };
  }
  const payload = data.data && typeof data.data === 'object' ? { ...data, ...data.data } : data;
  const type = String(eventName || payload.type || payload.event || '').toLowerCase();
  const text = (value: unknown) => (typeof value === 'string' ? value : '');

  switch (type) {
    case 'progress':
      return { type: 'progress', label: text(payload.label) || text(payload.stage) || 'Thinking…' };
    case 'chunk':
      return { type: 'chunk', content: text(payload.content) || text(payload.text) || text(payload.delta) || text(payload.chunk) };
    case 'complete':
      return {
        type: 'complete',
        sessionId: text(payload.session_id) || null,
        sources: toSourceLabels(payload.source_activities),
        pendingConfirmation: toPendingConfirmation(payload.pending_confirmation),
      };
    case 'error':
      return { type: 'error', message: FRIENDLY_ERROR };
    default:
      return null;
  }
}

function toSourceLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const labels = value
    .map((item) =>
      typeof item === 'string' ? item : item && typeof item === 'object' ? String(item.title ?? item.label ?? item.name ?? item.source ?? '') : ''
    )
    .filter(Boolean);
  return [...new Set(labels)];
}

function toPendingConfirmation(value: unknown): PendingConfirmation | null {
  if (!value || typeof value !== 'object') return null;
  const { token, message } = value as Record<string, unknown>;
  if (typeof token !== 'string' || !token) return null;
  return { token, message: typeof message === 'string' && message ? message : 'Continue with this action?' };
}

// ---------------------------------------------------------------------------
// Demo engine (sample records only, no network)
// ---------------------------------------------------------------------------

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });

let demoSessionCounter = 0;

async function askDemo({ question, sessionId, confirmation, lang = 'EN', signal, onEvent }: AskOptions) {
  if (confirmation && !confirmation.approved) return;
  // Each conversation gets its own id, so follow-up questions ("who sponsored it?") refer to this chat only.
  const conversationId = sessionId ?? `demo-${Date.now()}-${demoSessionCounter++}`;
  const answer = answerQuestion(question, { sessionId: conversationId, uiLang: lang, confirmationToken: confirmation?.token });

  for (const label of answer.progress) {
    onEvent({ type: 'progress', label });
    await wait(450, signal);
  }
  // Stream a few words at a time, like the real generate_stream endpoint.
  const pieces = answer.text.match(/\S+\s*/g) ?? [];
  for (let i = 0; i < pieces.length; i += 3) {
    onEvent({ type: 'chunk', content: pieces.slice(i, i + 3).join('') });
    await wait(35, signal);
  }
  onEvent({
    type: 'complete',
    sessionId: conversationId,
    sources: answer.sources,
    pendingConfirmation: answer.pendingConfirmation ?? null,
    followUps: answer.followUps,
  });
}
