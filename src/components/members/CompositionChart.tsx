import { Gavel } from 'lucide-react';
import { mockCommitteeAssignments, mockCommittees, mockMembers, type Committee, type Member } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

export type CommitteeRole = 'Chair' | 'Vice Chair' | 'Member';

export const shortCommitteeName = (name: string) => name.replace('Committee on ', '');

/** Committees a member sits in, with their role in each. */
export const committeeRolesOf = (memberId: string, committees: Committee[] = mockCommittees) =>
  committees.flatMap((committee): { committee: Committee; role: CommitteeRole }[] => {
    const assignment = mockCommitteeAssignments[committee.id];
    if (!assignment) return [];
    if (assignment.chair === memberId) return [{ committee, role: 'Chair' }];
    if (assignment.viceChair === memberId) return [{ committee, role: 'Vice Chair' }];
    if (assignment.members.includes(memberId)) return [{ committee, role: 'Member' }];
    return [];
  });

export interface CompositionLabels {
  regularMembers: string;
  regularSummary: (count: number) => string;
  exOfficioMembers: string;
  presidingOfficer: string;
  presides: string;
  chair: string;
  committees: (count: number) => string;
  roles: Record<string, string>;
}

const DEFAULT_LABELS: CompositionLabels = {
  regularMembers: 'Regular members',
  regularSummary: (count) => `${count} councilors · elected at large`,
  exOfficioMembers: 'Ex-officio members',
  presidingOfficer: 'Presiding Officer',
  presides: 'Presides over sessions',
  chair: 'Chair',
  committees: (count) => `${count} committees`,
  roles: {},
};

interface MemberNodeProps {
  member: Member;
  chairs: string[];
  labels: CompositionLabels;
  onOpen?: () => void;
  variant?: 'featured' | 'card' | 'row';
}

function ChairBadge({ chairs, labels, className }: { chairs: string[]; labels: CompositionLabels; className?: string }) {
  return (
    <span
      className={cn('inline-flex max-w-full items-start gap-1 rounded-lg bg-[#fdf6e3] px-2 py-1 text-left text-[10px] font-semibold leading-snug text-[#8a6a12]', className)}
      title={`${labels.chair}: ${chairs.join(', ')}`}
    >
      <Gavel className="mt-px h-3 w-3 shrink-0" />
      {/* The gavel (explained in the chart legend) marks the chair, leaving the room for the committee name. */}
      <span className="line-clamp-3 sm:line-clamp-2">
        <span className="sr-only">{labels.chair}: </span>
        {chairs.length === 1 ? chairs[0] : labels.committees(chairs.length)}
      </span>
    </span>
  );
}

function MemberNode({ member, chairs, labels, onOpen, variant = 'card' }: MemberNodeProps) {
  const role = member.seat === 'Presiding Officer' ? labels.presidingOfficer : labels.roles[member.role] ?? member.role;

  // Ex-officio members sit in a narrow column, so they get a compact horizontal card.
  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group flex h-full w-full items-center gap-3 rounded-xl border border-border bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary group-hover:bg-primary group-hover:text-white">
          {member.abbr}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold leading-tight text-text-main">{member.name}</span>
          <span className="mt-0.5 block text-[10px] text-text-muted">{role}</span>
          {chairs.length > 0 ? <ChairBadge chairs={chairs} labels={labels} className="mt-1.5" /> : null}
        </span>
      </button>
    );
  }

  const featured = variant === 'featured';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative flex h-full w-full flex-col items-center rounded-xl border bg-white px-3 pb-3 pt-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-md',
        featured ? 'border-[#d4a72c]/60 shadow-sm ring-4 ring-[#d4a72c]/10' : 'border-border hover:border-primary/40'
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full font-bold',
          featured ? 'h-14 w-14 bg-gradient-to-br from-[#1a237e] to-[#0d1452] text-sm text-white ring-2 ring-[#d4a72c]' : 'h-11 w-11 bg-primary/10 text-[11px] text-primary group-hover:bg-primary group-hover:text-white'
        )}
      >
        {member.abbr}
      </span>
      <span className={cn('mt-2 font-semibold leading-tight text-text-main', featured ? 'text-sm' : 'text-[12px]')}>{member.name}</span>
      <span className="mt-0.5 text-[10px] text-text-muted">{role}</span>
      {chairs.length > 0 ? (
        <ChairBadge chairs={chairs} labels={labels} className="mt-auto" />
      ) : featured ? (
        <span className="mt-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{labels.presides}</span>
      ) : null}
    </button>
  );
}

