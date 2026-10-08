import { useRef, useState } from 'react';
import { FileImage, FileText, FolderOpen, Loader2, MonitorUp, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fileUrl, latestVersions, useSessionFiles, type SessionFile } from '@/lib/session-files';
import { isPresentable } from '@/lib/file-presenter';
import { cn } from '@/lib/utils';

// What to present: the screen (computers only), a PDF or picture from this session's folder in Session Files,
// or one from the device itself.

const option = 'flex w-full items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-left hover:border-primary/40 hover:bg-primary/[0.03] disabled:opacity-50';

export function PresentDialog({
  open,
  onOpenChange,
  sessionId,
  canShareScreen,
  onShareScreen,
  onPresentFile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  canShareScreen: boolean;
  onShareScreen: () => void;
  /** Resolves once the file is on stage (or failed, with the reason shown by the caller). */
  onPresentFile: (file: Blob, name: string) => Promise<void>;
}) {
  const files = useSessionFiles();
  const input = useRef<HTMLInputElement>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const folder = latestVersions(files).filter((file) => file.sessionId === sessionId && (file.kind === 'pdf' || file.kind === 'image') && (file.blob || file.src));

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-primary">Present</DialogTitle>
          <DialogDescription>Everyone in the e-session sees what you present, and can zoom in on it.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          {canShareScreen ? (
            <button type="button" className={option} onClick={onShareScreen} disabled={opening !== null}>
              <MonitorUp className="h-5 w-5 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-semibold text-text-main">Share your screen</span>
                <span className="block text-xs text-text-muted">A window, a browser tab (such as the LIMS dashboard), or the whole screen.</span>
              </span>
            </button>
          ) : null}

          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">
              <FolderOpen className="h-3.5 w-3.5" />
              From this session's files
            </h3>
            {folder.length ? (
              <ul className="mt-2 space-y-1.5">
                {folder.map((file) => (
                  <li key={file.id}>
                    <button type="button" className={option} onClick={() => void fromFolder(file).catch(() => undefined)} disabled={opening !== null}>
                      {opening === file.id ? (
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                      ) : file.kind === 'pdf' ? (
                        <FileText className="h-5 w-5 shrink-0 text-primary" />
                      ) : (
                        <FileImage className="h-5 w-5 shrink-0 text-primary" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-text-main">{file.name}</span>
                        <span className="block text-xs text-text-muted">{file.category}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-text-muted">No PDFs or pictures in this session's folder yet. Files added in Session Files show here.</p>
            )}
          </section>

          <section>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
