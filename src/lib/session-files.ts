import { useMemo, useSyncExternalStore } from 'react';
import { LGU_PROFILE, mockPastSessions, mockSessions, type Session } from '@/lib/mock-data';
import { buildAgenda, formatLongDate } from '@/lib/sessions';
import { createPdf, type PdfLine } from '@/lib/pdf';
import { deleteServerFile, serverUrl, uploadServerFile, useCalendarSessions, useServerFiles, getServerFiles, type ServerFile } from '@/lib/esession-sync';

export type FileKind = 'pdf' | 'audio' | 'video' | 'image' | 'other';

export const FILE_CATEGORIES = ['Agenda', 'Order of Business', 'Minutes', 'Audio Recording', 'Video Recording', 'Enacted Ordinance', 'Resolution', 'Supporting Document'] as const;
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
  /** Role of the uploader when the file was added; older records fall back to the account's current role. */
  uploadedByRole?: string;
  source: 'system' | 'upload';
  // Recordings listed by the system can exist before the actual media is attached.
  blob: Blob | null;
  // Media shipped with the app in public/, or a file added during the demo and kept on the LIMS server.
  src?: string;
  // A prepared WebVTT transcript shipped with the app, so captions show without transcribing in the browser.
  transcriptSrc?: string;
  /** Id of the first version when this file amends an earlier one; every version of a document shares it. */
  versionOf?: string;
  /** Version number, 1 for the original (older records have none and count as version 1). */
  version?: number;
  /** What the amendment changed, entered when a new version is uploaded. */
  changeNote?: string;
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

/** File extensions (without the dot) accepted for one kind of file. */
export const extensionsFor = (kind: FileKind) => Object.keys(EXTENSION_KINDS).filter((ext) => EXTENSION_KINDS[ext] === kind);

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
  // Scanned copies of ordinances passed during the session.
  if (/\bord(inance)?\b/.test(lower)) return 'Enacted Ordinance';
  if (/\bres(o|olution)?\b/.test(lower)) return 'Resolution';
  return 'Supporting Document';
};

/** Versions of one document share the id of its first version. */
export const versionGroupOf = (file: SessionFile) => file.versionOf ?? file.id;
export const versionNumber = (file: SessionFile) => file.version ?? 1;

/** Keeps only the current (highest) version of each document, in the list's order. */
export const latestVersions = (list: SessionFile[]) => {
  const latest = new Map<string, SessionFile>();
  list.forEach((file) => {
    const current = latest.get(versionGroupOf(file));
    if (!current || versionNumber(file) > versionNumber(current)) latest.set(versionGroupOf(file), file);
  });
  const keep = new Set(latest.values());
  return list.filter((file) => keep.has(file));
};

/** Every version of the file's document, newest first. */
export const versionsOf = (list: SessionFile[], file: SessionFile) =>
  list.filter((entry) => versionGroupOf(entry) === versionGroupOf(file)).sort((a, b) => versionNumber(b) - versionNumber(a));

export const formatBytes = (bytes: number | null) => {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const todayInManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

/** The top of every official PDF: country and province, the legislative body, and its address. */
export const letterhead = (): PdfLine[] => [
  { text: `Republic of the Philippines · Province of ${LGU_PROFILE.province}`, size: 9 },
  { text: LGU_PROFILE.legislativeBody.toUpperCase(), size: 15, bold: true },
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

// Recently held sessions whose folders are kept next to the upcoming ones, newest first.
const HELD_SESSIONS = ['ps37', 'ps36', 'ps35']
  .map((id) => mockPastSessions.find((session) => session.id === id))
  .filter((session): session is Session => session !== undefined);

// Folders kept whatever the calendar says: the sample sessions and the recently held ones.
const KEPT_FOLDERS = new Set([...mockSessions, ...HELD_SESSIONS].map((session) => session.id));

/**
 * Sessions that have a folder in Session Files, latest date first: the folders kept above, every session and
 * meeting still to come on the shared calendar (so one scheduled in the app or in /es gets its folder at once),
 * and any session that has files (an e-session's recording or attendance record).
 */
export const fileSessionsOf = (calendar: Session[], files: SessionFile[], today: string) => {
  const withFiles = new Set(files.map((file) => file.sessionId));
  return calendar.filter((session) => KEPT_FOLDERS.has(session.id) || session.date >= today || withFiles.has(session.id)).sort((a, b) => b.date.localeCompare(a.date));
};

/** The Session Files folders, following the calendar shared with LIMS Mobile and the E-Session app. */
export const useFileSessions = () => {
  const calendar = useCalendarSessions();
  const files = useSessionFiles();
  const today = todayInManila();
  return useMemo(() => fileSessionsOf(calendar, files, today), [calendar, files, today]);
};

/** The folder opened first: the next session to be held, or the latest one when none is upcoming. */
export const defaultFileSessionId = (sessions: Session[]) =>
  [...sessions].reverse().find((session) => session.date >= todayInManila())?.id ?? sessions[0]?.id ?? '';

const daysBefore = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() - days);
  return date.toLocaleDateString('en-CA');
};

