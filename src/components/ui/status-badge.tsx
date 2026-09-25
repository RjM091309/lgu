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

/** Status pill plus, for lifecycle stages, a 7-step meter showing how far the measure has progressed. */
export function StatusBadge({ status, align = 'center', className }: { status: string; align?: 'center' | 'start'; className?: string }) {
  const step = LEGISLATIVE_STAGES.findIndex((stage) => stage.status === status);
  return (
    <div className={cn('inline-flex flex-col gap-1.5', align === 'center' ? 'items-center' : 'items-start', className)}>
      <span className={statusBadgeClassName(status)}>{status}</span>
      {step >= 0 ? (
        <span
          className="flex gap-0.5"
          role="img"
          aria-label={`Stage ${step + 1} of ${LEGISLATIVE_STAGES.length}`}
          title={`Stage ${step + 1} of ${LEGISLATIVE_STAGES.length}`}
        >
          {LEGISLATIVE_STAGES.map((stage, index) => (
            <span
              key={stage.status}
              className="h-1 w-2.5 rounded-full"
              style={{ backgroundColor: index <= step ? PHASE_COLORS[stage.phase] : '#e5e7eb' }}
            />
          ))}
        </span>
      ) : null}
    </div>
  );
}
