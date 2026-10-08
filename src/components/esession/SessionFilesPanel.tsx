import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  Captions,
  CalendarDays,
  Check,
  Clock,
  MapPin,
  Download,
  Eye,
  FileAudio,
  FileImage,
  FilePen,
  FileText,
  FileVideo,
  File as FileIcon,
  FolderOpen,
  History,
  Minus,
  Paperclip,
  Play,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useTranscriptIndex } from '@/lib/esession-sync';
import { transcriptKey } from '@/lib/transcripts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { downloadUrl, escapeHtml, openPrintWindow, printPdfUrl } from '@/lib/files';
import {
  FILE_CATEGORIES,
  defaultFileSessionId,
  useFileSessions,
  MAX_UPLOAD_BYTES,
  addSessionFiles,
  detectKind,
  extensionOf,
  extensionsFor,
  fileUrl,
  formatBytes,
  latestVersions,
  removeSessionFile,
  suggestCategory,
  todayInManila,
  updateSessionFile,
  useSessionFiles,
  versionGroupOf,
  versionNumber,
  versionsOf,
  type FileCategory,
  type FileKind,
  type SessionFile,
} from '@/lib/session-files';
import { cn } from '@/lib/utils';
import { TranscriptPanel } from '@/components/esession/TranscriptPanel';
import { logActivity } from '@/lib/activity-log';
import { ROLE_TONE, getCurrentUser, initials, useAccess, useRoles, useUsers } from '@/lib/access-store';
import { makeSeekable } from '@/lib/media-duration';


const KIND_ICONS: Record<FileKind, typeof FileText> = {
  pdf: FileText,
  audio: FileAudio,
  video: FileVideo,
  image: FileImage,
  other: FileIcon,
};

const KIND_STYLE: Record<FileKind, string> = {
  pdf: 'bg-red-50 text-red-700',
  audio: 'bg-violet-50 text-violet-700',
  video: 'bg-sky-50 text-sky-700',
  image: 'bg-emerald-50 text-emerald-700',
  other: 'bg-slate-100 text-slate-600',
};

// What a complete session folder holds, shown as the session checklist.
const CHECKLIST_CATEGORIES: FileCategory[] = ['Agenda', 'Order of Business', 'Minutes', 'Audio Recording', 'Video Recording'];

type KindFilter = 'all' | FileKind;

// File-type tabs, also the order the "File type" sort uses.
const KIND_TABS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pdf', label: 'PDF' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Images' },
  { value: 'other', label: 'Office docs' },
];
const KIND_ORDER = KIND_TABS.map((tab) => tab.value);

// Categories whose documents always show their version number, since later sessions amend them.
const VERSIONED_CATEGORIES: FileCategory[] = ['Resolution', 'Enacted Ordinance'];
const isRecording = (file: SessionFile) => file.kind === 'audio' || file.kind === 'video';
// An amended version may be a PDF, a scanned image or an Office document, whatever the original was.
const AMEND_ACCEPT = (['pdf', 'image', 'other'] as FileKind[]).flatMap((kind) => extensionsFor(kind).map((ext) => `.${ext}`)).join(',');

const matchesKind = (file: SessionFile, filter: KindFilter) => filter === 'all' || file.kind === filter;

type CategoryFilter = 'all' | FileCategory;
const matchesCategory = (file: SessionFile, filter: CategoryFilter) => filter === 'all' || file.category === filter;

// The upload dialog takes one file type at a time; each type lists only the categories that fit it.
const DOCUMENT_CATEGORIES = FILE_CATEGORIES.filter((category) => category !== 'Audio Recording' && category !== 'Video Recording');
// Resolutions are the most looked-up documents, so the filter lists them first. Recordings and supporting
// documents are left out because the file-type tabs already cover them.
const FILTER_CATEGORIES: FileCategory[] = ['Resolution', ...DOCUMENT_CATEGORIES.filter((category) => category !== 'Resolution' && category !== 'Supporting Document')];
const UPLOAD_KINDS: { value: FileKind; label: string; hint: string; one: string; many: string; categories: FileCategory[] }[] = [
  { value: 'pdf', label: 'PDF', hint: 'Agendas, minutes, ordinances', one: 'a PDF', many: 'PDF files', categories: DOCUMENT_CATEGORIES },
  { value: 'audio', label: 'Audio', hint: 'Session and hearing audio', one: 'an audio file', many: 'audio files', categories: ['Audio Recording'] },
  { value: 'video', label: 'Video', hint: 'Session and hearing video', one: 'a video file', many: 'video files', categories: ['Video Recording'] },
  { value: 'image', label: 'Images', hint: 'Scanned pages, photos', one: 'an image', many: 'images', categories: DOCUMENT_CATEGORIES },
  { value: 'other', label: 'Office docs', hint: 'Word, Excel, PowerPoint', one: 'an Office document', many: 'Office documents', categories: DOCUMENT_CATEGORIES },
];
const uploadKindOf = (kind: FileKind) => UPLOAD_KINDS.find((entry) => entry.value === kind) ?? UPLOAD_KINDS[0];

const RECORDING_ACCEPT = 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.mp4,.webm,.mov,.m4v';

const selectClass = 'h-9 rounded-md border border-border bg-white px-2 text-sm text-text-main';

// Files whose session is no longer listed get their own tab instead of mixing into a session.
const OTHER_TAB = 'other';

type SortKey = 'type' | 'newest' | 'oldest' | 'name';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'type', label: 'File type' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name A–Z' },
];

