import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Session } from '@/lib/mock-data';
import type { RsvpStatus } from '@/lib/attendance';
import type { Notice } from '@/lib/esession-sync';
import { cn } from '@/lib/utils';

export type MyStatus = RsvpStatus | 'none';

export const STATUS_CHIP: Record<MyStatus, { label: string; tone: string }> = {
  attending: { label: 'Attending', tone: 'border-green-200 bg-green-50 text-green-800' },
  declined: { label: 'Not attending', tone: 'border-red-200 bg-red-50 text-red-800' },
  none: { label: 'Reply needed', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
};

export function StatusChip({ status, className }: { status: MyStatus; className?: string }) {
  const chip = STATUS_CHIP[status];
  return <span className={cn('inline-flex h-6 shrink-0 items-center rounded-full border px-2 text-[11px] font-semibold', chip.tone, className)}>{chip.label}</span>;
}

export const noticeText = (notice: Notice, title: string) =>
  notice.kind === 'reminder'
    ? { heading: 'Please confirm your attendance', body: `${title} · reminder from ${notice.from}` }
    : notice.kind === 'announcement'
      ? { heading: notice.text ?? 'Notice from the Secretariat', body: `${title} · ${notice.from}` }
      : { heading: 'New session scheduled', body: `${title} · by ${notice.from}` };

/** Short label for a session type on small screens. */
export const typeLabel = (type: Session['type']) => (type === 'Committee Hearing' ? 'Hearing' : type);

const dayMs = 86_400_000;
const isoToUtc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** Days from `today` to `iso` (negative for past dates). */
export const daysBetween = (today: string, iso: string) => Math.round((isoToUtc(iso) - isoToUtc(today)) / dayMs);

export const relativeDay = (today: string, iso: string) => {
  const days = daysBetween(today, iso);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
};

export const dateParts = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  return {
    weekday: date.toLocaleDateString('en-PH', { weekday: 'short' }),
    day: date.getDate(),
    month: date.toLocaleDateString('en-PH', { month: 'short' }),
    medium: date.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }),
  };
};

/** `YYYY-MM-DDTHH:mm` stamps (both Manila time) → "5 min ago", "2 h ago", "Sep 24". */
export const timeAgo = (now: string, stamp: string) => {
  const toMs = (value: string) => isoToUtc(value) + Number(value.slice(11, 13)) * 3_600_000 + Number(value.slice(14, 16)) * 60_000;
  const minutes = Math.round((toMs(now) - toMs(stamp)) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return new Date(`${stamp}:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

/** A panel that slides up from the bottom of the screen. */
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="sheet"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-slate-300" aria-hidden />
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-primary">{title}</h2>
              <button type="button" onClick={onClose} className="rounded-full p-1.5 text-text-muted hover:bg-muted" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