// The agenda and order of business of each held session, prepared a few days before it met.
const heldSessionFiles = (): SessionFile[] =>
  HELD_SESSIONS.flatMap((session) => {
    const agenda = agendaPdf(session);
    const orderOfBusiness = orderOfBusinessPdf(session);
    const shared = { sessionId: session.id, kind: 'pdf' as const, uploadedAt: daysBefore(session.date, 3), uploadedBy: 'SB Secretariat', source: 'system' as const };
    return [
      { ...shared, id: `sf-${session.id}-agenda`, name: `${session.title} Agenda.pdf`, category: 'Agenda' as const, size: agenda.size, blob: agenda },
      { ...shared, id: `sf-${session.id}-ob`, name: `${session.title} Order of Business.pdf`, category: 'Order of Business' as const, size: orderOfBusiness.size, blob: orderOfBusiness },
    ];
  });

const seedFiles = (): SessionFile[] => {
  const agenda = agendaPdf(regularSession);
  const orderOfBusiness = orderOfBusinessPdf(regularSession);
  return [
    ...heldSessionFiles(),
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
      size: 1_013_952,
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

// Session Files as every device sees them: the sample files built into the app, merged with the files added
// during the demo, which the LIMS server keeps and lists through the E-Session sync (see esession-sync.ts and
// server/session-file-store.mjs). A restart of the server brings back just the sample files.
let seeded: SessionFile[] | null = null;
const seed = () => (seeded ??= seedFiles());
const urls = new Map<string, { blob: Blob; url: string }>();

const fromServer = (entry: ServerFile, base?: SessionFile): SessionFile => ({
  ...(base ?? {}),
  id: entry.id,
  name: entry.name ?? base?.name ?? 'File',
  category: (entry.category ?? base?.category ?? 'Supporting Document') as FileCategory,
  sessionId: entry.sessionId ?? base?.sessionId ?? '',
  kind: (entry.kind ?? base?.kind ?? 'other') as FileKind,
  size: entry.size ?? null,
  uploadedAt: entry.uploadedAt ?? base?.uploadedAt ?? '',
  uploadedBy: entry.uploadedBy ?? base?.uploadedBy ?? '',
  uploadedByRole: entry.uploadedByRole,
  source: entry.source ?? 'upload',
  versionOf: entry.versionOf,
  version: entry.version,
  changeNote: entry.changeNote,
  blob: null,
  src: entry.src ? serverUrl(entry.src) : undefined,
  // A sample recording keeps its prepared captions when its media is attached.
  transcriptSrc: base?.transcriptSrc,
});

let merged: { from: ServerFile[]; files: SessionFile[] } | null = null;
const getFiles = () => {
  const server = getServerFiles();
  if (merged?.from === server) return merged.files;
  const byId = new Map(server.map((entry) => [entry.id, entry]));
  const samples = seed();
  // Files added during the demo first, newest first (the server lists them that way); then the sample files,
  // each replaced by the server's copy when it was given new contents, or left out when it was removed.
  const added = server.filter((entry) => !entry.deleted && !samples.some((file) => file.id === entry.id)).map((entry) => fromServer(entry));
  const kept = samples.flatMap((file) => {
    const entry = byId.get(file.id);
    if (!entry) return [file];
    return entry.deleted ? [] : [fromServer(entry, file)];
  });
  merged = { from: server, files: [...added, ...kept] };
  return merged.files;
};

const releaseUrl = (id: string) => {
  const entry = urls.get(id);
  if (entry) URL.revokeObjectURL(entry.url);
  urls.delete(id);
};

export const useSessionFiles = () => {
  useServerFiles();
  return getFiles();
};

const metaOf = (file: Omit<SessionFile, 'id'>) => ({
  name: file.name,
  category: file.category,
  kind: file.kind,
  sessionId: file.sessionId,
  uploadedAt: file.uploadedAt,
  uploadedBy: file.uploadedBy,
  uploadedByRole: file.uploadedByRole,
  source: file.source,
  versionOf: file.versionOf,
  version: file.version,
  changeNote: file.changeNote,
});

// Each change goes to the server first and shows on every device once it is saved there. Resolves to an error
// message, or null on success.
export const addSessionFiles = async (added: Omit<SessionFile, 'id'>[]): Promise<string | null> => {
  for (const file of added) {
    if (!file.blob) return `${file.name} has no contents to save.`;
    const error = await uploadServerFile(metaOf(file), file.blob);
    if (error) return added.length > 1 ? `${file.name}: ${error}` : error;
  }
  return null;
};

/** New contents (and details) for a file already listed, such as a recording attached to its row. */
export const updateSessionFile = async (id: string, changes: Partial<SessionFile>): Promise<string | null> => {
  const target = getFiles().find((file) => file.id === id);
  if (!target) return 'This file could not be found.';
  if (!changes.blob) return 'Choose the file to attach.';
  const error = await uploadServerFile(metaOf({ ...target, ...changes }), changes.blob, id);
  if (!error) releaseUrl(id);
  return error;
};

export const removeSessionFile = async (id: string): Promise<string | null> => {
  const error = await deleteServerFile(id);
  if (!error) releaseUrl(id);
  return error;
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