const sortFiles = (list: SessionFile[], sort: SortKey) =>
  [...list].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    if (sort === 'newest') return b.uploadedAt.localeCompare(a.uploadedAt) || a.name.localeCompare(b.name);
    if (sort === 'oldest') return a.uploadedAt.localeCompare(b.uploadedAt) || a.name.localeCompare(b.name);
    // File type (PDF, audio, video, images, Office), then the order a session folder is put together.
    return (
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      FILE_CATEGORIES.indexOf(a.category) - FILE_CATEGORIES.indexOf(b.category) ||
      a.name.localeCompare(b.name)
    );
  });

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

interface PendingUpload {
  key: string;
  file: File;
  kind: FileKind;
  category: FileCategory;
}

export function SessionFilesPanel() {
  const files = useSessionFiles();
  // Which recordings have a transcript (kept on the LIMS server), for the badge on each one.
  const transcripts = useTranscriptIndex();
  // One folder per session and meeting on the calendar shared with LIMS Mobile and the E-Session app.
  const fileSessions = useFileSessions();
  const defaultSessionId = defaultFileSessionId(fileSessions);
  const sessionTitle = (id: string) => fileSessions.find((session) => session.id === id)?.title ?? 'Unassigned session';
  const { user: currentUser } = useAccess();
  const users = useUsers();
  const roles = useRoles();
  // Who added a file, with the role they had at the time.
  const authorOf = (file: SessionFile) => {
    const role = file.uploadedByRole ?? users.find((entry) => entry.name === file.uploadedBy)?.role;
    const tone = ROLE_TONE[roles.find((entry) => entry.name === role)?.tone ?? 'slate'];
    return { name: file.uploadedBy, role, tone };
  };
  const [keyword, setKeyword] = useState('');
  // Each session is its own tab so files from different sessions never share one list.
  const [activeSession, setActiveSession] = useState(defaultSessionId || OTHER_TAB);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortKey>('type');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [mediaTime, setMediaTime] = useState(0);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [uploadSession, setUploadSession] = useState(defaultSessionId);
  const [uploadKind, setUploadKind] = useState<FileKind>('pdf');
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [attachTarget, setAttachTarget] = useState<SessionFile | null>(null);
  const [amendTarget, setAmendTarget] = useState<SessionFile | null>(null);
  const [amendFile, setAmendFile] = useState<File | null>(null);
  const [amendNote, setAmendNote] = useState('');
  const [historyGroup, setHistoryGroup] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const amendInputRef = useRef<HTMLInputElement>(null);
  const sessionTabsRef = useRef<HTMLDivElement>(null);

  // Later sessions come first, so the next session's tab may start out of view: scroll the strip to it once.
  useEffect(() => {
    const strip = sessionTabsRef.current;
    const tab = strip?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (strip && tab) strip.scrollLeft = tab.offsetLeft - strip.offsetLeft - 8;
  }, []);

  // A folder can go away (its session cancelled on the calendar): open the default one instead.
  useEffect(() => {
    if (activeSession !== OTHER_TAB && !fileSessions.some((session) => session.id === activeSession)) setActiveSession(defaultSessionId || OTHER_TAB);
    if (!fileSessions.some((session) => session.id === uploadSession)) setUploadSession(defaultSessionId);
  }, [fileSessions, activeSession, uploadSession, defaultSessionId]);

  // Lists, counts and the checklist show only the current version of each document; older ones are in its history.
  const currentFiles = useMemo(() => latestVersions(files), [files]);
  const versionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    files.forEach((file) => counts.set(versionGroupOf(file), (counts.get(versionGroupOf(file)) ?? 0) + 1));
    return counts;
  }, [files]);
  const historyVersions = historyGroup ? files.filter((file) => versionGroupOf(file) === historyGroup).sort((a, b) => versionNumber(b) - versionNumber(a)) : [];
  const showsVersion = (file: SessionFile) => (versionCounts.get(versionGroupOf(file)) ?? 1) > 1 || VERSIONED_CATEGORIES.includes(file.category);

  const inSession = (file: SessionFile, tab: string) =>
    tab === OTHER_TAB ? !fileSessions.some((session) => session.id === file.sessionId) : file.sessionId === tab;
  const sessionFiles = useMemo(() => currentFiles.filter((file) => inSession(file, activeSession)), [currentFiles, activeSession]);
  const otherCount = currentFiles.filter((file) => inSession(file, OTHER_TAB)).length;
  const sessionTabs = [
    ...fileSessions.map((session) => ({ id: session.id, title: session.title, meta: `${shortDate(session.date)} · ${session.type}${session.date < todayInManila() ? ' · Held' : ''}`, count: currentFiles.filter((file) => file.sessionId === session.id).length })),
    ...(otherCount > 0 ? [{ id: OTHER_TAB, title: 'Other files', meta: 'No listed session', count: otherCount }] : []),
  ];

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return sortFiles(
      sessionFiles.filter((file) => matchesKind(file, kindFilter) && matchesCategory(file, categoryFilter) && (!q || [file.name, file.category, file.uploadedBy, file.changeNote ?? ''].some((value) => value.toLowerCase().includes(q)))),
      sort
    );
  }, [sessionFiles, keyword, kindFilter, categoryFilter, sort]);

  const previewFile = files.find((file) => file.id === previewId) ?? null;
  const previewUrl = previewFile ? fileUrl(previewFile) : null;

  const openPreview = (file: SessionFile) => {
    setMediaError(false);
    setMediaTime(0);
    setPreviewId(file.id);
  };

  // Clicking a transcript line jumps the player there.
  const seekMedia = (seconds: number) => {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = seconds;
    setMediaTime(seconds);
    void media.play().catch(() => undefined);
  };

  const download = (file: SessionFile) => {
    const url = fileUrl(file);
    if (!url || !downloadUrl(url, file.name)) {
      toast('Download failed', `${file.name} could not be downloaded. Please try again.`, 'error');
      return;
    }
    toast('Download started', file.name);
  };

  const print = (file: SessionFile) => {
    const url = fileUrl(file);
    const started =
      !!url &&
      (file.kind === 'pdf'
        ? printPdfUrl(url)
        : openPrintWindow(file.name, `<div class="title">${escapeHtml(file.name)}</div><img src="${escapeHtml(url)}" alt="" style="max-width:100%;margin-top:12px" />`));
    if (!started) {
      toast('Print failed', file.kind === 'pdf' ? `${file.name} could not be sent to the printer.` : 'Your browser blocked the print window. Allow pop-ups for this site and try again.', 'error');
    }
  };

  // Splits dropped/selected files into accepted uploads and rejections with a reason.
  // `expected` is passed when the file type is picked in the same step, before state updates.
  const queueFiles = (list: FileList | File[], expected: FileKind = uploadKind) => {
    const rejected: string[] = [];
    const accepted: PendingUpload[] = [];
    Array.from(list).forEach((file) => {
      const kind = detectKind(file);
      if (!kind) rejected.push(`${file.name} (unsupported file type)`);
      else if (kind !== expected) rejected.push(`${file.name} (not ${uploadKindOf(expected).one})`);
      else if (file.size === 0) rejected.push(`${file.name} (empty file)`);
      else if (file.size > MAX_UPLOAD_BYTES) rejected.push(`${file.name} (over ${formatBytes(MAX_UPLOAD_BYTES)})`);
      else accepted.push({ key: `${file.name}-${file.size}-${file.lastModified}`, file, kind, category: suggestCategory(kind, file.name) });
    });
    if (rejected.length > 0) toast('Some files were not added', rejected.join(', '), 'error');
    setPending((prev) => [...prev, ...accepted.filter((item) => !prev.some((existing) => existing.key === item.key))]);
    return accepted.length;
  };

  const openUpload = (sessionId?: string, kind?: FileKind) => {
    setPending([]);
    // Start on the file type the list is showing, so the Audio tab's upload expects audio.
    setUploadKind(kind ?? (kindFilter !== 'all' ? kindFilter : 'pdf'));
    setUploadSession(sessionId ?? (activeSession !== OTHER_TAB ? activeSession : defaultSessionId));
    setUploadOpen(true);
  };

  const handlePanelDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length === 0) return;
    setPending([]);
    setUploadSession(activeSession !== OTHER_TAB ? activeSession : defaultSessionId);
    // Files dropped on the list take the type of the first supported file.
    const kind = Array.from(event.dataTransfer.files).map(detectKind).find((entry): entry is FileKind => entry !== null) ?? 'pdf';
    setUploadKind(kind);
    queueFiles(event.dataTransfer.files, kind);
    setUploadOpen(true);
  };

  const changeUploadKind = (kind: FileKind) => {
    if (kind === uploadKind) return;
    const removed = pending.filter((item) => item.kind !== kind).length;
    setUploadKind(kind);
    setPending((prev) => prev.filter((item) => item.kind === kind));
    if (removed > 0) toast('Files taken off the list', `${removed} file(s) did not match ${uploadKindOf(kind).label} and were removed from this upload.`, 'info');
  };

  const submitUpload = async () => {
    if (pending.length === 0) {
      toast('Nothing uploaded', 'Choose at least one file to upload.', 'error');
      return;
    }
    if (!uploadSession) {
      toast('Nothing uploaded', 'Choose the session these files belong to.', 'error');
      return;
    }
    const duplicates = pending.filter((item) =>
      files.some((file) => file.sessionId === uploadSession && file.name.toLowerCase() === item.file.name.toLowerCase())
    );
    if (duplicates.length > 0) {
      toast('Nothing uploaded', `Already in this session: ${duplicates.map((item) => item.file.name).join(', ')}. To upload an amended copy, use Amend on that file instead.`, 'error');
      return;
    }
    const totalSize = pending.reduce((sum, item) => sum + item.file.size, 0);
    const confirmed = await confirmAction({
      title: `Upload ${pending.length} file${pending.length === 1 ? '' : 's'}?`,
      description: `${pending.length} file(s), ${formatBytes(totalSize)} in total, will be added to ${sessionTitle(uploadSession)}.`,
      confirmLabel: 'Upload',
    });
    if (!confirmed) return;
    setIsSaving(true);
    const error = await addSessionFiles(
      pending.map((item) => ({
        name: item.file.name,
        category: item.category,
        sessionId: uploadSession,
        kind: item.kind,
        size: item.file.size,
        uploadedAt: todayInManila(),
        uploadedBy: getCurrentUser().name,
        uploadedByRole: getCurrentUser().role,
        source: 'upload' as const,
        blob: item.file,
      }))
    );
    setIsSaving(false);
    if (error) {
      toast('Nothing uploaded', error, 'error');
      return;
    }
    toast('Files uploaded', `${pending.length} file(s) added to ${sessionTitle(uploadSession)}.`);
    logActivity({ module: 'E-Session', action: 'Uploaded', summary: `Uploaded ${pending.length} file(s) to ${sessionTitle(uploadSession)}`, detail: pending.map((item) => item.file.name).join(', ') });
    // Show the session the files went into.
    setActiveSession(uploadSession);
    setPending([]);
    setUploadOpen(false);
  };

  const startAttach = (file: SessionFile) => {
    setAttachTarget(file);
    // Reset so choosing the same file twice still fires a change event.
    if (attachInputRef.current) {
      // Set before opening: state from setAttachTarget has not rendered yet.
      attachInputRef.current.accept = RECORDING_ACCEPT;
      attachInputRef.current.value = '';
      attachInputRef.current.click();
    }
  };

  const handleAttach = async (selected: File | undefined) => {
    const target = attachTarget;
    if (!selected || !target) return;
    const kind = detectKind(selected);
    // Recorders often save audio-only hearings as .mp4, so either row accepts any audio or video file.
    if (kind !== 'audio' && kind !== 'video') {
      toast('Recording not attached', `${selected.name} is not an audio or video file.`, 'error');
      return;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      toast('Recording not attached', `${selected.name} is larger than ${formatBytes(MAX_UPLOAD_BYTES)}.`, 'error');
      return;
    }
    const baseName = target.name.replace(/\.[^.]+$/, '');
    const newName = `${baseName}.${extensionOf(selected.name)}`;
    const confirmed = await confirmAction({
      title: 'Attach this recording?',
      description: `${selected.name} (${formatBytes(selected.size)}) will be attached as ${newName}.`,
      confirmLabel: 'Attach recording',
    });
    if (!confirmed) return;
    const error = await updateSessionFile(target.id, {
      name: newName,
      kind,
      blob: selected,
      size: selected.size,
      uploadedAt: todayInManila(),
      uploadedBy: getCurrentUser().name,
      uploadedByRole: getCurrentUser().role,
    });
    if (error) {
      toast('Recording not attached', error, 'error');
      return;
    }
    toast('Recording attached', `${newName} is ready to play.`);
    logActivity({ module: 'E-Session', action: 'Uploaded', summary: `Attached the recording ${newName}` });
    setAttachTarget(null);
  };

  const startAmend = (file: SessionFile) => {
    setAmendTarget(file);
    setAmendFile(null);
    setAmendNote('');
  };

  const chooseAmendFile = (selected: File | undefined) => {
    if (!selected) return;
    const kind = detectKind(selected);
    if (!kind || kind === 'audio' || kind === 'video') {
      toast('File not added', `${selected.name} is not a PDF, image or Office document.`, 'error');
      return;
    }
    if (selected.size === 0 || selected.size > MAX_UPLOAD_BYTES) {
      toast('File not added', selected.size === 0 ? `${selected.name} is empty.` : `${selected.name} is larger than ${formatBytes(MAX_UPLOAD_BYTES)}.`, 'error');
      return;
    }
    setAmendFile(selected);
  };

  const nextVersionOf = (file: SessionFile) => Math.max(...versionsOf(files, file).map(versionNumber)) + 1;

  const submitAmend = async () => {
    const target = amendTarget;
    if (!target) return;
    if (!amendFile) {
      toast('Version not uploaded', 'Choose the amended file first.', 'error');
      return;
    }
    const note = amendNote.trim();
    if (!note) {
      toast('Version not uploaded', 'Describe what this amendment changed.', 'error');
      return;
    }
    const next = nextVersionOf(target);
    const confirmed = await confirmAction({
      title: `Upload version ${next}?`,
      description: `${amendFile.name} (${formatBytes(amendFile.size)}) becomes the current copy of ${target.name}. Earlier versions stay in its history.`,
      confirmLabel: `Upload version ${next}`,
    });
    if (!confirmed) return;
    setIsSaving(true);
    const error = await addSessionFiles([
      {
        name: amendFile.name,
        category: target.category,
        sessionId: target.sessionId,
        kind: detectKind(amendFile) ?? target.kind,
        size: amendFile.size,
        uploadedAt: todayInManila(),
        uploadedBy: getCurrentUser().name,
        uploadedByRole: getCurrentUser().role,
        source: 'upload',
        blob: amendFile,
        versionOf: versionGroupOf(target),
        version: next,
        changeNote: note,
      },
    ]);
    setIsSaving(false);
    if (error) {
      toast('Version not uploaded', error, 'error');
      return;
    }
    toast(`Version ${next} uploaded`, `${amendFile.name} is now the current copy.`);
    logActivity({ module: 'E-Session', action: 'Uploaded', summary: `Uploaded version ${next} of ${target.name}`, detail: note });
    setAmendTarget(null);
  };

  const remove = async (file: SessionFile) => {
    const versions = versionsOf(files, file);
    const replacement = versions[0]?.id === file.id ? versions[1] : undefined;
    const confirmed = await confirmAction({
      title: versions.length > 1 ? `Remove version ${versionNumber(file)}?` : 'Remove this file?',
      description:
        versions.length > 1
          ? `Version ${versionNumber(file)} (${file.name}) will be removed.${replacement ? ` Version ${versionNumber(replacement)} becomes the current copy.` : ''} This cannot be undone.`
          : `${file.name} will be removed from ${sessionTitle(file.sessionId)}. This cannot be undone.`,
      confirmLabel: 'Remove file',
      tone: 'destructive',
    });
    if (!confirmed) return;
    const error = await removeSessionFile(file.id);
    if (error) {
      toast('File not removed', error, 'error');
      return;
    }
    if (previewId === file.id) setPreviewId(null);
    toast('File removed', `${file.name} was removed.`);
    logActivity({ module: 'E-Session', action: 'Deleted', summary: `Removed ${file.name}`, detail: `From ${sessionTitle(file.sessionId)}` });
  };

  const recordings = currentFiles.filter(isRecording);
  const awaitingRecordings = recordings.filter((file) => !file.blob && !file.src).length;
  const totalBytes = files.reduce((sum, file) => sum + (file.size ?? 0), 0);
  const sessionsCovered = new Set(files.map((file) => file.sessionId)).size;

  const stats = [
    { label: 'Total files', value: String(currentFiles.length), icon: FolderOpen, hint: `${formatBytes(totalBytes)} stored` },
    { label: 'Documents', value: String(currentFiles.length - recordings.length), icon: FileText, hint: 'Agendas, minutes, resolutions, ordinances' },
    {
      label: 'Recordings',
      value: String(recordings.length),
      icon: FileVideo,
      hint: awaitingRecordings ? `${awaitingRecordings} awaiting upload` : 'Audio and video',
    },
    { label: 'Sessions covered', value: `${sessionsCovered}/${fileSessions.length}`, icon: CalendarDays, hint: 'Sessions with at least one file' },
  ];

  const currentSession = fileSessions.find((session) => session.id === activeSession);

  const checklistSessionId = currentSession?.id ?? defaultSessionId;
  const checklistSession = fileSessions.find((session) => session.id === checklistSessionId);
  const checklist = CHECKLIST_CATEGORIES.map((category) => {
    const matches = currentFiles.filter((file) => file.sessionId === checklistSessionId && file.category === category);
    const ready = matches.some((file) => file.blob || file.src);
    return { category, status: ready ? 'ready' : matches.length ? 'awaiting' : 'missing' } as const;
  });
  const readyCount = checklist.filter((item) => item.status === 'ready').length;

  const renderFile = (file: SessionFile) => {
    const Icon = KIND_ICONS[file.kind];
    const author = authorOf(file);
    const missing = !file.blob && !file.src;
    const canView = file.kind === 'pdf' || file.kind === 'image';
    const canPlay = isRecording(file);
    const versionCount = versionCounts.get(versionGroupOf(file)) ?? 1;
    return (
      <li key={file.id} className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', KIND_STYLE[file.kind])}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-main" title={file.name}>
              {file.name}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
              <span className="rounded-full bg-muted px-2 py-px font-medium text-text-main">{file.category}</span>
              {showsVersion(file) ? (
                <span className="rounded-full bg-primary/10 px-2 py-px font-bold text-primary" title={file.changeNote ? `Amendment: ${file.changeNote}` : 'Original version'}>
                  v{versionNumber(file)}
                </span>
              ) : null}
              {versionCount > 1 ? (
                <button type="button" onClick={() => setHistoryGroup(versionGroupOf(file))} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                  <History className="h-3 w-3" />
                  {versionCount} versions
                </button>
              ) : null}
              {missing ? <span className="font-semibold text-amber-700">Recording not yet attached</span> : <span>{formatBytes(file.size)}</span>}
              {canPlay && !missing && (transcripts[transcriptKey(file)] || file.transcriptSrc) ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-green-50 px-2 py-px font-semibold text-green-800">
                  <Captions className="h-3 w-3" />
                  Transcript
                  {transcripts[transcriptKey(file)]?.edited ? ' · corrected' : ''}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2.5 pl-[52px] sm:w-60 sm:shrink-0 sm:pl-0" title={`Uploaded by ${author.name}${author.role ? ` (${author.role})` : ''} on ${file.uploadedAt}`}>
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', author.tone.avatar)}>{initials(author.name)}</span>
          <div className="min-w-0 leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Uploaded by</p>
            <p className="truncate text-[13px] font-semibold text-text-main">{author.name}</p>
            <p className="truncate text-[11px] text-text-muted">
              {author.role ?? 'System record'} · {file.uploadedAt}
            </p>
          </div>
        </div>
        {/* Fixed width so the "Uploaded by" column lines up whatever buttons a row has. */}
        <div className="flex shrink-0 items-center gap-1 pl-[52px] sm:w-52 sm:justify-end sm:pl-0">
          {missing ? (
            <Button size="sm" className="h-8" onClick={() => startAttach(file)}>
              <Paperclip className="mr-1.5 h-4 w-4" />
              Attach recording
            </Button>
          ) : (
            <>
              {canPlay || canView ? (
                <Button size="sm" variant="outline" className="h-8" onClick={() => openPreview(file)}>
                  {canPlay ? <Play className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
                  {canPlay ? 'Play' : 'View'}
                </Button>
              ) : null}
              {!canPlay ? (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => startAmend(file)} aria-label={`Upload an amended version of ${file.name}`} title="Amend (upload new version)">
                  <FilePen className="h-4 w-4" />
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => download(file)} aria-label={`Download ${file.name}`} title="Download">
                <Download className="h-4 w-4" />
              </Button>
              {canView ? (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => print(file)} aria-label={`Print ${file.name}`} title="Print">
                  <Printer className="h-4 w-4" />
                </Button>
              ) : null}
            </>
          )}
          {file.source === 'upload' ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-[#c62828] hover:bg-[#ffebee]"
              onClick={() => remove(file)}
              aria-label={`Remove ${file.name}`}
              title="Remove file"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Session Files</h1>
          <p className="text-sm text-text-muted">Agendas, minutes, audio and video recordings of sessions and hearings, and scanned copies of enacted ordinances.</p>
        </div>
        <Button onClick={() => openUpload()}>
          <Upload className="mr-2 h-4 w-4" />
          Upload files
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-text-muted">{stat.label}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                <stat.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-text-main">{stat.value}</p>
            <p className="mt-1 text-xs text-text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
        <section
          className={cn('relative overflow-hidden rounded-xl border border-border bg-white shadow-sm', isDragging && 'ring-2 ring-primary/40')}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
          }}
          onDrop={handlePanelDrop}
        >
          <div ref={sessionTabsRef} className="overflow-x-auto border-b border-border bg-muted/40 p-2.5">
            <div className="flex min-w-max gap-2" role="tablist" aria-label="Sessions">
              {sessionTabs.map((tab) => {
                const active = tab.id === activeSession;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setActiveSession(tab.id);
                      setKindFilter('all');
                      setCategoryFilter('all');
                    }}
                    title={tab.title}
                    className={cn(
                      'relative flex w-64 flex-col items-start gap-0.5 overflow-hidden rounded-lg border px-4 py-2.5 text-left transition-all',
                      active
                        ? 'border-primary bg-primary text-white shadow-md'
                        : 'border-border bg-white text-text-main hover:border-primary/40 hover:bg-primary/[0.03]'
                    )}
                  >
                    {/* Gold underline, the same accent the sidebar uses for the open page. */}
                    {active ? <span className="absolute inset-x-0 bottom-0 h-1 bg-[#d4a72c]" aria-hidden /> : null}
                    <span className="flex w-full items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{tab.title}</span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-px text-[11px] font-bold tabular-nums',
                          active ? 'bg-white text-primary' : 'bg-muted text-text-muted'
                        )}
                      >
                        {tab.count}
                      </span>
                    </span>
                    <span className={cn('text-[11px]', active ? 'text-white/90' : 'text-text-muted')}>{tab.meta}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <header className="space-y-3 border-b border-border px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="mr-auto">
                <h2 className="truncate text-base font-semibold text-text-main" title={currentSession?.title ?? 'Other files'}>
                  {currentSession?.title ?? 'Other files'} <span className="text-sm font-normal text-text-muted">({filtered.length})</span>
                </h2>
                {currentSession ? (
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(`${currentSession.date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {currentSession.time}
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{currentSession.location}</span>
                    </span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-text-muted">Files whose session is no longer listed</p>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                  aria-label="Filter by category"
                  className={cn(selectClass, 'sm:w-52', categoryFilter !== 'all' && 'border-primary font-semibold text-primary')}
                >
                  <option value="all">All categories</option>
                  {FILTER_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category} ({sessionFiles.filter((file) => file.category === category && matchesKind(file, kindFilter)).length})
                    </option>
                  ))}
                </select>
                <div className="relative sm:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
                  <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search this session" aria-label="Search this session's files" className="h-9 pl-8 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-1 overflow-x-auto px-1">
              <div className="inline-flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="File type">
                {KIND_TABS.map((tab) => {
                  const active = kindFilter === tab.value;
                  const count = sessionFiles.filter((file) => matchesKind(file, tab.value) && matchesCategory(file, categoryFilter)).length;
                  const TabIcon = tab.value === 'all' ? FolderOpen : KIND_ICONS[tab.value];
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setKindFilter(tab.value)}
                      className={cn(
                        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                        active ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
                      )}
                    >
                      <TabIcon className={cn('h-3.5 w-3.5', active && tab.value !== 'all' ? KIND_STYLE[tab.value].split(' ')[1] : '')} />
                      {tab.label}
                      <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-primary/10 text-primary' : 'bg-white/70')}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-semibold text-text-muted">Sort</span>
              <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Sort files">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSort(option.value)}
                    aria-pressed={sort === option.value}
                    className={cn(
                      'whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                      sort === option.value ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            </div>
          </header>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-text-muted">
                <FolderOpen className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-text-main">{sessionFiles.length === 0 ? 'No files in this session yet' : 'No files found'}</p>
              <p className="text-xs text-text-muted">{sessionFiles.length === 0 ? 'Upload the agenda, minutes or recordings for this session.' : 'Try another search, file type or category, or upload a new file.'}</p>
              {sessionFiles.length === 0 && currentSession ? (
                <Button size="sm" className="mt-2" onClick={() => openUpload(currentSession.id)}>
                  <Upload className="mr-1.5 h-4 w-4" />
                  Upload to this session
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y divide-border">{filtered.map(renderFile)}</ul>
          )}

          <p className="border-t border-border bg-muted/30 px-5 py-2.5 text-[11px] text-text-muted">
            Accepted: PDF, audio, video, images and Office documents up to {formatBytes(MAX_UPLOAD_BYTES)} each.
          </p>

          {isDragging ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-primary/5">
              <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-primary shadow">
                <Upload className="h-4 w-4" />
                Drop files to upload
              </div>
            </div>
          ) : null}
        </section>

        {/* Session checklist */}
        <aside className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-text-main">Session Checklist</h2>
          <p className="text-xs text-text-muted">{checklistSession ? checklistSession.title : 'No session selected'}</p>
          {checklistSession?.type === 'Meeting' ? (
            <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-text-muted">
              Meetings are not official sessions, so no documents are required. Notes, recordings and handouts can still be kept in this folder.
            </p>
          ) : (
          <>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all duration-500', readyCount === checklist.length ? 'bg-green-600' : 'bg-primary')}
                style={{ width: `${Math.round((readyCount / checklist.length) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-text-main">
              {readyCount}/{checklist.length}
            </span>
          </div>
          <ul className="mt-4 space-y-2">
            {checklist.map((item) => (
              <li key={item.category} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                    item.status === 'ready' ? 'bg-green-600 text-white' : item.status === 'awaiting' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-text-muted'
                  )}
                >
                  {item.status === 'ready' ? <Check className="h-3.5 w-3.5" /> : item.status === 'awaiting' ? <Clock className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-main">{item.category}</p>
                  <p className="text-[11px] text-text-muted">{item.status === 'ready' ? 'On file' : item.status === 'awaiting' ? 'Listed, file not attached' : 'Not yet uploaded'}</p>
                </div>
                {item.status === 'missing' ? (
                  <button
                    type="button"
                    onClick={() => openUpload(checklistSessionId, item.category === 'Audio Recording' ? 'audio' : item.category === 'Video Recording' ? 'video' : 'pdf')} className="text-xs font-semibold text-primary hover:underline">
                    Upload
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          </>
          )}
          <p className="mt-4 text-[11px] text-text-muted">Follows the session tab you have open.</p>
        </aside>
      </div>
    </div>

    <input
      ref={attachInputRef}
      type="file"
      className="hidden"
      onChange={(e) => handleAttach(e.target.files?.[0])}
    />

    <Dialog open={previewFile !== null} onOpenChange={(open) => !open && setPreviewId(null)}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-4xl">
        {previewFile ? (
          <>
            <div className="border-b border-border px-6 py-4 pr-12">
              <DialogHeader className="space-y-1">
                <DialogTitle className="truncate text-primary" title={previewFile.name}>{previewFile.name}</DialogTitle>
                <DialogDescription>
                  {sessionTitle(previewFile.sessionId)} · {previewFile.category}
                  {showsVersion(previewFile) ? ` · Version ${versionNumber(previewFile)}` : ''} · {formatBytes(previewFile.size)} · Uploaded by {previewFile.uploadedBy}
                  {authorOf(previewFile).role ? ` (${authorOf(previewFile).role})` : ''} on {previewFile.uploadedAt}
                  {previewFile.changeNote ? ` · Amendment: ${previewFile.changeNote}` : ''}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-[#f4f5f7] p-4">
              {!previewUrl ? (
                <p className="py-10 text-center text-sm text-text-muted">This file has no content attached yet.</p>
              ) : mediaError ? (
                <p className="py-10 text-center text-sm text-text-muted">
                  This browser can't play this file format. Download it to open it on this computer.
                </p>
              ) : previewFile.kind === 'pdf' ? (
                <iframe src={previewUrl} title={previewFile.name} className="h-[70vh] w-full rounded border border-border bg-white" />
              ) : previewFile.kind === 'image' ? (
                <img src={previewUrl} alt={previewFile.name} className="mx-auto max-h-[70vh] object-contain" />
              ) : previewFile.kind === 'video' ? (
                <video
                  ref={(element) => {
                    mediaRef.current = element;
                  }}
                  src={previewUrl}
                  controls
                  autoPlay
                  className="mx-auto max-h-[45vh] w-full rounded bg-black"
                  onLoadedMetadata={(e) => makeSeekable(e.currentTarget)}
                  onTimeUpdate={(e) => setMediaTime(e.currentTarget.currentTime)}
                  onError={() => setMediaError(true)}
                />
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3">
                  <FileAudio className="h-8 w-8 shrink-0 text-primary" />
                  <audio
                    ref={(element) => {
                      mediaRef.current = element;
                    }}
                    src={previewUrl}
                    controls
                    autoPlay
                    className="w-full"
                    onLoadedMetadata={(e) => makeSeekable(e.currentTarget)}
                    onTimeUpdate={(e) => setMediaTime(e.currentTarget.currentTime)}
                    onError={() => setMediaError(true)}
                  />
                </div>
              )}
              {previewUrl && !mediaError && (previewFile.kind === 'audio' || previewFile.kind === 'video') ? (
                <div className="mt-4">
                  <TranscriptPanel file={previewFile} url={previewUrl} currentTime={mediaTime} onSeek={seekMedia} />
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 rounded-b-lg border-t border-border bg-[#fafafa] px-6 py-3">
              <Button variant="outline" size="sm" onClick={() => download(previewFile)}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              {previewFile.kind === 'pdf' || previewFile.kind === 'image' ? (
                <Button variant="outline" size="sm" onClick={() => print(previewFile)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
              ) : null}
              <Button size="sm" onClick={() => setPreviewId(null)}>
                Close
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>

    <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
      <DialogContent closeOnOverlayClick={false} className="flex flex-col gap-0 p-0 sm:max-w-3xl">
        <div className="border-b border-border px-6 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-primary">Upload Session Files</DialogTitle>
            <DialogDescription>Choose the session and the file type, then add the files.</DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 px-6 py-5">
          <label className="block text-xs font-semibold text-text-muted">
            Session
            <select value={uploadSession} onChange={(e) => setUploadSession(e.target.value)} className={cn(selectClass, 'mt-1 w-full')}>
              {fileSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} ({session.date})
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-xs font-semibold text-text-muted">File type</p>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="File type">
              {UPLOAD_KINDS.map((entry) => {
                const active = entry.value === uploadKind;
                const KindIcon = KIND_ICONS[entry.value];
                return (
                  <button
                    key={entry.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => changeUploadKind(entry.value)}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors',
                      active ? 'border-primary bg-primary text-white shadow-sm' : 'border-border bg-white text-text-main hover:border-primary/40 hover:bg-primary/[0.03]'
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <KindIcon className="h-4 w-4 shrink-0" />
                      {entry.label}
                    </span>
                    <span className={cn('text-[11px] leading-tight', active ? 'text-white/90' : 'text-text-muted')}>{entry.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => uploadInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                uploadInputRef.current?.click();
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              queueFiles(e.dataTransfer.files);
            }}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-border px-4 py-6 text-center hover:border-primary/50 hover:bg-primary/5"
          >
            <Upload className="h-6 w-6 text-primary" />
            <p className="text-sm font-semibold">
              Drop {uploadKindOf(uploadKind).many} here or click to browse
            </p>
            <p className="text-[11px] text-text-muted">
              {extensionsFor(uploadKind)
                .map((ext) => ext.toUpperCase())
                .join(', ')}{' '}
              · up to {formatBytes(MAX_UPLOAD_BYTES)} each
            </p>
          </div>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            accept={extensionsFor(uploadKind)
              .map((ext) => `.${ext}`)
              .join(',')}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) queueFiles(e.target.files);
              e.target.value = '';
            }}
          />

          {pending.length > 0 ? (
            <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {pending.map((item) => {
                const Icon = KIND_ICONS[item.kind];
                return (
                  <div key={item.key} className="flex items-center gap-3 px-3 py-2">
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium" title={item.file.name}>{item.file.name}</div>
                      <div className="text-[11px] text-text-muted">{formatBytes(item.file.size)}</div>
                    </div>
                    {uploadKindOf(item.kind).categories.length === 1 ? (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-text-main">{item.category}</span>
                    ) : (
                      <select
                        value={item.category}
                        onChange={(e) =>
                          setPending((prev) => prev.map((entry) => (entry.key === item.key ? { ...entry, category: e.target.value as FileCategory } : entry)))
                        }
                        className={cn(selectClass, 'h-8 text-xs')}
                        aria-label={`Category for ${item.file.name}`}
                      >
                        {uploadKindOf(item.kind).categories.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => setPending((prev) => prev.filter((entry) => entry.key !== item.key))}
                      className="rounded p-1 text-text-muted hover:bg-muted hover:text-text-main"
                      aria-label={`Remove ${item.file.name} from upload`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-xs text-text-muted">No files selected yet.</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 rounded-b-lg border-t border-border bg-[#fafafa] px-6 py-3">
          <div className="min-w-0 text-xs text-text-muted">
            <p>
              {pending.length} file(s) · {formatBytes(pending.reduce((sum, item) => sum + item.file.size, 0))}
            </p>
            <p className="truncate">
              Uploading as <span className="font-semibold text-text-main">{currentUser.name}</span> · {currentUser.role}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={submitUpload} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Upload'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={amendTarget !== null} onOpenChange={(open) => !open && !isSaving && setAmendTarget(null)}>
      <DialogContent closeOnOverlayClick={false} className="flex flex-col gap-0 p-0 sm:max-w-lg">
        {amendTarget ? (
          <>
            <div className="border-b border-border px-6 py-4 pr-12">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-primary">Amend {amendTarget.category}</DialogTitle>
                <DialogDescription className="truncate" title={amendTarget.name}>
                  Upload version {nextVersionOf(amendTarget)} of {amendTarget.name}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="space-y-4 px-6 py-5">
              <button
                type="button"
                onClick={() => {
                  if (!amendInputRef.current) return;
                  // Reset so choosing the same file again still fires a change event.
                  amendInputRef.current.value = '';
                  amendInputRef.current.click();
                }}
                className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-border px-4 py-5 text-center hover:border-primary/50 hover:bg-primary/5"
              >
                <Upload className="h-5 w-5 text-primary" />
                {amendFile ? (
                  <>
                    <span className="max-w-full truncate text-sm font-semibold text-text-main">{amendFile.name}</span>
                    <span className="text-[11px] text-text-muted">{formatBytes(amendFile.size)} · click to choose another file</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-text-main">Choose the amended file</span>
                    <span className="text-[11px] text-text-muted">PDF, image or Office document · up to {formatBytes(MAX_UPLOAD_BYTES)}</span>
                  </>
                )}
              </button>
              <input ref={amendInputRef} type="file" accept={AMEND_ACCEPT} className="hidden" onChange={(e) => chooseAmendFile(e.target.files?.[0])} />
              <label className="block text-xs font-semibold text-text-muted">
                What was amended
                <textarea
                  value={amendNote}
                  onChange={(e) => setAmendNote(e.target.value)}
                  rows={3}
                  placeholder="e.g. Section 3 amended per Resolution No. 2026-045"
                  className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm font-normal text-text-main"
                />
              </label>
              <p className="text-[11px] text-text-muted">The new file becomes the current copy. Earlier versions stay in the version history and can still be viewed and downloaded.</p>
            </div>
            <div className="flex justify-end gap-2 rounded-b-lg border-t border-border bg-[#fafafa] px-6 py-3">
              <Button variant="outline" onClick={() => setAmendTarget(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={submitAmend} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Upload version'}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>

    <Dialog open={historyVersions.length > 0} onOpenChange={(open) => !open && setHistoryGroup(null)}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl">
        {historyVersions.length > 0 ? (
          <>
            <div className="border-b border-border px-6 py-4 pr-12">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-primary">Version history</DialogTitle>
                <DialogDescription className="truncate" title={historyVersions[0].name}>
                  {historyVersions[0].name} · {historyVersions.length} versions
                </DialogDescription>
              </DialogHeader>
            </div>
            <ol className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
              {historyVersions.map((version, index) => {
                const author = authorOf(version);
                return (
                  <li key={version.id} className="flex flex-col gap-2 px-6 py-3.5 sm:flex-row sm:items-start">
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        index === 0 ? 'bg-primary text-white' : 'bg-muted text-text-muted'
                      )}
                    >
                      v{versionNumber(version)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-main">
                        <span className="truncate" title={version.name}>{version.name}</span>
                        {index === 0 ? <span className="shrink-0 rounded-full bg-green-50 px-2 py-px text-[10px] font-bold uppercase text-green-700">Current</span> : null}
                      </p>
                      <p className="text-xs text-text-muted">
                        {version.uploadedAt} · {author.name}
                        {author.role ? ` (${author.role})` : ''} · {formatBytes(version.size)}
                      </p>
                      <p className="mt-1 text-xs text-text-main">{version.changeNote ?? 'Original version'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {version.kind === 'pdf' || version.kind === 'image' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => {
                            // Dialogs share one layer, so close the history for the preview to show on top.
                            setHistoryGroup(null);
                            openPreview(version);
                          }}
                        >
                          <Eye className="mr-1.5 h-4 w-4" />
                          View
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => download(version)} aria-label={`Download version ${versionNumber(version)}`} title="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                      {version.source === 'upload' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-[#c62828] hover:bg-[#ffebee]"
                          onClick={() => remove(version)}
                          aria-label={`Remove version ${versionNumber(version)}`}
                          title="Remove version"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="flex justify-end rounded-b-lg border-t border-border bg-[#fafafa] px-6 py-3">
              <Button size="sm" onClick={() => setHistoryGroup(null)}>
                Close
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
    </>
  );
}
