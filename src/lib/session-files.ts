import { useSyncExternalStore } from 'react';
import { LGU_PROFILE, mockSessions, type Session } from '@/lib/mock-data';
import { buildAgenda, formatLongDate } from '@/lib/sessions';
import { createPdf, type PdfLine } from '@/lib/pdf';
import { STORES, requestPersistentStorage, runTransaction, storageErrorMessage } from '@/lib/app-db';

export type FileKind = 'pdf' | 'audio' | 'video' | 'image' | 'other';

export const FILE_CATEGORIES = ['Agenda', 'Order of Business', 'Minutes', 'Audio Recording', 'Video Recording', 'Supporting Document'] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export interface SessionFile {
  id: string;
  name: string;
  category: FileCategory;
  sessionId: string;
  kind: FileKind;
  size: number | null;
  uploadedAt: string;
  uploadedBy: string;
  source: 'system' | 'upload';
  // Recordings listed by the system can exist before the actual media is attached.
  blob: Blob | null;
  // Media shipped with the app in public/ (served as a static file) instead of stored in the browser.
  src?: string;
  // A prepared WebVTT transcript shipped with the app, so captions show without transcribing in the browser.
  transcriptSrc?: string;
}

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const EXTENSION_KINDS: Record<string, FileKind> = {
  pdf: 'pdf',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  aac: 'audio',
  ogg: 'audio',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  m4v: 'video',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  doc: 'other',
  docx: 'other',
  xls: 'other',
  xlsx: 'other',
  ppt: 'other',
  pptx: 'other',
  txt: 'other',
};

export const ACCEPTED_EXTENSIONS = Object.keys(EXTENSION_KINDS).map((ext) => `.${ext}`).join(',');

export const extensionOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

// Returns null for file types the repository does not accept.
export const detectKind = (file: File): FileKind | null => EXTENSION_KINDS[extensionOf(file.name)] ?? null;

export const suggestCategory = (kind: FileKind, name: string): FileCategory => {
  const lower = name.toLowerCase();
  if (kind === 'audio') return 'Audio Recording';
  if (kind === 'video') return 'Video Recording';
  if (lower.includes('order of business')) return 'Order of Business';
  if (lower.includes('agenda')) return 'Agenda';
  if (lower.includes('minutes')) return 'Minutes';
  return 'Supporting Document';
};

