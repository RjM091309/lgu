import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { LGU_PROFILE, mockBills, mockCommittees, mockMembers, type Member } from '@/lib/mock-data';
import { ExternalLink, FileText } from 'lucide-react';

export function MasterListingsView() {
  const [committees, setCommittees] = useState(mockCommittees);
  const [newCommittee, setNewCommittee] = useState('');
  const [profileMember, setProfileMember] = useState<Member | null>(null);

  const masterTags = useMemo(
    () =>
      mockMembers.map((member) => ({
        memberId: member.id,
        tag: `SB-${member.abbr}-${member.id.slice(1).padStart(2, '0')}`,
      })),
    []
  );

  const addCommittee = async () => {
    const name = newCommittee.trim();
    if (!name) {
      toast('Committee not added', 'Please enter a committee name.', 'error');
      return;
    }
    if (committees.some((committee) => committee.name.toLowerCase() === name.toLowerCase())) {
      toast('Committee not added', `${name} is already in the master listing.`, 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Add this committee?',
      description: `${name} will be added to the committee master listing.`,
      confirmLabel: 'Add committee',
    });
    if (!confirmed) return;
    setCommittees((prev) => [
      ...prev,
      {
        id: `c${Math.max(0, ...prev.map((entry) => Number(entry.id.replace(/\D/g, '')) || 0)) + 1}`,
        name,
        lead: 'Chairperson',
      },
    ]);
    setNewCommittee('');
    toast('Committee added', `${name} was added to the master listing.`);
  };

  const specialFiles = [
    'Executive Legislative Agenda file per session cycle',
    'Programs and projects file of the Sangguniang Bayan',
    'Subject matter listing and codification references',
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Special Files and Master Listings</h1>
        <p className="text-sm text-text-muted">Maintain master committee/member listings and core legislative reference files.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border border-border bg-white shadow-sm">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-base">Special Legislative Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            {specialFiles.map((file) => (
              <div key={file} className="flex items-start gap-2.5 rounded-md border border-border px-3 py-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-snug">{file}</p>
                  <p className="text-[11px] text-text-muted">Ready for indexing and periodic update.</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border bg-white shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 px-4 py-3">
            <CardTitle className="text-base">
              Committee Master Listing <span className="text-xs font-normal text-text-muted">({committees.length})</span>
            </CardTitle>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addCommittee();
              }}
            >
              <input
                value={newCommittee}
                onChange={(e) => setNewCommittee(e.target.value)}
                placeholder="New committee name"
                aria-label="New committee name"
                className="h-8 w-56 rounded-md border border-border px-3 text-sm"
              />
              <Button type="submit" size="sm" className="h-8">Add</Button>
            </form>
          </CardHeader>
          <CardContent className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
            {committees.map((committee) => (
              <div key={committee.id} className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2">
                <Badge variant="outline" className="w-9 shrink-0 justify-center px-0 text-[10px]">{committee.id.toUpperCase()}</Badge>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold" title={committee.name}>{committee.name}</p>
                  <p className="text-[11px] text-text-muted">Lead: {committee.lead}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-white shadow-sm">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-base">
            Member Master Listing <span className="text-xs font-normal text-text-muted">({mockMembers.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mockMembers.map((member) => (
            <div key={member.id} className="flex items-center gap-3 rounded-md border border-border border-l-[3px] border-l-primary px-3 py-2.5">
              <Avatar className="h-10 w-10 shrink-0 border border-border">
                {member.avatar && <AvatarImage src={member.avatar} alt={member.name} />}
                <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-bold">{member.abbr}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold" title={member.name}>{member.name}</p>
                <p className="truncate text-[11px] text-text-muted" title={`${member.role} · ${member.seat}`}>
                  {member.role} · {member.seat}
                </p>
                <p className="font-mono text-[10px] text-text-muted">
                  {member.id.toUpperCase()} · {masterTags.find((entry) => entry.memberId === member.id)?.tag}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProfileMember(member)}
                className="h-8 w-8 shrink-0 p-0 text-primary hover:bg-primary/10"
                aria-label={`Open master profile of ${member.name}`}
                title="Open master profile"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={profileMember !== null} onOpenChange={(open) => !open && setProfileMember(null)}>
        <DialogContent>
          {profileMember ? (
            <>
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{profileMember.abbr}</span>
                <div>
                  <DialogTitle className="text-xl text-primary">{profileMember.name}</DialogTitle>
                  <DialogDescription>{profileMember.position}</DialogDescription>
                </div>
              </div>
              <DialogHeader className="sr-only">
                <DialogTitle>Master profile</DialogTitle>
              </DialogHeader>
              <dl className="mt-5 divide-y divide-border rounded-lg border border-border text-sm">
                {[
                  ['Role', profileMember.role],
                  ['Seat', profileMember.seat],
                  ['Master list tag', profileMember.id.toUpperCase()],
                  ['Codification ref.', masterTags.find((entry) => entry.memberId === profileMember.id)?.tag ?? '—'],
                  ['Committee assignments', 'Per SB internal rules'],
                  ['Office', `${LGU_PROFILE.legislature}, ${LGU_PROFILE.address}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
                    <dt className="text-text-muted">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => toast('Profile sent to printer queue', `${profileMember.name} master profile.`, 'info')}
                >
                  Print profile
                </Button>
                <Button onClick={() => setProfileMember(null)}>Done</Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
