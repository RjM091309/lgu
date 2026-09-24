import { useSyncExternalStore } from 'react';
import { toast } from '@/components/ui/toast';
import { STORES, requestPersistentStorage, runTransaction, storageErrorMessage } from '@/lib/app-db';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscribeRequest {
  audio: Float32Array;
  model: string;
  // Whisper in the browser cannot detect the language, so it is always chosen.
  language: string;
}

export type TranscribeResponse =
  | { type: 'model-progress'; loaded: number; total: number }
  | { type: 'device'; device: 'webgpu' | 'wasm' }
  | { type: 'model-ready' }
  | { type: 'segments'; segments: TranscriptSegment[]; processedSeconds: number; totalSeconds: number }
  | { type: 'done' }
  | { type: 'error'; message: string };

export const STT_MODELS = {
  standard: { id: 'onnx-community/whisper-base', label: 'Standard (better accuracy)' },
  fast: { id: 'onnx-community/whisper-tiny', label: 'Fast (lower accuracy)' },
} as const;
export type SttModel = keyof typeof STT_MODELS;

export const STT_LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'tagalog', label: 'Filipino / Tagalog' },
] as const;

export type TranscriptStatus = 'loading' | 'idle' | 'preparing' | 'model' | 'transcribing' | 'done' | 'error';

export interface TranscriptState {
  status: TranscriptStatus;
  segments: TranscriptSegment[];
  // 0–1 for the current stage (model download or transcription).
  progress: number;
  message?: string;
  device?: 'webgpu' | 'wasm';
  createdAt?: string;
  // Where finished captions came from: transcribed in this browser, or prepared and shipped with the app.
  source?: 'saved' | 'bundled';
}

interface SavedTranscript {
  id: string;
  segments: TranscriptSegment[];
  model: string;
  language: string;
  device?: 'webgpu' | 'wasm';
  createdAt: string;
}

const SAMPLE_RATE = 16_000;
const LOADING: TranscriptState = { status: 'loading', segments: [], progress: 0 };

const states = new Map<string, TranscriptState>();
const listeners = new Set<() => void>();
const workers = new Map<string, Worker>();
const bundledSources = new Map<string, string>();

const setState = (key: string, next: TranscriptState) => {
  states.set(key, next);
  listeners.forEach((listener) => listener());
};

const patchState = (key: string, changes: Partial<TranscriptState>) => setState(key, { ...(states.get(key) ?? LOADING), ...changes });

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// A transcript belongs to one exact recording; replacing the file (new name or size) needs a new transcript.
export const transcriptKey = (file: { id: string; name: string; size: number | null }) => `${file.id}|${file.name}|${file.size ?? 0}`;

const parseVttTime = (value: string) => {
  const parts = value.trim().split(':').map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
};

// Reads the cues of a WebVTT caption file (the format written by toVtt below).
export const parseVtt = (content: string): TranscriptSegment[] =>
  content
    .replace(/\r/g, '')
    .split(/\n\n+/)
    .map((block) => block.split('\n'))
    .flatMap((lines) => {
      const timing = lines.findIndex((line) => line.includes('-->'));
      if (timing < 0) return [];
      const [start, end] = lines[timing].split('-->').map((part) => parseVttTime(part.split(' ').filter(Boolean)[0] ?? ''));
      const text = lines.slice(timing + 1).join(' ').trim();
      return text && Number.isFinite(start) && Number.isFinite(end) ? [{ start, end, text }] : [];
    });

const loadBundled = async (src: string) => {
  const response = await fetch(src);
  if (!response.ok) throw new Error('Transcript file not found.');
  return parseVtt(await response.text());
};

// A transcript made in this browser wins over the prepared one shipped with the app.
const loadSaved = async (key: string) => {
  let next: TranscriptState = { status: 'idle', segments: [], progress: 0 };
  try {
    const saved = (await runTransaction(STORES.transcripts, 'readonly', (store) => store.get(key))) as SavedTranscript | undefined;
    if (saved) next = { status: 'done', segments: saved.segments, progress: 1, device: saved.device, createdAt: saved.createdAt, source: 'saved' };
  } catch {
    // Storage unavailable: fall back to the prepared transcript, if any.
  }
  const bundled = bundledSources.get(key);
  if (next.status === 'idle' && bundled) {
    try {
      next = { status: 'done', segments: await loadBundled(bundled), progress: 1, source: 'bundled' };
    } catch {
      // No prepared transcript reachable: the user can still transcribe.
    }
  }
  if (states.get(key)?.status === 'loading') setState(key, next);
};

const reload = (key: string) => {
  setState(key, LOADING);
  void loadSaved(key);
};

export const useTranscript = (key: string | null, bundledSrc?: string): TranscriptState | null =>
  useSyncExternalStore(subscribe, () => {
    if (!key) return null;
    if (bundledSrc) bundledSources.set(key, bundledSrc);
    const existing = states.get(key);
    if (existing) return existing;
    states.set(key, LOADING);
    void loadSaved(key);
    return LOADING;
  });