export const formatBytes = (bytes: number | null) => {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const todayInManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

const letterhead = (): PdfLine[] => [
  { text: `Republic of the Philippines - Province of ${LGU_PROFILE.province}`, size: 9 },
  { text: LGU_PROFILE.legislature.toUpperCase(), size: 15, bold: true },
  { text: LGU_PROFILE.address, size: 9 },
];

const sessionHeader = (session: Session, heading: string): PdfLine[] => [
  ...letterhead(),
  { text: heading, size: 13, bold: true, spaceBefore: 18 },
  { text: session.title, size: 12, bold: true },
  { text: `${formatLongDate(session.date)} - ${session.time}`, size: 10 },
  { text: session.location, size: 10 },
];

const agendaPdf = (session: Session) =>
  createPdf(
    [
      ...sessionHeader(session, 'AGENDA'),
      { text: 'Items for consideration', size: 11, bold: true, spaceBefore: 14 },
      ...buildAgenda(session).map((item, index) => ({ text: `${index + 1}. ${item}`, size: 10, spaceBefore: 4 })),
      { text: 'Prepared by the Office of the SB Secretary.', size: 9, spaceBefore: 24 },
    ],
    'SB CAPAS - OFFICIAL COPY'
  );

const orderOfBusinessPdf = (session: Session) =>
  createPdf(
    [
      ...sessionHeader(session, 'ORDER OF BUSINESS'),
      ...buildAgenda(session).map((item, index) => ({ text: `${String.fromCharCode(65 + (index % 26))}. ${item}`, size: 10, spaceBefore: index === 0 ? 14 : 4 })),
      { text: 'Certified correct by the SB Secretary.', size: 9, spaceBefore: 24 },
    ],
    'SB CAPAS - OFFICIAL COPY'
  );

const regularSession = mockSessions.find((session) => session.type === 'Regular') ?? mockSessions[0];

const seedFiles = (): SessionFile[] => {
  const agenda = agendaPdf(regularSession);
  const orderOfBusiness = orderOfBusinessPdf(regularSession);
  return [
    {
      id: 'sf-1',
      name: '38th Regular Session Agenda - Week 41.pdf',
      category: 'Agenda',
      sessionId: regularSession.id,
      kind: 'pdf',
      size: agenda.size,
      uploadedAt: '2026-09-21',
      uploadedBy: 'SB Secretariat',
      source: 'system',
      blob: agenda,
    },
    {
      id: 'sf-2',
      name: 'Committee on Finance Hearing Audio - Week 41.mp3',
      category: 'Audio Recording',
      sessionId: regularSession.id,
      kind: 'audio',
      size: 10_434_884,
      uploadedAt: '2026-09-22',
      uploadedBy: 'SB Secretariat',
      source: 'system',
      blob: null,
      src: '/media/sessions/committee-finance-hearing-audio-week-41.mp3',
      transcriptSrc: '/media/sessions/committee-finance-hearing-audio-week-41.vtt',
    },
    {
      id: 'sf-3',
      name: 'Plenary Recording - Week 41.mp4',
      category: 'Video Recording',
      sessionId: regularSession.id,
      kind: 'video',
      size: 19_165_346,
      uploadedAt: '2026-09-22',
      uploadedBy: 'SB Secretariat',
      source: 'system',
      blob: null,
      src: '/media/sessions/plenary-recording-week-41.mp4',
    },
    {
      id: 'sf-4',
      name: 'Order of Business - Week 41.pdf',
      category: 'Order of Business',
      sessionId: regularSession.id,
      kind: 'pdf',
      size: orderOfBusiness.size,
      uploadedAt: '2026-09-21',
      uploadedBy: 'SB Secretariat',
      source: 'system',
      blob: orderOfBusiness,
    },
  ];
};

// Module-level store shared by every page. Uploaded files and attached recordings are also saved in the
// browser's IndexedDB (it holds large binary files, unlike localStorage), so they survive a page refresh.
// System-generated documents are rebuilt from session data on every load and are not stored.
let files: SessionFile[] | null = null;
const listeners = new Set<() => void>();
const urls = new Map<string, { blob: Blob; url: string }>();

const idNumber = (file: SessionFile) => Number(file.id.replace(/\D/g, '')) || 0;

const setFiles = (next: SessionFile[]) => {
  files = next;
  listeners.forEach((listener) => listener());
};

let loadPromise: Promise<void> | null = null;

// Merges saved files into the list: saved uploads go first (newest first), saved attachments replace their system row.
const loadSavedFiles = () => {
  loadPromise ??= (async () => {
    try {
      const saved = ((await runTransaction(STORES.sessionFiles, 'readonly', (store) => store.getAll())) ?? []) as SessionFile[];
      if (saved.length === 0) return;
      const savedById = new Map(saved.map((file) => [file.id, file]));
      const current = files ?? seedFiles();
      const uploads = saved.filter((file) => file.source === 'upload' && !current.some((entry) => entry.id === file.id));
      // A saved attachment replaces its system row, but the row keeps the app's own shipped file links.
      const merge = (file: SessionFile) => {
        const saved = savedById.get(file.id);
        return saved ? { ...saved, src: file.src, transcriptSrc: file.transcriptSrc } : file;
      };
      setFiles([...uploads.sort((a, b) => idNumber(b) - idNumber(a)), ...current.map(merge)]);
    } catch {
      // Storage unavailable: the page still works with the built-in files.
    }
  })();
  return loadPromise;
};

const getFiles = () => {
  if (!files) {
    files = seedFiles();
    void loadSavedFiles();
  }
  return files;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const releaseUrl = (id: string) => {
  const entry = urls.get(id);
  if (entry) URL.revokeObjectURL(entry.url);
  urls.delete(id);
};

export const useSessionFiles = () => useSyncExternalStore(subscribe, getFiles);

// Each mutation saves first and only updates the list when saving worked. Resolves to an error message, or null on success.
export const addSessionFiles = async (added: Omit<SessionFile, 'id'>[]): Promise<string | null> => {
  getFiles();
  await loadSavedFiles();
  const firstId = Math.max(0, ...getFiles().map(idNumber)) + 1;
  const withIds = added.map((file, index) => ({ ...file, id: `sf-${firstId + index}` }));
  try {
    await runTransaction(STORES.sessionFiles, 'readwrite', (store) => {
      withIds.forEach((file) => store.put(file));
    });
  } catch (error) {
    return storageErrorMessage(error);
  }
  requestPersistentStorage();
  setFiles([...withIds.reverse(), ...getFiles()]);
  return null;
};

export const updateSessionFile = async (id: string, changes: Partial<SessionFile>): Promise<string | null> => {
  getFiles();
  await loadSavedFiles();
  const target = getFiles().find((file) => file.id === id);
  if (!target) return 'This file could not be found.';
  const updated = { ...target, ...changes };
  try {
    await runTransaction(STORES.sessionFiles, 'readwrite', (store) => store.put(updated));
  } catch (error) {
    return storageErrorMessage(error);
  }
  requestPersistentStorage();
  if ('blob' in changes) releaseUrl(id);
  setFiles(getFiles().map((file) => (file.id === id ? updated : file)));
  return null;
};

export const removeSessionFile = async (id: string): Promise<string | null> => {
  getFiles();
  await loadSavedFiles();
  try {
    await runTransaction(STORES.sessionFiles, 'readwrite', (store) => store.delete(id));
  } catch {
    return 'The file could not be removed from this browser. Please try again.';
  }
  releaseUrl(id);
  setFiles(getFiles().filter((file) => file.id !== id));
  return null;
};

// One object URL per file, reused until the file is replaced or removed.
export const fileUrl = (file: SessionFile): string | null => {
  if (!file.blob) return file.src ?? null;
  const cached = urls.get(file.id);
  if (cached && cached.blob === file.blob) return cached.url;
  releaseUrl(file.id);
  const url = URL.createObjectURL(file.blob);
  urls.set(file.id, { blob: file.blob, url });
  return url;
};
