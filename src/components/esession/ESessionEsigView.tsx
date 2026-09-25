import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { mockBills, mockMembers, mockSessionDevices, mockSessions } from '@/lib/mock-data';
import { useSessionFiles } from '@/lib/session-files';
import { SessionFilesPanel } from '@/components/esession/SessionFilesPanel';
import { gridTableClassName, gridTableHeaderClassName, gridTableRowClassName } from '@/components/ui/table';
import { logActivity } from '@/lib/activity-log';

function deviceStatusClassName(status: string) {
  return cn(
    'inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold',
    status === 'Connected'
      ? 'border-green-200 bg-green-50 text-green-800'
      : status === 'Disconnected'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-amber-200 bg-amber-50 text-amber-800'
  );
}

interface ESessionEsigViewProps {
  activeTab: string;
}

export function ESessionEsigView({ activeTab }: ESessionEsigViewProps) {
  const [signedMembers, setSignedMembers] = useState<string[]>([]);

  const sessionDevices = mockSessionDevices;

  const signerRows = useMemo(
    () =>
      mockMembers.map((member, index) => ({
        id: `sg-${member.id}`,
        member: member.name,
        present: index !== 5,
        role: member.seat === 'Presiding Officer' ? 'Presiding Officer' : member.role,
      })),
    []
  );

  const sessionFiles = useSessionFiles();

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
            <div className="mt-2 text-3xl font-bold text-primary">{sessionFiles.length}</div>
          </CardContent>
        </Card>
      </div>

      {(activeTab === 'esig-platform' || activeTab === 'req-e-session-signature') && (
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">E-Session Platform</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={gridTableClassName}>
              <div className={gridTableHeaderClassName}>
                <div className="col-span-4">Device</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-4">Last Sync</div>
              </div>
              {sessionDevices.map((row) => (
                <div key={row.name} className={gridTableRowClassName}>
                  <div className="col-span-4">{row.name}</div>
                  <div className="col-span-2">{row.type}</div>
                  <div className="col-span-2">
                    <span className={deviceStatusClassName(row.status)}>{row.status}</span>
                  </div>
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
            <CardTitle className="text-lg">Electronic Signature</CardTitle>
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
                    onClick={async () => {
                      if (signed) {
                        toast('Not signed', `${row.member} has already signed.`, 'error');
                        return;
                      }
                      const confirmed = await confirmAction({
                        title: 'Sign this document?',
                        description: `An electronic signature will be recorded for ${row.member}. A signature cannot be withdrawn once applied.`,
                        confirmLabel: 'Sign document',
                      });
                      if (!confirmed) return;
                      setSignedMembers((prev) => [...prev, row.id]);
                      toast('Document signed', `Signature recorded for ${row.member}.`);
                      logActivity({ module: 'E-Session', action: 'Signed', summary: `Recorded the electronic signature of ${row.member}`, detail: row.role });
                    }}
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
        <div className="space-y-4">
          <SessionFilesPanel />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
              <div className="text-xs uppercase text-text-muted">Agenda Sessions</div>
              <div className="text-xl font-bold text-primary">{mockSessions.length}</div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
              <div className="text-xs uppercase text-text-muted">Approved Docs Ready for eSig</div>
              <div className="text-xl font-bold text-primary">
                {mockBills.filter((bill) => ['Passed', 'Enacted'].includes(bill.status)).length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