// Decodes any browser-playable audio/video into 16 kHz mono samples, the format Whisper expects.
const decodeAudio = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('The recording could not be read.');
  const data = await response.arrayBuffer();
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const buffer = await context.decodeAudioData(data);
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < samples.length; i += 1) mono[i] += samples[i] / buffer.numberOfChannels;
  }
  return mono;
};

const finishJob = (key: string) => {
  workers.get(key)?.terminate();
  workers.delete(key);
};

export const isTranscribing = () => workers.size > 0;

export const startTranscription = async (key: string, fileName: string, url: string, model: SttModel, language: string) => {
  if (workers.size > 0) {
    toast('Transcription not started', 'Another recording is being transcribed. Wait for it to finish or cancel it first.', 'error');
    return;
  }
  setState(key, { status: 'preparing', segments: [], progress: 0, message: 'Reading the recording…' });

  let audio: Float32Array;
  try {
    audio = await decodeAudio(url);
  } catch {
    setState(key, { status: 'error', segments: [], progress: 0, message: 'This recording could not be decoded for transcription.' });
    toast('Transcription failed', `${fileName} could not be decoded. Try an MP3, WAV, M4A or MP4 file.`, 'error');
    return;
  }

  const worker = new Worker(new URL('../workers/transcribe.worker.ts', import.meta.url), { type: 'module' });
  workers.set(key, worker);
  patchState(key, { status: 'model', progress: 0, message: 'Loading the speech model…' });

  worker.onmessage = async (event: MessageEvent<TranscribeResponse>) => {
    const message = event.data;
    const current = states.get(key);
    if (!current) return;
    switch (message.type) {
      case 'model-progress':
        patchState(key, { progress: message.total > 0 ? message.loaded / message.total : 0 });
        break;
      case 'device':
        patchState(key, { device: message.device });
        break;
      case 'model-ready':
        patchState(key, { status: 'transcribing', progress: 0, message: 'Transcribing…' });
        break;
      case 'segments':
        patchState(key, {
          segments: [...current.segments, ...message.segments],
          progress: message.totalSeconds > 0 ? message.processedSeconds / message.totalSeconds : 1,
        });
        break;
      case 'done': {
        finishJob(key);
        const createdAt = new Date().toISOString();
        const record: SavedTranscript = { id: key, segments: current.segments, model: STT_MODELS[model].id, language, device: current.device, createdAt };
        try {
          await runTransaction(STORES.transcripts, 'readwrite', (store) => store.put(record));
          requestPersistentStorage();
          setState(key, { status: 'done', segments: current.segments, progress: 1, device: current.device, createdAt, source: 'saved' });
          toast('Transcription complete', `${fileName}: ${current.segments.length} caption line(s) saved.`);
        } catch (error) {
          setState(key, { status: 'done', segments: current.segments, progress: 1, device: current.device, createdAt });
          toast('Transcript not saved', `${storageErrorMessage(error)} The captions stay available until you refresh.`, 'error');
        }
        break;
      }
      case 'error':
        finishJob(key);
        setState(key, { status: 'error', segments: [], progress: 0, message: message.message });
        toast('Transcription failed', 'The speech model could not run. Check your internet connection for the first download, then try again.', 'error');
        break;
    }
  };
  worker.onerror = () => {
    finishJob(key);
    setState(key, { status: 'error', segments: [], progress: 0, message: 'The transcription worker stopped unexpectedly.' });
    toast('Transcription failed', 'The transcription stopped unexpectedly. Please try again.', 'error');
  };

  const request: TranscribeRequest = { audio, model: STT_MODELS[model].id, language };
  worker.postMessage(request, [audio.buffer]);
};

// Cancelling goes back to whatever existed before (a saved or prepared transcript, or nothing).
export const cancelTranscription = (key: string) => {
  finishJob(key);
  reload(key);
};

export const deleteTranscript = async (key: string): Promise<string | null> => {
  try {
    await runTransaction(STORES.transcripts, 'readwrite', (store) => store.delete(key));
  } catch (error) {
    return storageErrorMessage(error);
  }
  return null;
};

const pad = (value: number, size = 2) => String(value).padStart(size, '0');

export const formatClock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const vttTime = (seconds: number) => {
  const ms = Math.round(Math.max(0, seconds) * 1000);
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor((ms % 3_600_000) / 60_000))}:${pad(Math.floor((ms % 60_000) / 1000))}.${pad(ms % 1000, 3)}`;
};

// WebVTT is the standard caption format for web video/audio players.
export const toVtt = (segments: TranscriptSegment[]) =>
  ['WEBVTT', '', ...segments.flatMap((segment, index) => [String(index + 1), `${vttTime(segment.start)} --> ${vttTime(segment.end)}`, segment.text, ''])].join('\n');

export const toPlainText = (title: string, segments: TranscriptSegment[]) =>
  [title, '', ...segments.map((segment) => `[${formatClock(segment.start)}] ${segment.text}`)].join('\n');
