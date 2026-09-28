import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { PHASE_COLORS } from '@/components/dashboard/charts';
import { cn } from '@/lib/utils';

export const LEGISLATIVE_PHASES = ['Filing', 'Deliberation', 'Approval'];

// The legislative lifecycle in order; `phase` indexes LEGISLATIVE_PHASES and PHASE_COLORS.
export const LEGISLATIVE_STAGES: { status: string; phase: number }[] = [
  { status: 'Draft', phase: 0 },
  { status: 'First Reading', phase: 0 },
  { status: 'Committee', phase: 1 },
  { status: 'Second Reading', phase: 1 },
  { status: 'Third Reading', phase: 1 },
  { status: 'Passed', phase: 2 },
  { status: 'Enacted', phase: 2 },
];

// What happens to a measure while it sits at each stage.
const STAGE_DETAIL: Record<string, string> = {
  Draft: 'Being prepared by the author before it is filed with the Secretariat.',
  'First Reading': 'Read in session by title and number, then referred to the proper committee.',
  Committee: 'Under committee study. Public hearings may be held and a committee report is prepared.',
  'Second Reading': 'Committee report presented in session; the measure is debated and amended on the floor.',
  'Third Reading': 'Final reading; the body votes on the measure as a whole, without amendments.',
  Passed: "Approved by the Sanggunian and transmitted for the Mayor's approval.",
  Enacted: 'Approved and posted or published; the measure is now in effect.',
};

/** 0% at Draft, 100% once enacted. */
export const stageProgress = (step: number) => Math.round((step / (LEGISLATIVE_STAGES.length - 1)) * 100);

export function statusBadgeClassName(status: string) {
  return cn(
    'inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold',
    ['Enacted', 'Passed', 'Approved', 'Available'].includes(status)
      ? 'border-green-200 bg-green-50 text-green-800'
      : ['Vetoed', 'Disapproved'].includes(status)
        ? 'border-red-200 bg-red-50 text-red-800'
        : ['Draft', 'Received', 'Submitted'].includes(status)
          ? 'border-slate-200 bg-slate-50 text-slate-700'
          : 'border-amber-200 bg-amber-50 text-amber-800'
  );
}

const CARD_WIDTH = 288;

/** Optional translator for pages that switch language; English when omitted. */
export type StageTranslator = (text: string, vars?: Record<string, string | number>) => string;
const english: StageTranslator = (text, vars) =>
  vars ? Object.entries(vars).reduce((out, [key, value]) => out.split(`{${key}}`).join(String(value)), text) : text;

