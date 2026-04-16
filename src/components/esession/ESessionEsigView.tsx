import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockBills, mockSessions } from '@/lib/mock-data';

interface ESessionEsigViewProps {
  activeTab: string;
}

export function ESessionEsigView({ activeTab }: ESessionEsigViewProps) {
  const [signedMembers, setSignedMembers] = useState<string[]>([]);

  const sessionDevices = useMemo(
    () => [
      { name: 'Session Hall Tablet A', type: 'Tablet', status: 'Connected', lastSync: '10:12 AM' },
      { name: 'Session Hall Tablet B', type: 'Tablet', status: 'Connected', lastSync: '10:11 AM' },
      { name: 'Presiding Officer iPad', type: 'iPad', status: 'Connected', lastSync: '10:10 AM' },
      { name: 'Secretary Console', type: 'Laptop', status: 'Pending', lastSync: '09:58 AM' },
    ],
    []
  );

  const signerRows = useMemo(
    () => [
      { id: 'sg-1', member: 'Hon. Maria Santos', present: true, role: 'Presiding Officer' },
      { id: 'sg-2', member: 'Sen. Robert Chen', present: true, role: 'Member' },
      { id: 'sg-3', member: 'Hon. James Wilson', present: false, role: 'Member' },
      { id: 'sg-4', member: 'Hon. Elena Rodriguez', present: true, role: 'Member' },
    ],
    []
  );

  const attachmentRows = useMemo(
    () => [
      { file: 'Regular Session Agenda - Week 16.pdf', type: 'Agenda', access: 'View / Download / Print' },
      { file: 'Committee Finance Audio - Week 16.mp3', type: 'Audio', access: 'Play / Download' },
      { file: 'Plenary Recording - Week 16.mp4', type: 'Video', access: 'Play / Download' },
      { file: 'Order of Business - Week 16.pdf', type: 'Order of Business', access: 'View / Print' },
    ],
    []
  );

  const connectedCount = sessionDevices.filter((item) => item.status === 'Connected').length;
  const signedCount = signedMembers.length;
  const totalEligible = signerRows.filter((row) => row.present).length;

  const selectedTitle =
    activeTab === 'esig-electronic-signature'
      ? 'Electronic Signature'
      : activeTab === 'esig-session-files'
        ? 'Session Files and Attachments'
        : 'E-Session Platform';

  const selectedDescription =
    activeTab === 'esig-electronic-signature'
      ? 'Real-time digital signature workflow based on attendance-present members.'
      : activeTab === 'esig-session-files'
        ? 'Session file browsing, download, print, and media attachment access flow.'
        : 'Device connectivity, agenda synchronization, and live session update workflow.';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">{selectedTitle}</h1>
        <p className="text-sm text-text-muted">{selectedDescription}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border shadow-sm">
          <CardContent className="p-5">
            <div className="text-xs uppercase text-text-muted">Connected Devices</div>
            <div className="mt-2 text-3xl font-bold text-primary">{connectedCount}</div>
          </CardContent>
        </Card>
        <Card className="border border-border shadow-sm">
          <CardContent className="p-5">
            <div className="text-xs uppercase text-text-muted">Signed Members</div>
            <div className="mt-2 text-3xl font-bold text-primary">{signedCount}/{totalEligible}</div>
          </CardContent>
        </Card>
        <Card className="border border-border shadow-sm">
          <CardContent className="p-5">
            <div className="text-xs uppercase text-text-muted">Session Files</div>
            <div className="mt-2 text-3xl font-bold text-primary">{attachmentRows.length}</div>
          </CardContent>
        </Card>
      </div>

      {(activeTab === 'esig-platform' || activeTab === 'req-e-session-signature') && (
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">E-Session Platform (Mock Process)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="border border-border">
              <div className="grid grid-cols-12 bg-muted/40 px-4 py-2 text-xs font-bold uppercase">
                <div className="col-span-4">Device</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-4">Last Sync</div>
              </div>
              {sessionDevices.map((row) => (
                <div key={row.name} className="grid grid-cols-12 border-t border-border px-4 py-2 text-sm">
                  <div className="col-span-4">{row.name}</div>
                  <div className="col-span-2">{row.type}</div>
                  <div className="col-span-2">{row.status}</div>
                  <div className="col-span-4">{row.lastSync}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              Flow: connect device → sync agenda/order of business → push live updates to all participants.
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'esig-electronic-signature' && (
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Electronic Signature (Mock Process)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {signerRows.map((row) => {
              const signed = signedMembers.includes(row.id);
              return (
                <div key={row.id} className="flex items-center justify-between border border-border p-3">
                  <div>
                    <div className="text-sm font-semibold">{row.member}</div>
                    <div className="text-xs text-text-muted">
                      {row.role} • {row.present ? 'Present (eligible)' : 'Absent (disabled)'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={signed ? 'default' : 'outline'}
                    disabled={!row.present}
                    onClick={() =>
                      setSignedMembers((prev) =>
                        prev.includes(row.id) ? prev : [...prev, row.id]
                      )
                    }
                  >
                    {signed ? 'Signed' : 'Sign Document'}
                  </Button>
                </div>
              );
            })}
            <p className="text-xs text-text-muted">
              Flow: attendance validation → signature placement → secretary finalization/locking.
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'esig-session-files' && (
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Session Files and Attachments (Mock Process)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="border border-border">
              <div className="grid grid-cols-12 bg-muted/40 px-4 py-2 text-xs font-bold uppercase">
                <div className="col-span-5">File Name</div>
                <div className="col-span-3">Type</div>
                <div className="col-span-4">Access</div>
              </div>
              {attachmentRows.map((row) => (
                <div key={row.file} className="grid grid-cols-12 border-t border-border px-4 py-2 text-sm">
                  <div className="col-span-5">{row.file}</div>
                  <div className="col-span-3">{row.type}</div>
                  <div className="col-span-4">{row.access}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="border border-border p-4">
                <div className="text-xs uppercase text-text-muted">Agenda Sessions</div>
                <div className="mt-2 text-2xl font-bold text-primary">{mockSessions.length}</div>
              </div>
              <div className="border border-border p-4">
                <div className="text-xs uppercase text-text-muted">Approved Docs Ready for eSig</div>
                <div className="mt-2 text-2xl font-bold text-primary">
                  {mockBills.filter((bill) => ['Passed', 'Enacted'].includes(bill.status)).length}
                </div>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              Flow: select session → browse attachments → open/download/print with watermark controls.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
