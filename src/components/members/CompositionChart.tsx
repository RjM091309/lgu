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

function MemberNode({ member, chairs, onOpen, featured = false }: { member: Member; chairs: string[]; onOpen?: () => void; featured?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative flex w-full flex-col items-center rounded-xl border bg-white px-3 pb-3 pt-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-md',
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
      <span className="mt-0.5 text-[10px] text-text-muted">{member.seat === 'Presiding Officer' ? 'Presiding Officer' : member.role}</span>
      {chairs.length > 0 ? (
        <span className="mt-2 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-[#fdf6e3] px-2 py-0.5 text-[10px] font-semibold text-[#8a6a12]" title={`Chair: ${chairs.join(', ')}`}>
          <Gavel className="h-3 w-3 shrink-0" />
          <span className="truncate">Chair · {chairs.length === 1 ? chairs[0] : `${chairs.length} committees`}</span>
        </span>
      ) : featured ? (
        <span className="mt-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Presides over sessions</span>
      ) : null}
    </button>
  );
}

/** Organization chart of the Sangguniang Bayan: presiding officer, regular members, and ex-officio members. */
export function CompositionChart({ onSelect, committees = mockCommittees }: { onSelect?: (memberId: string) => void; committees?: Committee[] }) {
  const presiding = mockMembers.filter((member) => member.seat === 'Presiding Officer');
  const regular = mockMembers.filter((member) => member.seat === 'At-large');
  const exOfficio = mockMembers.filter((member) => member.seat === 'Ex-officio');
  const chairsOf = (memberId: string) =>
    committeeRolesOf(memberId, committees)
      .filter((entry) => entry.role === 'Chair')
      .map((entry) => shortCommitteeName(entry.committee.name));
  const open = (memberId: string) => (onSelect ? () => onSelect(memberId) : undefined);

  return (
    <div className="bg-[radial-gradient(circle_at_1px_1px,#e5e7eb_1px,transparent_0)] [background-size:18px_18px] px-5 py-6">
      <div className="mx-auto w-full max-w-[220px]">
        {presiding.map((member) => (
          <MemberNode key={member.id} member={member} chairs={chairsOf(member.id)} onOpen={open(member.id)} featured />
        ))}
      </div>
      {/* Connectors from the presiding officer to both member groups */}
      <div className="relative mx-auto hidden h-8 w-[60%] lg:block" aria-hidden>
        <span className="absolute left-1/2 top-0 h-4 w-px bg-[#c9ced8]" />
        <span className="absolute left-[33%] right-[8%] top-4 h-px bg-[#c9ced8]" />
        <span className="absolute left-[33%] top-4 h-4 w-px bg-[#c9ced8]" />
        <span className="absolute right-[8%] top-4 h-4 w-px bg-[#c9ced8]" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 lg:mt-0 lg:grid-cols-[2.2fr_1fr]">
        <div className="rounded-xl border border-dashed border-[#c9ced8] bg-white/70 p-3">
          <div className="mb-3 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Regular members
            <span>{regular.length} councilors · elected at large</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {regular.map((member) => (
              <MemberNode key={member.id} member={member} chairs={chairsOf(member.id)} onOpen={open(member.id)} />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-[#c9ced8] bg-white/70 p-3">
          <div className="mb-3 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Ex-officio members
            <span>{exOfficio.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-2">
            {exOfficio.map((member) => (
              <MemberNode key={member.id} member={member} chairs={chairsOf(member.id)} onOpen={open(member.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
