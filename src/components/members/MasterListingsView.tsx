import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Download, FileText, FolderOpen, Gavel, Plus, Printer, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { LGU_PROFILE, mockBills, mockCommitteeAssignments, mockCommitteeHearings, mockCommittees, mockMembers, mockSpecialFiles, type Member } from '@/lib/mock-data';
import { logActivity } from '@/lib/activity-log';
import { openPrintWindow, saveCsv } from '@/lib/files';
import { cn } from '@/lib/utils';
import { CompositionChart, committeeRolesOf, shortCommitteeName } from '@/components/members/CompositionChart';

type Assignment = { chair: string; viceChair: string; members: string[] };

const memberById = (id: string) => mockMembers.find((member) => member.id === id);
const masterTag = (member: Member) => `SB-${member.abbr}-${member.id.slice(1).padStart(2, '0')}`;
const formatDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

const FOLDER_TONE = ['bg-[#1a237e]', 'bg-[#2a78d6]', 'bg-[#d4a72c]'];

export function MasterListingsView() {
  const [committees, setCommittees] = useState(mockCommittees);
  const [assignments] = useState<Record<string, Assignment>>(mockCommitteeAssignments);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newCommittee, setNewCommittee] = useState('');
  const [formError, setFormError] = useState('');


  const rolesOf = (memberId: string) => committeeRolesOf(memberId, committees);

  const roster = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return committees
      .map((committee) => ({
        committee,
        assignment: assignments[committee.id] as Assignment | undefined,
        measures: mockBills.filter((bill) => (bill.committee ?? bill.author) === committee.name).length,
        hearings: mockCommitteeHearings.find((row) => row.committee === shortCommitteeName(committee.name))?.monthly.reduce((sum, value) => sum + value, 0) ?? 0,
      }))
      .filter(({ committee }) => query === '' || committee.name.toLowerCase().includes(query));
  }, [committees, assignments, keyword]);

  const profile = profileId ? memberById(profileId) ?? null : null;

  const addCommittee = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = newCommittee.trim();
    if (!raw) {
      setFormError('Please enter a committee name.');
      return;
    }
    const name = raw.startsWith('Committee on ') ? raw : `Committee on ${raw}`;
    if (committees.some((committee) => committee.name.toLowerCase() === name.toLowerCase())) {
      setFormError(`${name} is already in the master listing.`);
      return;
    }
    const confirmed = await confirmAction({
      title: 'Add this committee?',
      description: `${name} will be added to the committee master listing. Assign its chair and members through an SB resolution.`,
      confirmLabel: 'Add committee',
    });
    if (!confirmed) return;
    setCommittees((prev) => [...prev, { id: `c${Math.max(0, ...prev.map((entry) => Number(entry.id.replace(/\D/g, '')) || 0)) + 1}`, name, lead: 'Chairperson' }]);
    setAddOpen(false);
    toast('Committee added', `${name} was added to the master listing.`);
    logActivity({ module: 'Master Listings', action: 'Created', summary: `Added the ${name}`, detail: 'Added to the master listing of committees.' });
  };

  const exportMasterList = () => {
    const rows = [
      ...mockMembers.map((member) => [
        'Member',
        member.name,
        member.seat,
        masterTag(member),
        rolesOf(member.id)
          .map((entry) => `${entry.role}: ${shortCommitteeName(entry.committee.name)}`)
          .join('; '),
      ]),
      ...committees.map((committee) => {
        const assignment = assignments[committee.id];
        return [
          'Committee',
          committee.name,
          assignment ? `Chair: ${memberById(assignment.chair)?.name ?? ''}` : 'Unassigned',
          committee.id.toUpperCase(),
          assignment ? [assignment.viceChair, ...assignment.members].map((id) => memberById(id)?.name ?? '').join('; ') : '',
        ];
      }),
    ];
    if (!saveCsv('sb-capas-master-listing.csv', ['Type', 'Name', 'Seat / Chair', 'Reference', 'Assignments'], rows)) {
      toast('Export failed', 'The CSV file could not be created. Please try again.', 'error');
      return;
    }
    toast('Master listing exported', `${mockMembers.length} members and ${committees.length} committees saved as CSV.`);
    logActivity({ module: 'Master Listings', action: 'Exported', summary: 'Exported the master listing', detail: `${mockMembers.length} members, ${committees.length} committees.` });
  };

  const printProfile = (member: Member) => {
    const assigned = rolesOf(member.id);
    const ok = openPrintWindow(
      `${member.name} — Master Profile`,
      `<div class="title">${member.name}</div>
       <div class="rows">
         <div><b>Position</b>: ${member.position}</div>
         <div><b>Seat</b>: ${member.seat}</div>
         <div><b>Master list tag</b>: ${masterTag(member)}</div>
         <div><b>Office</b>: ${LGU_PROFILE.legislature}, ${LGU_PROFILE.address}</div>
       </div>
       <table><thead><tr><th>Committee</th><th>Role</th></tr></thead><tbody>${
         assigned.map((entry) => `<tr><td>${entry.committee.name}</td><td>${entry.role}</td></tr>`).join('') || '<tr><td colspan="2">No committee assignments</td></tr>'
       }</tbody></table>`
    );
    if (!ok) toast('Profile not opened', 'Your browser blocked the print window. Allow pop-ups for this site and try again.', 'error');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Files &amp; Master Listings</h1>
          <p className="text-sm text-text-muted">The composition of the Sangguniang Bayan, its committees, and the special legislative files.</p>
        </div>
        <Button variant="outline" onClick={exportMasterList}>
          <Download className="mr-2 h-4 w-4" />
          Export master list
        </Button>
      </div>

      {/* Composition chart */}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <header className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-main">Composition of the Sangguniang Bayan</h2>
            <p className="text-xs text-text-muted">{mockMembers.length} members · select a member to see their committee assignments</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf6e3] px-2 py-0.5 font-semibold text-[#8a6a12]">
              <Gavel className="h-3 w-3" /> Chair
            </span>
            chairs at least one committee
          </span>
        </header>

        <CompositionChart committees={committees} onSelect={setProfileId} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Committee roster */}
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm xl:col-span-2">
          <header className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-text-main">
                Committee Roster <span className="text-xs font-normal text-text-muted">({committees.length})</span>
              </h2>
              <p className="text-xs text-text-muted">Standing committees, their officers, and their workload in 2026</p>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Find a committee" className="w-52 pl-9" />
              </div>
              <Button
                onClick={() => {
                  setNewCommittee('');
                  setFormError('');
                  setAddOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add
              </Button>
            </div>
          </header>
          <ul className="divide-y divide-border">
            {roster.map(({ committee, assignment, measures, hearings }) => {
              const chair = assignment ? memberById(assignment.chair) : undefined;
              const vice = assignment ? memberById(assignment.viceChair) : undefined;
              const others = assignment ? assignment.members.map(memberById).filter((member): member is Member => Boolean(member)) : [];
              return (
                <li key={committee.id} className="grid grid-cols-1 items-center gap-3 px-5 py-3.5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_auto]">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">{committee.id.toUpperCase()}</span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-text-main" title={committee.name}>
                        {shortCommitteeName(committee.name)}
                      </div>
                      <div className="text-[11px] text-text-muted">
                        {measures} measure{measures === 1 ? '' : 's'} referred · {hearings} hearing{hearings === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                  {assignment && chair && vice ? (
                    <div className="flex min-w-0 items-center gap-3">
                      <button type="button" onClick={() => setProfileId(chair.id)} className="flex min-w-0 items-center gap-2 text-left" title={`Chair: ${chair.name}`}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a237e] text-[10px] font-bold text-white ring-2 ring-[#d4a72c]">{chair.abbr}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-medium text-text-main">{chair.name}</span>
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#8a6a12]">Chair</span>
                        </span>
                      </button>
                      <span className="flex flex-wrap gap-1">
                        {[vice, ...others].map((member, i) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => setProfileId(member.id)}
                            className={cn('inline-flex h-6 min-w-8 items-center justify-center rounded-full px-1.5 text-[10px] font-bold transition-colors hover:bg-primary hover:text-white', i === 0 ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-muted text-text-muted')}
                            title={`${i === 0 ? 'Vice Chair' : 'Member'}: ${member.name}`}
                          >
                            {member.abbr}
                          </button>
                        ))}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs italic text-text-muted">Officers not yet assigned</span>
                  )}
                  <span className="justify-self-start rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-text-muted md:justify-self-end">
                    <Users className="mr-1 inline h-3 w-3" />
                    {assignment ? 2 + assignment.members.length : 0}
                  </span>
                </li>
              );
            })}
            {roster.length === 0 ? <li className="px-5 py-8 text-center text-sm text-text-muted">No committee matches “{keyword}”.</li> : null}
          </ul>
        </section>

        {/* Special files */}
        <section className="self-start rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-text-main">Special Legislative Files</h2>
          <p className="text-xs text-text-muted">Reference files kept by the Secretariat</p>
          <ul className="mt-5 space-y-5">
            {mockSpecialFiles.map((file, i) => (
              <li key={file.id} className="relative">
                {/* Folder tab */}
                <span className={cn('absolute -top-2.5 left-4 h-3 w-16 rounded-t-md', FOLDER_TONE[i % FOLDER_TONE.length])} aria-hidden />
                <div className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-white to-[#f7f8fb] p-4">
                  <span className={cn('absolute inset-x-0 top-0 h-1', FOLDER_TONE[i % FOLDER_TONE.length])} aria-hidden />
                  <div className="flex items-start gap-3">
                    <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-text-main">{file.title}</div>
                      <div className="text-[11px] text-text-muted">{file.detail}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <span className="text-2xl font-semibold tabular-nums text-text-main">{file.count}</span>
                      <span className="ml-1 text-[11px] text-text-muted">{file.unit}</span>
                    </div>
                    <div className="text-right text-[10px] leading-tight text-text-muted">
                      <div>Updated {formatDate(file.updated)}</div>
                      <div className="font-medium text-text-main">{file.custodian}</div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Member profile */}
      <Sheet open={profile !== null} onOpenChange={(open) => !open && setProfileId(null)}>
        <SheetContent side="right" className="w-full p-0 sm:w-[420px]">
          {profile ? (
            <div className="flex h-full flex-col bg-white">
              <div className="bg-gradient-to-br from-[#1a237e] to-[#0d1452] px-6 pb-6 pt-8 text-center text-white">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-base font-bold text-primary ring-4 ring-[#d4a72c]/60">{profile.abbr}</span>
                <h2 className="mt-3 text-lg font-semibold">{profile.name}</h2>
                <p className="text-xs text-white/70">{profile.position}</p>
                <span className="mt-3 inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold">{profile.seat}</span>
              </div>
              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Master list tag</dt>
                    <dd className="mt-0.5 font-mono text-text-main">{masterTag(profile)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Role</dt>
                    <dd className="mt-0.5 text-text-main">{profile.role}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Office</dt>
                    <dd className="mt-0.5 text-text-main">{LGU_PROFILE.address}</dd>
                  </div>
                </dl>
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Committee assignments</h3>
                  {rolesOf(profile.id).length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {rolesOf(profile.id)
                        .sort((a, b) => ['Chair', 'Vice Chair', 'Member'].indexOf(a.role) - ['Chair', 'Vice Chair', 'Member'].indexOf(b.role))
                        .map((entry) => (
                          <li key={entry.committee.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                            <span className="min-w-0 truncate text-[13px] text-text-main">{shortCommitteeName(entry.committee.name)}</span>
                            <span
                              className={cn(
                                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                entry.role === 'Chair' ? 'bg-[#fdf6e3] text-[#8a6a12]' : entry.role === 'Vice Chair' ? 'bg-primary/10 text-primary' : 'bg-muted text-text-muted'
                              )}
                            >
                              {entry.role}
                            </span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-text-muted">
                      {profile.seat === 'Presiding Officer' ? 'The presiding officer does not sit in standing committees.' : 'No committee assignments.'}
                    </p>
                  )}
                </div>
              </div>
              <div className="border-t border-border px-6 py-4">
                <Button variant="outline" className="w-full" onClick={() => printProfile(profile)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print master profile
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">Add Committee</DialogTitle>
            <DialogDescription>Adds a standing committee to the master listing.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addCommittee} className="mt-5 space-y-3">
            <div className="flex items-center rounded-md border border-border focus-within:border-primary/40">
              <span className="whitespace-nowrap pl-3 text-sm text-text-muted">Committee on</span>
              <input
                value={newCommittee.replace(/^Committee on /, '')}
                onChange={(e) => setNewCommittee(e.target.value)}
                placeholder="Youth and Sports Development"
                aria-label="Committee name"
                className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                autoFocus
              />
            </div>
            {formError ? <p className="text-xs text-red-700">{formError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <FileText className="mr-1.5 h-4 w-4" />
                Add committee
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
