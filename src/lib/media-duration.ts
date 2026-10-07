// Browser recordings (MediaRecorder WebM) are written as a stream, so the file never says how long it is. Players
// then treat it as endless and only let you seek into the part already played. These two helpers fix that: one
// writes the length into a finished recording, the other makes an already-saved one seekable when it is played.

const EBML_HEADER = 0x1a45dfa3;
const SEGMENT = 0x18538067;
const INFO = 0x1549a966;
const DURATION = 0x4489;
const CLUSTER = 0x1f43b675;

/** Reads an EBML variable-length integer. IDs keep their length marker; sizes drop it. */
const readVint = (bytes: Uint8Array, pos: number, isId: boolean) => {
  if (pos >= bytes.length) return null;
  const first = bytes[pos];
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && !(first & mask)) {
    length += 1;
    mask >>= 1;
  }
  if (length > 8 || pos + length > bytes.length) return null;
  let value = isId ? first : first & (mask - 1);
  let allOnes = (first & (mask - 1)) === mask - 1;
  for (let i = 1; i < length; i += 1) {
    value = value * 256 + bytes[pos + i];
    if (bytes[pos + i] !== 0xff) allOnes = false;
  }
  return { value, length, unknown: !isId && allOnes };
};

/** Writes `value` as an EBML size of exactly `length` bytes. */
const writeSize = (value: number, length: number) => {
  const out = new Uint8Array(length);
  let rest = value;
  for (let i = length - 1; i >= 0; i -= 1) {
    out[i] = rest % 256;
    rest = Math.floor(rest / 256);
  }
  out[0] |= 0x80 >> (length - 1);
  return out;
};

/**
 * Adds the Duration (in milliseconds) to a WebM recording that lacks one. Anything that is not such a file, or
 * already has a duration, comes back unchanged.
 */
export async function withWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  if (!blob.type.includes('webm') || !(durationMs > 0)) return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const element = (pos: number) => {
    const id = readVint(bytes, pos, true);
    if (!id) return null;
    const size = readVint(bytes, pos + id.length, false);
    if (!size) return null;
    return { id: id.value, sizePos: pos + id.length, size, dataPos: pos + id.length + size.length };
  };

  const header = element(0);
  if (!header || header.id !== EBML_HEADER) return blob;
  const segment = element(header.dataPos + header.size.value);
  if (!segment || segment.id !== SEGMENT) return blob;

  // Info comes before the first cluster of audio.
  let pos = segment.dataPos;
  while (pos < bytes.length) {
    const child = element(pos);
    if (!child || child.id === CLUSTER || child.size.unknown) return blob;
    if (child.id === INFO) {
      const end = child.dataPos + child.size.value;
      for (let inner = child.dataPos; inner < end; ) {
        const field = element(inner);
        if (!field) return blob;
        if (field.id === DURATION) return blob;
        inner = field.dataPos + field.size.value;
      }
      // Duration: ID 0x4489, size 8, a big-endian 64-bit float.
      const duration = new Uint8Array(11);
      duration.set([0x44, 0x89, 0x88]);
      new DataView(duration.buffer).setFloat64(3, durationMs);
      const newSize = child.size.value + duration.length;
      const sizeLength = newSize < 2 ** (7 * child.size.length) - 1 ? child.size.length : 8;
      return new Blob([bytes.subarray(0, child.sizePos), writeSize(newSize, sizeLength), bytes.subarray(child.dataPos, end), duration, bytes.subarray(end)], { type: blob.type });
    }
    pos = child.dataPos + child.size.value;
  }
  return blob;
}

/**
 * For a media element playing a file that does not say how long it is: jumps to the very end once so the browser
 * works the length out, then returns to where it was (playing on if it was meant to). After that the whole file
 * can be seeked. Call it from `onLoadedMetadata`.
 */
export function makeSeekable(media: HTMLMediaElement) {
  if (Number.isFinite(media.duration)) return;
  const resume = media.autoplay || !media.paused;
  const muted = media.muted;
  media.muted = true;
  const done = () => {
    if (!Number.isFinite(media.duration)) return;
    media.removeEventListener('durationchange', done);
    media.currentTime = 0;
    media.muted = muted;
    if (resume) void media.play().catch(() => undefined);
  };
  media.addEventListener('durationchange', done);
  media.currentTime = Number.MAX_SAFE_INTEGER;
}
