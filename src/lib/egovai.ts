// Client for the DICT eGovAI Agent Engine, reached through our own proxy (/api/egovai/*).
// When the proxy has no credentials yet, the chat runs a local demo engine over the sample records
// so the flow can be shown before the LGU's eGovAI access is approved.

import { LGU_PROFILE, mockBills, mockSessions } from '@/lib/mock-data';
import { formatLongDate } from '@/lib/sessions';

export interface PendingConfirmation {
  token: string;
  message: string;
}

export type EgovAiEvent =
  | { type: 'progress'; label: string }
  | { type: 'chunk'; content: string }
  | { type: 'complete'; sessionId: string | null; sources: string[]; pendingConfirmation: PendingConfirmation | null }
  | { type: 'error'; message: string };

export interface AskOptions {
  question: string;
  sessionId: string | null;
  confirmation?: { token: string; approved: boolean };
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

const DEMO_CONFIRM_TOKEN = 'demo-subscribe-session-notices';

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

const STOP_WORDS = new Set(
  'ang ng mga sa na at ba po ko mo ano sino kailan saan paano may meron para yung iyong the of and for a an in on to is are what when where how about ordinance ordinansa resolution resolusyon capas'.split(' ')
);

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

// Everyday and Tagalog/Taglish words mapped to the terms used in the sample records.
const SYNONYMS: Record<string, string[]> = {
  garbage: ['waste', 'littering', 'segregation'],
  trash: ['waste', 'littering'],
  rubbish: ['waste', 'littering'],
  fines: ['penalties'],
  fine: ['penalties'],
  farmer: ['farmers', 'agriculture'],
  hospital: ['health'],
  basura: ['waste', 'littering', 'segregation'],
  kalat: ['littering'],
  traysikel: ['tricycle', 'tricycles'],
  pamasahe: ['fare'],
  palengke: ['market'],
  puwesto: ['stall'],
  iskolar: ['scholarship'],
  scholar: ['scholarship'],
  magsasaka: ['farmers', 'agriculture'],
  pataba: ['fertilizer'],
  binhi: ['seed'],
  kalsada: ['road'],
  daan: ['road'],
  bagyo: ['disaster'],
  baha: ['flood', 'disaster'],
  sakuna: ['disaster'],
  kalusugan: ['health'],
  laboratoryo: ['laboratory'],
  bundok: ['pinatubo'],
  turista: ['tourism'],
  multa: ['penalties'],
};

function findRelatedBills(question: string) {
  const words = tokenize(question).flatMap((word) => [word, ...(SYNONYMS[word] ?? [])]);
  if (!words.length) return [];
  return mockBills
    .map((bill) => {
      const haystack = tokenize(`${bill.title} ${bill.description} ${bill.subject ?? ''} ${bill.category} ${bill.number}`);
      // Prefix matching ("tricycle" ~ "tricycles") only for longer words, so "status" doesn't match "Sta.".
      const matches = (h: string, word: string) =>
        h === word || (h.length >= 4 && word.length >= 4 && (h.startsWith(word) || word.startsWith(h)));
      const score = words.reduce((total, word) => total + (haystack.some((h) => matches(h, word)) ? 1 : 0), 0);
      return { bill, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.bill);
}

interface DemoAnswer {
  progress: string[];
  text: string;
  sources: string[];
  pendingConfirmation?: PendingConfirmation;
}

function buildDemoAnswer(question: string, confirmation?: { token: string; approved: boolean }): DemoAnswer {
  const q = question.toLowerCase();

  if (confirmation?.token === DEMO_CONFIRM_TOKEN) {
    return {
      progress: ['Processing subscription'],
      text: 'You are now subscribed to **session notices** of the Sangguniang Bayan. You will be notified before every regular session, special session, and public hearing.\n\n_(This is a demo only; no actual subscription was made.)_',
      sources: ['Notification service (demo)'],
    };
  }

  if (/(subscribe|abisuhan|notify|paalala|remind)/.test(q)) {
    return {
      progress: ['Preparing action'],
      text: 'I can subscribe you to session notices so you are notified before every session and public hearing.',
      sources: [],
      pendingConfirmation: {
        token: DEMO_CONFIRM_TOKEN,
        message: 'Subscribe you to Sangguniang Bayan session notices?',
      },
    };
  }

  if (/\b(session|sesyon|hearing|pagdinig|schedule|iskedyul|kailan)\b/.test(q)) {
    const lines = mockSessions.map(
      (session) => `- **${session.title}** (${session.type}): ${formatLongDate(session.date)}, ${session.time}, ${session.location}`
    );
    return {
      progress: ['Checking the session calendar'],
      text: `Here are the scheduled sessions and hearings of the Sangguniang Bayan:\n\n${lines.join('\n')}\n\nSessions are open to the public. To speak at a public hearing, please coordinate with the SB Secretariat first.`,
      sources: ['Session Calendar'],
    };
  }

  if (/\b(contact|makipag-?ugnayan|email|telepono|numero|opisina|address|saan)\b/.test(q)) {
    return {
      progress: ['Retrieving contact information'],
      text: `You can reach the SB Secretariat here:\n\n- **Office:** ${LGU_PROFILE.address}\n- **Email:** ${LGU_PROFILE.email}\n- **Viber:** ${LGU_PROFILE.viber}`,
      sources: ['LGU Profile'],
    };
  }

  const related = findRelatedBills(question);
  if (related.length) {
    const [top, ...others] = related;
    const parts = [
      `Based on the Sanggunian's records, the closest match is **${top.number}**: ${top.title}.`,
      '',
      top.description,
      '',
      `- **Status:** ${top.status}`,
      `- **Committee:** ${top.committee ?? top.author}`,
      top.actionTaken ? `- **Latest action:** ${top.actionTaken}` : '',
    ];
    if (others.length) {
      parts.push('', 'Possibly related:', ...others.map((bill) => `- **${bill.number}**: ${bill.title}`));
    }
    return {
      progress: ['Searching ordinances and resolutions', `Reading ${top.number}`],
      text: parts.filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n'),
      sources: related.map((bill) => bill.number),
    };
  }

  return {
    progress: ['Searching ordinances and resolutions'],
    text: `I couldn't find an ordinance or resolution on that in the records available to me. Try rephrasing your question, or contact the SB Secretariat at ${LGU_PROFILE.email}.`,
    sources: [],
  };
}

async function askDemo({ question, confirmation, signal, onEvent }: AskOptions) {
  if (confirmation && !confirmation.approved) return;
  const answer = buildDemoAnswer(question, confirmation);

  for (const label of answer.progress) {
    onEvent({ type: 'progress', label });
    await wait(550, signal);
  }
  // Stream a few words at a time, like the real generate_stream endpoint.
  const pieces = answer.text.match(/\S+\s*/g) ?? [];
  for (let i = 0; i < pieces.length; i += 3) {
    onEvent({ type: 'chunk', content: pieces.slice(i, i + 3).join('') });
    await wait(45, signal);
  }
  onEvent({
    type: 'complete',
    sessionId: 'demo-session',
    sources: answer.sources,
    pendingConfirmation: answer.pendingConfirmation ?? null,
  });
}