/** Hover and focus card showing where a measure is in the lifecycle; renders children alone for non-lifecycle statuses. */
function StageHoverCard({
  status,
  align = 'center',
  className,
  tr = english,
  children,
}: {
  status: string;
  align?: 'center' | 'start';
  className?: string;
  tr?: StageTranslator;
  children: React.ReactNode;
}) {
  const step = LEGISLATIVE_STAGES.findIndex((stage) => stage.status === status);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const cardId = useId();
  const alignClass = align === 'center' ? 'items-center' : 'items-start';

  if (step < 0) return <div className={cn('inline-flex flex-col gap-1', alignClass, className)}>{children}</div>;

  const stage = LEGISLATIVE_STAGES[step];
  const percent = stageProgress(step);
  const phase = LEGISLATIVE_PHASES[stage.phase];
  const next = LEGISLATIVE_STAGES[step + 1];

  // Fixed to the viewport so scrolling tables can't clip it; opens to the left of the anchor when it fits.
  const showCard = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 10;
    const left = rect.left - CARD_WIDTH - gap >= 8 ? rect.left - CARD_WIDTH - gap : Math.min(rect.right + gap, window.innerWidth - CARD_WIDTH - 8);
    const top = Math.max(8, Math.min(rect.top + rect.height / 2 - 170, window.innerHeight - 348));
    setCardPos({ top, left });
  };
  const hideCard = () => setCardPos(null);

  return (
    <div
      ref={anchorRef}
      tabIndex={0}
      onMouseEnter={showCard}
      onMouseLeave={hideCard}
      onFocus={showCard}
      onBlur={hideCard}
      aria-describedby={cardPos ? cardId : undefined}
      className={cn('inline-flex cursor-help flex-col gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/40', alignClass, className)}
    >
      {children}

      {cardPos
        ? createPortal(
            <div
              id={cardId}
              role="tooltip"
              className="pointer-events-none fixed z-[60] rounded-xl border border-border bg-white p-4 text-left shadow-xl"
              style={{ top: cardPos.top, left: cardPos.left, width: CARD_WIDTH }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    {tr('{phase} phase · Stage {step} of {total}', { phase: tr(phase), step: step + 1, total: LEGISLATIVE_STAGES.length })}
                  </p>
                  <p className="text-sm font-semibold text-text-main">{tr(status)}</p>
                </div>
                <span className="text-lg font-bold tabular-nums text-primary">{percent}%</span>
              </div>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#e5e7eb]">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(percent, 3)}%`, backgroundColor: PHASE_COLORS[stage.phase] }} />
              </span>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">{tr(STAGE_DETAIL[status])}</p>

              <ol className="mt-3 space-y-1.5">
                {LEGISLATIVE_STAGES.map((entry, index) => {
                  const done = index < step;
                  const current = index === step;
                  return (
                    <li key={entry.status} className="flex items-center gap-2 text-xs">
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                          done ? 'text-white' : current ? 'text-white ring-2 ring-offset-1' : 'bg-muted text-text-muted'
                        )}
                        style={done || current ? { backgroundColor: PHASE_COLORS[entry.phase], ...(current ? { ['--tw-ring-color' as string]: PHASE_COLORS[entry.phase] } : {}) } : undefined}
                      >
                        {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : index + 1}
                      </span>
                      <span className={cn('flex-1', current ? 'font-semibold text-text-main' : done ? 'text-text-main' : 'text-text-muted')}>{tr(entry.status)}</span>
                      {current ? <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary">{tr('Current')}</span> : null}
                    </li>
                  );
                })}
              </ol>

              <p className="mt-3 border-t border-border pt-2 text-[11px] text-text-muted">
                {next ? (
                  <>
                    {tr('Next:')} <span className="font-semibold text-text-main">{tr(next.status)}</span>
                  </>
                ) : (
                  <span className="font-semibold text-green-700">{tr('Complete: the measure is in effect.')}</span>
                )}
              </p>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

/** Progress bar with the percentage, phase, and step for a lifecycle stage; a dash for other statuses. */
function ProgressLines({ status, tr }: { status: string; tr: StageTranslator }) {
  const step = LEGISLATIVE_STAGES.findIndex((stage) => stage.status === status);
  if (step < 0) return <span className="text-xs text-text-muted">—</span>;
  const stage = LEGISLATIVE_STAGES[step];
  const percent = stageProgress(step);
  const total = LEGISLATIVE_STAGES.length;
  return (
    <>
      <span className="flex items-center gap-1.5" role="img" aria-label={tr('{percent}% complete, stage {step} of {total}', { percent, step: step + 1, total })}>
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#e5e7eb]">
          <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(percent, 4)}%`, backgroundColor: PHASE_COLORS[stage.phase] }} />
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-text-main">{percent}%</span>
      </span>
      <span className="whitespace-nowrap text-[10px] text-text-muted">
        {tr('{phase} · {step} of {total}', { phase: tr(LEGISLATIVE_PHASES[stage.phase]), step: step + 1, total })}
      </span>
    </>
  );
}

/** Status pill; for lifecycle stages, unless `showProgress` is off, the progress bar (which carries the hover card) sits underneath. */
export function StatusBadge({
  status,
  align = 'center',
  className,
  showProgress = true,
  tr = english,
}: {
  status: string;
  align?: 'center' | 'start';
  className?: string;
  showProgress?: boolean;
  tr?: StageTranslator;
}) {
  const inLifecycle = LEGISLATIVE_STAGES.some((stage) => stage.status === status);
  return (
    <div className={cn('inline-flex flex-col gap-1', align === 'center' ? 'items-center' : 'items-start', className)}>
      <span className={statusBadgeClassName(status)}>{tr(status)}</span>
      {showProgress && inLifecycle ? <StageProgress status={status} align={align} tr={tr} /> : null}
    </div>
  );
}

/** The progress bar on its own, for tables that show stage and progress in separate columns. */
export function StageProgress({ status, align = 'center', className, tr = english }: { status: string; align?: 'center' | 'start'; className?: string; tr?: StageTranslator }) {
  return (
    <StageHoverCard status={status} align={align} className={className} tr={tr}>
      <ProgressLines status={status} tr={tr} />
    </StageHoverCard>
  );
}