/** Organization chart of the members: presiding officer, regular members, and ex-officio members. */
export function CompositionChart({
  onSelect,
  committees = mockCommittees,
  labels: labelOverrides,
}: {
  onSelect?: (memberId: string) => void;
  committees?: Committee[];
  labels?: Partial<CompositionLabels>;
}) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const presiding = mockMembers.filter((member) => member.seat === 'Presiding Officer');
  const regular = mockMembers.filter((member) => member.seat === 'At-large');
  const exOfficio = mockMembers.filter((member) => member.seat === 'Ex-officio');
  const chairsOf = (memberId: string) =>
    committeeRolesOf(memberId, committees)
      .filter((entry) => entry.role === 'Chair')
      .map((entry) => shortCommitteeName(entry.committee.name));
  const open = (memberId: string) => (onSelect ? () => onSelect(memberId) : undefined);

  // Both rows share this template, so the connectors line up with the centre of each group.
  const groupColumns = 'lg:grid-cols-[2.6fr_1fr]';
  const line = 'bg-[#c9ced8]';

  return (
    <div className="bg-[radial-gradient(circle_at_1px_1px,#e5e7eb_1px,transparent_0)] [background-size:18px_18px] px-4 py-6 sm:px-5">
      <div className="mx-auto w-full max-w-[230px]">
        {presiding.map((member) => (
          <MemberNode key={member.id} member={member} chairs={chairsOf(member.id)} labels={labels} onOpen={open(member.id)} variant="featured" />
        ))}
      </div>

      {/* Connectors: presiding officer down to a bar that runs from the centre of one group to the other. */}
      <div className="relative hidden h-10 lg:block" aria-hidden>
        <span className={cn('absolute left-1/2 top-0 h-5 w-px', line)} />
        <div className={cn('absolute inset-x-0 top-5 grid h-5 gap-5', groupColumns)}>
          <div className="relative">
            <span className={cn('absolute -right-5 left-1/2 top-0 h-px', line)} />
            <span className={cn('absolute left-1/2 top-0 h-5 w-px', line)} />
          </div>
          <div className="relative">
            <span className={cn('absolute left-0 right-1/2 top-0 h-px', line)} />
            <span className={cn('absolute left-1/2 top-0 h-5 w-px', line)} />
          </div>
        </div>
      </div>

      <div className={cn('mt-6 grid grid-cols-1 gap-5 lg:mt-0', groupColumns)}>
        <div className="rounded-xl border border-dashed border-[#c9ced8] bg-white/70 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {labels.regularMembers}
            <span className="font-medium normal-case tracking-normal">{labels.regularSummary(regular.length)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {regular.map((member) => (
              <MemberNode key={member.id} member={member} chairs={chairsOf(member.id)} labels={labels} onOpen={open(member.id)} />
            ))}
          </div>
        </div>
        <div className="flex flex-col rounded-xl border border-dashed border-[#c9ced8] bg-white/70 p-3">
          <div className="mb-3 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {labels.exOfficioMembers}
            <span>{exOfficio.length}</span>
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
            {exOfficio.map((member) => (
              <MemberNode key={member.id} member={member} chairs={chairsOf(member.id)} labels={labels} onOpen={open(member.id)} variant="row" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
