import { STORES, runTransaction } from '@/lib/app-db';
import { withWebmDuration } from '@/lib/media-duration';

// A running copy of an e-session recording on the recording device. The recorder hands over a piece every
// second; each is written here at once, so if the tab crashes, the page reloads or the battery dies, what was
// recorded so far is still on the device and the next visit to E-Session offers to save it. A recording that
// stops normally is saved to Session Files and its copy here is removed.

export interface RecordingBackup {
  id: string;
  sessionId: string;
  title: string;
  mimeType: string;
  /** Epoch milliseconds. */
  startedAt: number;
  /** When the last piece was written (epoch ms): a backup that stopped growing was left behind. */
  lastChunkAt: number;
  chunks: number;
}

/** A backup that has not grown for this long belongs to no running recording. */
const ABANDONED_MS = 15_000;

const chunkId = (id: string, seq: number) => `${id}:${String(seq).padStart(7, '0')}`;
const chunksOf = (id: string) => IDBKeyRange.bound(`${id}:`, `${id}:￿`);

/** Starts a backup for a new recording; returns its id. Storage problems are ignored: the recording goes on. */
export const startBackup = (details: Pick<RecordingBackup, 'sessionId' | 'title' | 'mimeType' | 'startedAt'>) => {
  const backup: RecordingBackup = { ...details, id: `rec-${details.startedAt.toString(36)}-${Math.random().toString(36).slice(2, 6)}`, lastChunkAt: details.startedAt, chunks: 0 };
  void runTransaction(STORES.recordings, 'readwrite', (store) => store.put(backup)).catch(() => undefined);
  return backup;
};

/** Writes the next piece of a recording. */
export const backupChunk = (backup: RecordingBackup, seq: number, blob: Blob) => {
  backup.chunks = Math.max(backup.chunks, seq + 1);
  backup.lastChunkAt = Date.now();
  const record = { ...backup };
  void runTransaction(STORES.recordingChunks, 'readwrite', (store) => store.put({ id: chunkId(backup.id, seq), blob }))
    .then(() => runTransaction(STORES.recordings, 'readwrite', (store) => store.put(record)))
    .catch(() => undefined);
};

/** Removes a backup once its recording is safely in Session Files (or downloaded, or discarded). */
export const discardBackup = (id: string) =>
  Promise.all([
    runTransaction(STORES.recordingChunks, 'readwrite', (store) => store.delete(chunksOf(id))),
    runTransaction(STORES.recordings, 'readwrite', (store) => store.delete(id)),
  ]).catch(() => undefined);

/** Recordings that stopped without being saved: the tab closed, crashed or lost power while recording. */
export const findAbandonedBackups = async (): Promise<RecordingBackup[]> => {
  try {
    const all = ((await runTransaction(STORES.recordings, 'readonly', (store) => store.getAll())) ?? []) as RecordingBackup[];
    return all.filter((backup) => Date.now() - backup.lastChunkAt > ABANDONED_MS).sort((a, b) => a.startedAt - b.startedAt);
  } catch {
    return [];
  }
};

/** Puts a backup's pieces back together into one playable file. */
export const assembleBackup = async (backup: RecordingBackup): Promise<Blob> => {
  const chunks = ((await runTransaction(STORES.recordingChunks, 'readonly', (store) => store.getAll(chunksOf(backup.id)))) ?? []) as { id: string; blob: Blob }[];
  const blob = new Blob(
    chunks.sort((a, b) => a.id.localeCompare(b.id)).map((chunk) => chunk.blob),
    { type: backup.mimeType.split(';')[0] }
  );
  // Written as a stream, the file has no length of its own; add it so players can seek anywhere.
  return withWebmDuration(blob, backup.lastChunkAt - backup.startedAt).catch(() => blob);
};
