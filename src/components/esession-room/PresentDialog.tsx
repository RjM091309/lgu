import { useRef, useState } from 'react';
import { FileImage, FileText, FolderOpen, Loader2, MonitorUp, Search, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FILE_CATEGORIES, fileUrl, formatBytes, latestVersions, useSessionFiles, type FileCategory, type SessionFile } from '@/lib/session-files';
import { isPresentable } from '@/lib/file-presenter';
import { cn } from '@/lib/utils';

// What to present: the screen (computers only), a PDF or picture from this session's folder in Session Files,
// or one from the device itself.

const option = 'flex w-full items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-left hover:border-primary/40 hover:bg-primary/[0.03] disabled:opacity-50';

// A handful of files is easy to scan; past this a search box helps find one.
const SEARCH_AFTER = 6;

const ALL = 'All' as const;

const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

const details = (file: SessionFile) =>
  [file.kind === 'pdf' ? 'PDF' : 'Picture', file.size === null ? null : formatBytes(file.size), shortDate(file.uploadedAt), file.uploadedBy].filter(Boolean).join(' · ');

export function PresentDialog({
  open,
  onOpenChange,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  canShareScreen: boolean;
  onShareScreen: () => void;
  /** Resolves once the file is on stage (or failed, with the reason shown by the caller). */
  onPresentFile: (file: Blob, name: string) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-lg flex-col">
        {/* Unmounted on close, so the search and category start fresh each time. */}
        <PresentOptions {...props} />
      </DialogContent>
    </Dialog>
  );
}

function PresentOptions({
  sessionId,
  canShareScreen,
  onShareScreen,
  onPresentFile,
}: {
  sessionId: string;
  canShareScreen: boolean;
  onShareScreen: () => void;
  onPresentFile: (file: Blob, name: string) => Promise<void>;
}) {
  const files = useSessionFiles();
  const input = useRef<HTMLInputElement>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [picked, setCategory] = useState<FileCategory | typeof ALL>(ALL);
  const [keyword, setKeyword] = useState('');

  const folder = latestVersions(files)
    .filter((file) => file.sessionId === sessionId && (file.kind === 'pdf' || file.kind === 'image') && (file.blob || file.src))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  // Categories in the order a session folder is put together, only those with something to present.
  const categories = FILE_CATEGORIES.filter((entry) => folder.some((file) => file.category === entry));
  // Back to All if the picked category's last file is removed while the dialog is open.
  const category = picked !== ALL && categories.includes(picked) ? picked : ALL;
  const q = keyword.trim().toLowerCase();
  const shown = folder.filter(
    (file) => (category === ALL || file.category === category) && (!q || [file.name, file.category, file.uploadedBy].some((value) => value.toLowerCase().includes(q)))
  );
  const groups = categories.map((entry) => ({ category: entry, files: shown.filter((file) => file.category === entry) })).filter((group) => group.files.length);

  const present = async (key: string, load: () => Promise<Blob>, name: string) => {
    setOpening(key);
    try {
      await onPresentFile(await load(), name);
    } finally {
      setOpening(null);
    }
  };

  const fromFolder = (file: SessionFile) =>
    present(
      file.id,
      async () => {
        if (file.blob) return file.blob;
        const url = fileUrl(file);
        const res = url ? await fetch(url) : null;
        if (!res?.ok) throw new Error(`${file.name} could not be loaded from Session Files.`);
        return res.blob();
      },
      file.name
    );

  const fileButton = (file: SessionFile) => (
    <li key={file.id}>
      <button
        type="button"
        className={cn(option, 'py-2')}
        onClick={() => void fromFolder(file).catch(() => undefined)}
        disabled={opening !== null}
        title={file.changeNote ? `${file.name}\n${file.changeNote}` : file.name}
      >
        {opening === file.id ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
        ) : file.kind === 'pdf' ? (
          <FileText className="h-5 w-5 shrink-0 text-primary" />
        ) : (
          <FileImage className="h-5 w-5 shrink-0 text-primary" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-text-main">{file.name}</span>
            {(file.version ?? 1) > 1 ? (
              <span className="shrink-0 rounded bg-primary/10 px-1.5 text-[10px] font-bold text-primary">v{file.version}</span>
            ) : null}
          </span>
          <span className="block truncate text-xs text-text-muted">{details(file)}</span>
        </span>
      </button>
    </li>
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl text-primary">Present</DialogTitle>
        <DialogDescription>Everyone in the e-session sees what you present, and can zoom in on it.</DialogDescription>
      </DialogHeader>

      {canShareScreen ? (
        <button type="button" className={cn(option, 'mt-4')} onClick={onShareScreen} disabled={opening !== null}>
          <MonitorUp className="h-5 w-5 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-semibold text-text-main">Share your screen</span>
            <span className="block text-xs text-text-muted">A window, a browser tab (such as the LIMS dashboard), or the whole screen.</span>
          </span>
        </button>
      ) : null}

      {/* Only the file list scrolls, so sharing the screen and choosing from the device stay in reach. */}
      <section className="mt-4 flex min-h-[9rem] shrink flex-col">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">
          <FolderOpen className="h-3.5 w-3.5" />
          From this session's files
          {folder.length ? <span className="font-semibold normal-case tracking-normal">({folder.length})</span> : null}
        </h3>

        {folder.length ? (
          <>
            {categories.length > 1 ? (
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Category">
                {[ALL, ...categories].map((entry) => {
                  const count = entry === ALL ? folder.length : folder.filter((file) => file.category === entry).length;
                  const active = category === entry;
                  return (
                    <button
                      key={entry}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCategory(entry)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-semibold',
                        active ? 'border-primary bg-primary text-white' : 'border-border text-text-muted hover:border-primary/40 hover:text-text-main'
                      )}
                    >
                      {entry} <span className={active ? 'opacity-80' : 'opacity-70'}>{count}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {folder.length > SEARCH_AFTER ? (
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Search by file name or uploader" className="h-9 pl-9" aria-label="Search session files" />
              </div>
            ) : null}

            <div className="mt-2 min-h-0 shrink overflow-y-auto pr-1">
              {groups.length === 0 ? (
                <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-text-muted">No files match “{keyword.trim()}”.</p>
              ) : category === ALL ? (
                groups.map((group) => (
                  <div key={group.category} className="mb-3 last:mb-0">
                    <h4 className="sticky top-0 z-10 bg-white py-1 text-[11px] font-semibold text-text-muted">
                      {group.category} <span className="opacity-70">· {group.files.length}</span>
                    </h4>
                    <ul className="space-y-1.5">{group.files.map(fileButton)}</ul>
                  </div>
                ))
              ) : (
                <ul className="space-y-1.5">{shown.map(fileButton)}</ul>
              )}
            </div>
          </>
        ) : (
          <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-text-muted">No PDFs or pictures in this session's folder yet. Files added in Session Files show here.</p>
        )}
      </section>

      <section className="mt-4">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">
          <Smartphone className="h-3.5 w-3.5" />
          From this device
        </h3>
        <button type="button" className={cn(option, 'mt-2')} onClick={() => input.current?.click()} disabled={opening !== null}>
          {opening === 'device' ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" /> : <FileText className="h-5 w-5 shrink-0 text-primary" />}
          <span>
            <span className="block text-sm font-semibold text-text-main">Choose a PDF or picture</span>
            <span className="block text-xs text-text-muted">It is shown to everyone but not saved to Session Files.</span>
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf,image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file && isPresentable(file.name, file.type)) void present('device', async () => file, file.name).catch(() => undefined);
          }}
        />
      </section>
    </>
  );
}
