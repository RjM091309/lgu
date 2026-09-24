import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ConfirmTone = 'default' | 'destructive';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

let state: { open: boolean; request: ConfirmRequest | null } = { open: false, request: null };
const listeners = new Set<() => void>();

const setState = (next: typeof state) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const settle = (confirmed: boolean) => {
  if (!state.open) return;
  state.request?.resolve(confirmed);
  setState({ ...state, open: false });
};

// Asks the user to confirm before a submit goes through. Resolves true only when they press the confirm button.
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  state.request?.resolve(false);
  return new Promise((resolve) => setState({ open: true, request: { ...options, resolve } }));
}

export function ConfirmDialogHost() {
  const { open, request } = useSyncExternalStore(subscribe, () => state);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Capture Escape here so it cancels only this confirmation, not a form modal underneath it.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      settle(false);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    const frame = requestAnimationFrame(() => confirmRef.current?.focus());
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  const destructive = request?.tone === 'destructive';
  const Icon = destructive ? AlertTriangle : ShieldCheck;

  return createPortal(
    <div className="relative z-[80]">
      <Dialog open={open} onOpenChange={(next) => !next && settle(false)}>
        <DialogContent hideClose className="max-w-md">
          {request ? (
            <>
              <div className="flex gap-4">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    destructive ? 'bg-[#ffebee] text-[#c62828]' : 'bg-primary/10 text-primary'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <DialogHeader className="space-y-2">
                  <DialogTitle className="text-primary">{request.title}</DialogTitle>
                  {request.description ? <DialogDescription>{request.description}</DialogDescription> : null}
                </DialogHeader>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => settle(false)}>
                  {request.cancelLabel ?? 'Cancel'}
                </Button>
                <Button
                  ref={confirmRef}
                  onClick={() => settle(true)}
                  className={destructive ? 'bg-[#c62828] hover:bg-[#b71c1c] hover:opacity-100' : undefined}
                >
                  {request.confirmLabel ?? 'Confirm'}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>,
    document.body
  );
}
