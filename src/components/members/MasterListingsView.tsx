import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { mockMembers } from '@/lib/mock-data';
import { ExternalLink, FileText } from 'lucide-react';

export function MasterListingsView() {
  const [committees, setCommittees] = useState([
    { id: 'c1', name: 'Finance', lead: 'Hon. Maria Santos' },
    { id: 'c2', name: 'Education', lead: 'Sen. Robert Chen' },
    { id: 'c3', name: 'Infrastructure', lead: 'Hon. James Wilson' },
  ]);
  const [newCommittee, setNewCommittee] = useState('');

  const masterTags = useMemo(
    () =>
      mockMembers.map((member) => ({
        memberId: member.id,
        tag: `${member.district}-${member.party.split(' ')[0]}`,
      })),
    []
  );

  const addCommittee = () => {
    if (!newCommittee.trim()) return;
    setCommittees((prev) => [
      ...prev,
      {
        id: `c${prev.length + 1}`,
        name: newCommittee.trim(),
        lead: 'TBD',
      },
    ]);
    setNewCommittee('');
  };

  const specialFiles = [
    'Executive Legislative Agenda file per session cycle',
    'Programs and projects file of the Sangguniang Bayan',
    'Subject matter listing and codification references',
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Special Files and Master Listings</h1>
        <p className="text-sm text-text-muted">Maintain master committee/member listings and core legislative reference files.</p>
      </div>

      <Card className="border border-border bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Special Legislative Files</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {specialFiles.map((file) => (
            <div key={file} className="border border-border p-4">
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{file}</p>
                  <p className="text-xs text-text-muted mt-1">Ready for indexing and periodic update.</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border border-border bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg">Committee Master Listing (Mock Flow)</CardTitle>
          <div className="flex items-center gap-2">
            <input
              value={newCommittee}
              onChange={(e) => setNewCommittee(e.target.value)}
              placeholder="New committee name"
              className="h-9 border border-border px-3 text-sm"
            />
            <Button size="sm" onClick={addCommittee}>Add</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {committees.map((committee) => (
            <div key={committee.id} className="border border-border p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{committee.name}</p>
                <p className="text-xs text-text-muted">Lead: {committee.lead}</p>
              </div>
              <Badge variant="outline">{committee.id.toUpperCase()}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockMembers.map((member) => (
          <Card key={member.id} className="overflow-hidden border border-border bg-white shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="h-1.5 bg-primary" />
            <CardHeader className="flex flex-row items-center gap-4 pb-4">
              <Avatar className="h-14 w-14 border border-border shadow-sm">
                <AvatarImage src={member.avatar} alt={member.name} />
                <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              <div className="space-y-0.5">
                <CardTitle className="text-base group-hover:text-primary transition-colors">{member.name}</CardTitle>
                <p className="text-[12px] font-medium text-text-muted">{member.role}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[10px] font-semibold">
                  {member.party}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-semibold border-border text-text-muted">
                  {member.district}
                </Badge>
              </div>
              
              <div className="space-y-1 pt-3 border-t border-border text-[13px] text-text-muted">
                <p>Committee Assignment: Committee on {member.role}</p>
                <p>Master List Tag: {member.id.toUpperCase()}</p>
                <p>
                  Codification Ref:{' '}
                  {
                    masterTags.find((entry) => entry.memberId === member.id)?.tag
                  }
                </p>
              </div>

              <Button variant="outline" className="w-full mt-2 border-primary text-primary hover:bg-primary hover:text-white transition-all text-[12px] font-bold">
                Open Master Profile
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
