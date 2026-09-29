import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import { CountUp } from '@/components/dashboard/charts';
import { todayInManila, type FileCategory } from '@/lib/session-files';
import { cn } from '@/lib/utils';

// Building blocks shared by the role dashboards.

export const SESSION_TYPE_TONE: Record<string, string> = {
  Regular: 'bg-primary/10 text-primary',
  Special: 'bg-orange-50 text-orange-800',
  'Committee Hearing': 'bg-violet-50 text-violet-800',
};

/** What a complete session folder holds (same list as the Session Files checklist). */
export const CHECKLIST_CATEGORIES: FileCategory[] = ['Agenda', 'Order of Business', 'Minutes', 'Audio Recording', 'Video Recording'];

export function Card({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('glass-card rounded-xl border border-border bg-white p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-main">{title}</h2>
          {subtitle ? <p className="text-xs text-text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 text-xs font-semibold text-primary hover:underline">
      {children}
    </button>
  );
}

export const formatShortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

export const dayMonth = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

export const relativeDays = (iso: string) => {
  const days = Math.round((new Date(`${todayInManila()}T00:00:00`).getTime() - new Date(`${iso}T00:00:00`).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
};

export interface Tile {
  label: string;
  period: string;
  value: number;
  icon: LucideIcon;
  /** Page the tile opens; it is not clickable when the role cannot open it. */
  tab: string;
  delta?: { value: number; upIsGood: boolean | null; versus: string };
  /** Shown after the number, e.g. "%". */
  suffix?: string;
  footer?: React.ReactNode;
}

export function StatTiles({ tiles, can, onNavigate }: { tiles: Tile[]; can: (tab: string) => boolean; onNavigate: (tab: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => {
        const delta = tile.delta;
        const deltaTone =
          !delta || delta.value === 0 || delta.upIsGood === null
            ? 'bg-slate-100 text-slate-600'
            : (delta.value > 0) === delta.upIsGood
              ? 'bg-green-50 text-[#006300]'
              : 'bg-red-50 text-red-700';
        const DeltaIcon = !delta || delta.value === 0 ? Minus : delta.value > 0 ? ArrowUpRight : ArrowDownRight;
        const linked = can(tile.tab);
        return (
          <button
            key={tile.label}
            type="button"
            onClick={() => linked && onNavigate(tile.tab)}
            disabled={!linked}
            className={cn(
              'glass-card group flex flex-col rounded-xl border border-border bg-white p-5 text-left shadow-sm transition-all',
              linked ? 'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md' : 'cursor-default'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-text-main">{tile.label}</span>
                <span className="block truncate text-[11px] text-text-muted">{tile.period}</span>
              </span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-enabled:group-hover:bg-primary group-enabled:group-hover:text-white">
                <tile.icon className="h-[18px] w-[18px]" />
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2.5">
              <span className="text-[32px] font-semibold leading-none text-text-main">
                <CountUp value={tile.value} />
                {tile.suffix}
              </span>
              {delta ? (
                <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold', deltaTone)}>
                  <DeltaIcon className="h-3 w-3" />
                  {delta.value > 0 ? `+${delta.value}` : delta.value} vs {delta.versus}
                </span>
              ) : null}
            </div>

            {tile.footer ? <div className="mt-auto w-full pt-4">{tile.footer}</div> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Empty state inside a card. */
export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-text-muted">{children}</p>;
}
