import { useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  CalendarDays,
  Check,
  Clock,
  Download,
  Eye,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  File as FileIcon,
  FolderOpen,
  Minus,
  Paperclip,
  Play,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { mockSessions } from '@/lib/mock-data';
import { downloadUrl, openPrintWindow, printPdfUrl } from '@/lib/files';
import {
  ACCEPTED_EXTENSIONS,
  FILE_CATEGORIES,
  MAX_UPLOAD_BYTES,
  addSessionFiles,
  detectKind,
  extensionOf,
  fileUrl,
  formatBytes,
  removeSessionFile,
  suggestCategory,
  todayInManila,
  updateSessionFile,
  useSessionFiles,
  type FileCategory,
  type FileKind,
  type SessionFile,
} from '@/lib/session-files';
import { cn } from '@/lib/utils';
import { TranscriptPanel } from '@/components/esession/TranscriptPanel';
import { logActivity } from '@/lib/activity-log';

const CURRENT_USER = 'SB Secretariat Admin';

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

type CategoryFilter = 'all' | 'recordings' | FileCategory;

const CATEGORY_TABS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Agenda', label: 'Agenda' },
  { value: 'Order of Business', label: 'Order of Business' },
  { value: 'Minutes', label: 'Minutes' },
  { value: 'recordings', label: 'Recordings' },
  { value: 'Supporting Document', label: 'Supporting' },
];

const matchesCategory = (file: SessionFile, filter: CategoryFilter) =>
  filter === 'all' || (filter === 'recordings' ? file.category === 'Audio Recording' || file.category === 'Video Recording' : file.category === filter);

const sessionTitle = (id: string) => mockSessions.find((session) => session.id === id)?.title ?? 'Unassigned session';

const RECORDING_ACCEPT = 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.mp4,.webm,.mov,.m4v';

const selectClass = 'h-9 rounded-md border border-border bg-white px-2 text-sm text-text-main';

interface PendingUpload {
  key: string;
  file: File;
  kind: FileKind;
  category: FileCategory;
}

