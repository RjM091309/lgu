import { useSyncExternalStore } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastTone = 'success' | 'info' | 'error';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const dismiss = (id: number) => {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
};

export function toast(title: string, description?: string, tone: ToastTone = 'success') {
  const id = nextId++;
  toasts = [...toasts, { id, title, description, tone }].slice(-4);
  emit();
  setTimeout(() => dismiss(id), 4000);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Light tinted backgrounds with a strong left accent so the toast stands out against white pages and modals.
const toneStyles: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'border-[#a5d6a7] border-l-[#2e7d32] bg-[#dcf1dd] text-[#1b5e20]' },
  info: { icon: Info, className: 'border-[#c5cae9] border-l-primary bg-[#e3e6f7] text-primary' },
  error: { icon: XCircle, className: 'border-[#ef9a9a] border-l-[#c62828] bg-[#fde0e0] text-[#b71c1c]' },
};

export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {items.map((item) => {
        const { icon: Icon, className } = toneStyles[item.tone];
        return (
          <div key={item.id} className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 p-4 shadow-xl ${className}`}>
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{item.title}</p>
              {item.description ? <p className="mt-0.5 text-xs text-text-main/80">{item.description}</p> : null}
            </div>
            <button type="button" onClick={() => dismiss(item.id)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
