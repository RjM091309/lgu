import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AccessViewProps {
  activeTab: string;
}

const mockUsers = [
  { id: 'USR-001', name: 'Maria Santos', email: 'maria.santos@lgu.gov.ph', role: 'Administrator', status: 'Active' },
  { id: 'USR-002', name: 'Robert Chen', email: 'robert.chen@lgu.gov.ph', role: 'Records Officer', status: 'Active' },
  { id: 'USR-003', name: 'Elena Rodriguez', email: 'elena.rodriguez@lgu.gov.ph', role: 'Committee Staff', status: 'Inactive' },
];

const mockRoles = [
  { name: 'Administrator', members: 2, scope: 'Full module access', updated: '2026-04-10' },
  { name: 'Records Officer', members: 6, scope: 'Encode and route legislative records', updated: '2026-04-11' },
  { name: 'Committee Staff', members: 9, scope: 'Review, hearing logs, and reports', updated: '2026-04-09' },
];

const mockControlPanels = [
  { module: 'Authentication', owner: 'System Admin', mode: 'Strict', health: 'Healthy' },
  { module: 'Permissions Matrix', owner: 'IT Governance', mode: 'Review Needed', health: 'Warning' },
  { module: 'Audit Trail', owner: 'Compliance Unit', mode: 'Enabled', health: 'Healthy' },
];

const mockAuditTrail = [
  { timestamp: '2026-04-23 09:14', user: 'admin', activity: 'Approved ordinance workflow item', source: 'Web Portal' },
  { timestamp: '2026-04-23 09:22', user: 'secretariat.clerk', activity: 'Uploaded minutes attachment', source: 'Session Module' },
  { timestamp: '2026-04-23 09:37', user: 'committee.head', activity: 'Returned document as incomplete', source: 'Approval Queue' },
];

export function AccessView({ activeTab }: AccessViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(mockUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return mockUsers.slice(start, start + pageSize);
  }, [currentPage]);

  const pageTitle =
    activeTab === 'access-roles'
      ? 'Access Management: Roles'
      : activeTab === 'access-control-panel'
        ? 'Access Management: Control Panel'
        : 'Access Management: Users';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">{pageTitle}</h1>
          <p className="text-sm text-text-muted">Data for access governance workflows (users, roles, and access control settings).</p>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary-light">
          Add New Entry
        </Button>
      </div>

      {(activeTab === 'access-users' || activeTab === 'access') && (
        <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-primary">Users</h2>
          </div>
          <DataTable
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={mockUsers.length}
            currentCount={paginatedUsers.length}
            onPreviousPage={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            onNextPage={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          >
            <Table>
              <TableHeader className="bg-[#fafafa]">
                <TableRow className="border-border">
                  <TableHead className="px-6 text-[12px] font-semibold text-text-muted">USER ID</TableHead>
                  <TableHead className="px-6 text-[12px] font-semibold text-text-muted">NAME</TableHead>
                  <TableHead className="px-6 text-[12px] font-semibold text-text-muted">EMAIL</TableHead>
                  <TableHead className="px-6 text-[12px] font-semibold text-text-muted">ROLE</TableHead>
                  <TableHead className="px-6 text-[12px] font-semibold text-text-muted">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/5 border-border transition-colors">
                    <TableCell className="px-6 py-3.5 text-[13px] font-mono text-text-muted">{user.id}</TableCell>
                    <TableCell className="px-6 py-3.5 text-[13px] font-medium">{user.name}</TableCell>
                    <TableCell className="px-6 py-3.5 text-[13px]">{user.email}</TableCell>
                    <TableCell className="px-6 py-3.5 text-[13px]">{user.role}</TableCell>
                    <TableCell className="px-6 py-3.5 text-[13px]">
                      <Badge variant="outline" className={user.status === 'Active' ? 'text-[#2e7d32] border-[#c8e6c9] bg-[#e8f5e9]' : 'text-[#c62828] border-[#ffcdd2] bg-[#ffebee]'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        </div>
      )}

      {activeTab === 'access-roles' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockRoles.map((role) => (
            <div key={role.name} className="bg-white rounded-lg border border-border shadow-sm p-5 space-y-2">
              <h3 className="text-base font-semibold text-primary">{role.name}</h3>
              <p className="text-sm text-text-muted">{role.scope}</p>
              <div className="text-xs text-text-muted">Members: {role.members}</div>
              <div className="text-xs text-text-muted">Last updated: {role.updated}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'access-control-panel' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-primary">Control Panel</h2>
            </div>
            <div className="space-y-0">
              {mockControlPanels.map((item) => (
                <div key={item.module} className="px-6 py-4 border-b border-border last:border-b-0 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{item.module}</p>
                    <p className="text-xs text-text-muted">Owner: {item.owner}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-text-main">
                      {item.mode}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        item.health === 'Healthy'
                          ? 'text-[#2e7d32] border-[#c8e6c9] bg-[#e8f5e9]'
                          : 'text-[#ef6c00] border-[#ffe0b2] bg-[#fff3e0]'
                      }
                    >
                      {item.health}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-border shadow-sm p-5">
            <h3 className="text-sm font-semibold text-primary">Security Policies (UI Layout)</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded border border-border p-3 text-sm">
                <div className="font-medium">Multi-Factor Authentication</div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" defaultChecked /> SMS/Text OTP</label>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" defaultChecked /> Authenticator App</label>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" /> Physical Token</label>
              </div>
              <div className="space-y-2 rounded border border-border p-3 text-sm">
                <div className="font-medium">Captcha and Session Policy</div>
                <div className="rounded border border-dashed border-border p-2 text-xs text-text-muted">Captcha placeholder</div>
                <Input placeholder="Session timeout (minutes)" defaultValue="30" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-primary">Audit Trail (UI Layout)</h3>
            </div>
            <Table>
              <TableHeader className="bg-[#fafafa]">
                <TableRow className="border-border">
                  <TableHead className="px-6 text-[12px] font-semibold text-text-muted">TIMESTAMP</TableHead>
                  <TableHead className="px-6 text-[12px] font-semibold text-text-muted">USER</TableHead>
                  <TableHead className="px-6 text-[12px] font-semibold text-text-muted">ACTIVITY</TableHead>
                  <TableHead className="px-6 text-[12px] font-semibold text-text-muted">SOURCE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockAuditTrail.map((row) => (
                  <TableRow key={`${row.timestamp}-${row.user}`} className="border-border">
                    <TableCell className="px-6 py-3.5 text-xs">{row.timestamp}</TableCell>
                    <TableCell className="px-6 py-3.5 text-xs">{row.user}</TableCell>
                    <TableCell className="px-6 py-3.5 text-xs">{row.activity}</TableCell>
                    <TableCell className="px-6 py-3.5 text-xs">{row.source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
