/// <reference lib="webworker" />
// Runs Whisper speech-to-text off the main thread so the page stays responsive during long recordings.
import { env, pipeline, type AutomaticSpeechRecognitionPipeline, type ProgressInfo } from '@huggingface/transformers';

import type { TranscribeRequest, TranscribeResponse, TranscriptSegment } from '@/lib/transcripts';

env.allowLocalModels = false;

const SAMPLE_RATE = 16_000;
const WINDOW_SECONDS = 30;
// Whisper tends to invent phrases ("Thank you.") over silence, so near-silent windows are skipped.
const SILENCE_RMS = 0.004;

const post = (message: TranscribeResponse) => self.postMessage(message);

// pipeline()'s own overloads are too complex for TypeScript to resolve, so it is used through this narrower signature.
const createAsr = pipeline as unknown as (
  task: 'automatic-speech-recognition',
  model: string,
  options: { device: 'webgpu' | 'wasm'; dtype: string | Record<string, string>; progress_callback: (info: ProgressInfo) => void }
) => Promise<AutomaticSpeechRecognitionPipeline>;

const loaded = new Map<string, Promise<AutomaticSpeechRecognitionPipeline>>();

const hasWebGpu = async () => {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    return !!gpu && !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
};

const loadModel = (model: string) => {
  const existing = loaded.get(model);
  if (existing) return existing;

  const files = new Map<string, { loaded: number; total: number }>();
  const onProgress = (info: ProgressInfo) => {
    if (info.status !== 'progress') return;
    files.set(info.file, { loaded: info.loaded, total: info.total });
    const totals = [...files.values()].reduce((sum, file) => ({ loaded: sum.loaded + file.loaded, total: sum.total + file.total }), { loaded: 0, total: 0 });
    post({ type: 'model-progress', loaded: totals.loaded, total: totals.total });
  };

  const promise = (async () => {
    // WebGPU (graphics card) is many times faster; plain WebAssembly on the CPU is the fallback.
    if (await hasWebGpu()) {
      try {
        const asr = await createAsr('automatic-speech-recognition', model, {
          device: 'webgpu',
          dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
          progress_callback: onProgress,
        });
        post({ type: 'device', device: 'webgpu' });
        return asr;
      } catch {
        // Some graphics drivers fail at load time; fall through to the CPU.
      }
    }
    const asr = await createAsr('automatic-speech-recognition', model, {
      device: 'wasm',
      dtype: 'q8',
      progress_callback: onProgress,
    });
    post({ type: 'device', device: 'wasm' });
    return asr;
  })();
  loaded.set(model, promise);
  promise.catch(() => loaded.delete(model));
  return promise;
};

const rms = (samples: Float32Array) => {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
};

self.onmessage = async (event: MessageEvent<TranscribeRequest>) => {
  const { audio, model, language } = event.data;
  try {
    const asr = await loadModel(model);
    post({ type: 'model-ready' });

    const windowSize = WINDOW_SECONDS * SAMPLE_RATE;
    const totalSeconds = audio.length / SAMPLE_RATE;
    let seek = 0;
    let previousText = '';

    // Whisper leaves out the last, unfinished sentence of each 30-second window. So instead of fixed steps,
    // each window starts where the previous window's last complete sentence ended, and no speech is lost.
    while (seek < audio.length) {
      const slice = audio.subarray(seek, Math.min(audio.length, seek + windowSize));
      const offset = seek / SAMPLE_RATE;
      const windowEnd = offset + slice.length / SAMPLE_RATE;
      const reachesEnd = seek + slice.length >= audio.length;
      const segments: TranscriptSegment[] = [];
      let advance = slice.length;

      if (slice.length > SAMPLE_RATE / 2 && rms(slice) > SILENCE_RMS) {
        const output = await asr(slice, { return_timestamps: true, task: 'transcribe', language });
        const result = Array.isArray(output) ? output[0] : output;
        const chunks = result.chunks?.length ? result.chunks : [{ text: result.text, timestamp: [0, null] as [number, number | null] }];
        const complete = chunks.filter((chunk) => chunk.timestamp[1] !== null);
        const lastEnd = complete.length > 0 ? (complete[complete.length - 1].timestamp[1] ?? 0) : 0;
        // Keep everything on the final window, or when no sentence finished (one long utterance); otherwise only finished sentences.
        const keep = reachesEnd || lastEnd < 1 ? chunks : complete;
        if (!reachesEnd && lastEnd >= 1) advance = Math.round(lastEnd * SAMPLE_RATE);

        for (const chunk of keep) {
          const text = chunk.text.trim();
          // Drop empty chunks and immediate repeats, a common Whisper failure on long pauses.
          if (!text || text === previousText) continue;
          previousText = text;
          const start = Math.min(windowEnd, offset + (chunk.timestamp[0] ?? 0));
          const end = Math.min(windowEnd, offset + (chunk.timestamp[1] ?? slice.length / SAMPLE_RATE));
          segments.push({ start, end: Math.max(start, end), text });
        }
      }

      seek += advance;
      post({ type: 'segments', segments, processedSeconds: Math.min(totalSeconds, seek / SAMPLE_RATE), totalSeconds });
    }
    post({ type: 'done' });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