export function SessionFilesPanel() {
  const files = useSessionFiles();
  const [keyword, setKeyword] = useState('');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [mediaTime, setMediaTime] = useState(0);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [uploadSession, setUploadSession] = useState(mockSessions[0]?.id ?? '');
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [attachTarget, setAttachTarget] = useState<SessionFile | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return files.filter(
      (file) =>
        (sessionFilter === 'all' || file.sessionId === sessionFilter) &&
        matchesCategory(file, categoryFilter) &&
        (!q || file.name.toLowerCase().includes(q) || file.category.toLowerCase().includes(q) || sessionTitle(file.sessionId).toLowerCase().includes(q))
    );
  }, [files, keyword, sessionFilter, categoryFilter]);

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
        : openPrintWindow(file.name, `<div class="title">${file.name}</div><img src="${url}" alt="" style="max-width:100%;margin-top:12px" />`));
    if (!started) {
      toast('Print failed', file.kind === 'pdf' ? `${file.name} could not be sent to the printer.` : 'Your browser blocked the print window. Allow pop-ups for this site and try again.', 'error');
    }
  };

  // Splits dropped/selected files into accepted uploads and rejections with a reason.
  const queueFiles = (list: FileList | File[]) => {
    const rejected: string[] = [];
    const accepted: PendingUpload[] = [];
    Array.from(list).forEach((file) => {
      const kind = detectKind(file);
      if (!kind) rejected.push(`${file.name} (unsupported file type)`);
      else if (file.size === 0) rejected.push(`${file.name} (empty file)`);
      else if (file.size > MAX_UPLOAD_BYTES) rejected.push(`${file.name} (over ${formatBytes(MAX_UPLOAD_BYTES)})`);
      else accepted.push({ key: `${file.name}-${file.size}-${file.lastModified}`, file, kind, category: suggestCategory(kind, file.name) });
    });
    if (rejected.length > 0) toast('Some files were not added', rejected.join(', '), 'error');
    setPending((prev) => [...prev, ...accepted.filter((item) => !prev.some((existing) => existing.key === item.key))]);
    return accepted.length;
  };

  const openUpload = (sessionId?: string) => {
    setPending([]);
    setUploadSession(sessionId ?? (sessionFilter !== 'all' ? sessionFilter : mockSessions[0]?.id ?? ''));
    setUploadOpen(true);
  };

  const handlePanelDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length === 0) return;
    setPending([]);
    setUploadSession(sessionFilter !== 'all' ? sessionFilter : mockSessions[0]?.id ?? '');
    queueFiles(event.dataTransfer.files);
    setUploadOpen(true);
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
      toast('Nothing uploaded', `Already in this session: ${duplicates.map((item) => item.file.name).join(', ')}. Rename or remove them first.`, 'error');
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
        uploadedBy: CURRENT_USER,
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
    setSessionFilter((current) => (current === 'all' || current === uploadSession ? current : 'all'));
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
      uploadedBy: CURRENT_USER,
    });
    if (error) {
      toast('Recording not attached', error, 'error');
      return;
    }
    toast('Recording attached', `${newName} is ready to play.`);
    logActivity({ module: 'E-Session', action: 'Uploaded', summary: `Attached the recording ${newName}` });
    setAttachTarget(null);
  };

  const remove = async (file: SessionFile) => {
    const confirmed = await confirmAction({
      title: 'Remove this file?',
      description: `${file.name} will be removed from ${sessionTitle(file.sessionId)}. This cannot be undone.`,
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

  const recordings = files.filter((file) => file.kind === 'audio' || file.kind === 'video');
  const awaitingRecordings = recordings.filter((file) => !file.blob && !file.src).length;
  const totalBytes = files.reduce((sum, file) => sum + (file.size ?? 0), 0);
  const sessionsCovered = new Set(files.map((file) => file.sessionId)).size;

  const stats = [
    { label: 'Total files', value: String(files.length), icon: FolderOpen, hint: `${formatBytes(totalBytes)} stored` },
    { label: 'Documents', value: String(files.length - recordings.length), icon: FileText, hint: 'Agendas, minutes, supporting papers' },
    {
      label: 'Recordings',
      value: String(recordings.length),
      icon: FileVideo,
      hint: awaitingRecordings ? `${awaitingRecordings} awaiting upload` : 'Audio and video',
    },
    { label: 'Sessions covered', value: `${sessionsCovered}/${mockSessions.length}`, icon: CalendarDays, hint: 'Sessions with at least one file' },
  ];

  const groups = mockSessions
    .map((session) => ({ session, items: filtered.filter((file) => file.sessionId === session.id) }))
    .filter((group) => group.items.length > 0);
  const ungrouped = filtered.filter((file) => !mockSessions.some((session) => session.id === file.sessionId));

  const checklistSessionId = sessionFilter !== 'all' ? sessionFilter : mockSessions[0]?.id ?? '';
  const checklistSession = mockSessions.find((session) => session.id === checklistSessionId);
  const checklist = CHECKLIST_CATEGORIES.map((category) => {
    const matches = files.filter((file) => file.sessionId === checklistSessionId && file.category === category);
    const ready = matches.some((file) => file.blob || file.src);
    return { category, status: ready ? 'ready' : matches.length ? 'awaiting' : 'missing' } as const;
  });
  const readyCount = checklist.filter((item) => item.status === 'ready').length;

  const renderFile = (file: SessionFile) => {
    const Icon = KIND_ICONS[file.kind];
    const missing = !file.blob && !file.src;
    const canView = file.kind === 'pdf' || file.kind === 'image';
    const canPlay = file.kind === 'audio' || file.kind === 'video';
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
              {missing ? <span className="font-semibold text-amber-700">Recording not yet attached</span> : <span>{formatBytes(file.size)}</span>}
              <span aria-hidden>·</span>
              <span>
                {file.uploadedAt} by {file.uploadedBy}
              </span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 pl-[52px] sm:pl-0">
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
          <p className="text-sm text-text-muted">Agendas, minutes, recordings, and supporting documents for each session.</p>
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
          <header className="space-y-3 border-b border-border px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="mr-auto">
                <h2 className="text-base font-semibold text-text-main">
                  Files <span className="text-sm font-normal text-text-muted">({filtered.length})</span>
                </h2>
                <p className="hidden text-xs text-text-muted sm:block">Drag files here to upload</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative sm:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
                  <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search files" aria-label="Search session files" className="h-9 pl-8 text-sm" />
                </div>
                <select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} className={selectClass} aria-label="Filter by session">
                  <option value="all">All sessions</option>
                  {mockSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="-mx-1 overflow-x-auto px-1">
              <div className="inline-flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="File category">
                {CATEGORY_TABS.map((tab) => {
                  const active = categoryFilter === tab.value;
                  const count = files.filter((file) => matchesCategory(file, tab.value)).length;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setCategoryFilter(tab.value)}
                      className={cn(
                        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                        active ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
                      )}
                    >
                      {tab.label}
                      <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-primary/10 text-primary' : 'bg-white/70')}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </header>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-text-muted">
                <FolderOpen className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-text-main">No files found</p>
              <p className="text-xs text-text-muted">Try another search or category, or upload a new file.</p>
            </div>
          ) : (
            <div>
              {groups.map(({ session, items }) => {
                const date = new Date(`${session.date}T00:00:00`);
                return (
                  <div key={session.id}>
                    <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-5 py-2.5">
                      <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md bg-white text-primary ring-1 ring-border">
                        <span className="text-[8px] font-bold uppercase leading-none">{date.toLocaleDateString('en-PH', { month: 'short' })}</span>
                        <span className="text-sm font-bold leading-none">{date.getDate()}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text-main">{session.title}</p>
                        <p className="text-[11px] text-text-muted">
                          {session.type} · {items.length} file{items.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <ul className="divide-y divide-border border-b border-border last:border-b-0">{items.map(renderFile)}</ul>
                  </div>
                );
              })}
              {ungrouped.length > 0 ? <ul className="divide-y divide-border">{ungrouped.map(renderFile)}</ul> : null}
            </div>
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
                  <button type="button" onClick={() => openUpload(checklistSessionId)} className="text-xs font-semibold text-primary hover:underline">
                    Upload
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-text-muted">Pick a session in the filter to check its files.</p>
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
                  {sessionTitle(previewFile.sessionId)} · {previewFile.category} · {formatBytes(previewFile.size)}
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
      <DialogContent closeOnOverlayClick={false} className="flex flex-col gap-0 p-0 sm:max-w-2xl">
        <div className="border-b border-border px-6 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-primary">Upload Session Files</DialogTitle>
            <DialogDescription>Add agendas, minutes, recordings and supporting documents to a session.</DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 px-6 py-5">
          <label className="block text-xs font-semibold text-text-muted">
            Session
            <select value={uploadSession} onChange={(e) => setUploadSession(e.target.value)} className={cn(selectClass, 'mt-1 w-full')}>
              {mockSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} ({session.date})
                </option>
              ))}
            </select>
          </label>

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
            <p className="text-sm font-semibold">Drop files here or click to browse</p>
            <p className="text-[11px] text-text-muted">PDF, audio, video, images and Office documents · up to {formatBytes(MAX_UPLOAD_BYTES)} each</p>
          </div>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS}
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
                    <select
                      value={item.category}
                      onChange={(e) =>
                        setPending((prev) => prev.map((entry) => (entry.key === item.key ? { ...entry, category: e.target.value as FileCategory } : entry)))
                      }
                      className={cn(selectClass, 'h-8 text-xs')}
                      aria-label={`Category for ${item.file.name}`}
                    >
                      {FILE_CATEGORIES.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
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
          <span className="text-xs text-text-muted">
            {pending.length} file(s) · {formatBytes(pending.reduce((sum, item) => sum + item.file.size, 0))}
          </span>
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
    </>
  );
}
