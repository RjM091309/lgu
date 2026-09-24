import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { saveCsv } from '@/lib/files';
import { NAV_GROUPS } from '@/lib/navigation';
import { Download, MoreHorizontal, Plus, Save, Trash2 } from 'lucide-react';

interface AccessViewProps {
  activeTab: string;
}

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Inactive';
}

interface Role {
  name: string;
  members: number;
  scope: string;
  updated: string;
  modules: string[];
}

const INITIAL_USERS: UserAccount[] = [
  { id: 'USR-001', name: 'SB Secretariat Admin', email: 'sb.admin@capas.gov.ph', role: 'Administrator', status: 'Active' },
  { id: 'USR-002', name: 'SB Records Officer', email: 'sb.records@capas.gov.ph', role: 'Records Officer', status: 'Active' },
  { id: 'USR-003', name: 'SB Committee Staff', email: 'sb.committee@capas.gov.ph', role: 'Committee Staff', status: 'Inactive' },
];

const MODULE_GROUPS = NAV_GROUPS.filter((group) => group.id !== 'overview' && group.id !== 'reference').map((group) => group.label);

const INITIAL_ROLES: Role[] = [
  { name: 'Administrator', members: 2, scope: 'Full module access', updated: '2026-04-10', modules: MODULE_GROUPS },
  { name: 'Records Officer', members: 6, scope: 'Encode and route legislative records', updated: '2026-04-11', modules: ['Legislative', 'E-Session', 'Reports'] },
  { name: 'Committee Staff', members: 9, scope: 'Review, hearing logs, and reports', updated: '2026-04-09', modules: ['Legislative', 'Reports'] },
];

const CONTROL_PANELS = [
  { module: 'Authentication', owner: 'System Admin', mode: 'Strict', health: 'Healthy' },
  { module: 'Permissions Matrix', owner: 'IT Governance', mode: 'Review Needed', health: 'Warning' },
  { module: 'Audit Trail', owner: 'Compliance Unit', mode: 'Enabled', health: 'Healthy' },
];

const AUDIT_TRAIL = [
  { timestamp: '2026-09-22 09:14', user: 'sb.admin', activity: 'Approved ordinance workflow item', source: 'Web Portal' },
  { timestamp: '2026-09-22 09:22', user: 'sb.records', activity: 'Uploaded minutes attachment', source: 'Session Module' },
  { timestamp: '2026-09-22 09:37', user: 'sb.committee', activity: 'Returned document as incomplete', source: 'Approval Queue' },
];

const today = () => new Date().toISOString().slice(0, 10);

// The signed-in account; it can't delete itself.
const CURRENT_USER_ID = 'USR-001';

export function AccessView({ activeTab }: AccessViewProps) {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [roles, setRoles] = useState(INITIAL_ROLES);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const paginatedUsers = useMemo(() => users.slice((currentPage - 1) * pageSize, currentPage * pageSize), [users, currentPage]);

  const [addOpen, setAddOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState(INITIAL_ROLES[1].name);
  const [formScope, setFormScope] = useState('');
  const [formError, setFormError] = useState('');

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleModules, setRoleModules] = useState<string[]>([]);

  const [mfa, setMfa] = useState({ sms: true, app: true, token: false });
  const [sessionTimeout, setSessionTimeout] = useState('30');

  const isRoles = activeTab === 'access-roles';
  const isControlPanel = activeTab === 'access-control-panel';
  const pageTitle = isRoles ? 'Roles & Permissions' : isControlPanel ? 'Control Panel' : 'User Accounts';
  const pageDescription = isRoles
    ? 'Define what each role can access across the system.'
    : isControlPanel
      ? 'Security policies, system health, and the audit trail.'
      : 'Create and manage staff accounts of the Sangguniang Bayan.';

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormScope('');
    setFormError('');
  };

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isRoles) {
      if (!formName.trim()) {
        setFormError('Please enter a role name.');
        toast('Role not created', 'Please enter a role name.', 'error');
        return;
      }
      if (roles.some((role) => role.name.toLowerCase() === formName.trim().toLowerCase())) {
        setFormError('A role with this name already exists.');
        toast('Role not created', `A role named ${formName.trim()} already exists.`, 'error');
        return;
      }
      const confirmed = await confirmAction({
        title: 'Create this role?',
        description: `${formName.trim()} will be added with no module access until you set its permissions.`,
        confirmLabel: 'Create role',
      });
      if (!confirmed) return;
      setRoles((prev) => [...prev, { name: formName.trim(), members: 0, scope: formScope.trim() || 'Custom access', updated: today(), modules: [] }]);
      toast('Role created', `${formName.trim()} was added. Set its permissions next.`);
    } else {
      if (!formName.trim() || !formEmail.trim()) {
        setFormError('Please enter the name and email address.');
        toast('Account not created', 'Please enter the name and email address.', 'error');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
        setFormError('Please enter a valid email address.');
        toast('Account not created', `${formEmail.trim()} is not a valid email address.`, 'error');
        return;
      }
      if (users.some((user) => user.email.toLowerCase() === formEmail.trim().toLowerCase())) {
        setFormError('An account with this email already exists.');
        toast('Account not created', `${formEmail.trim()} already has an account.`, 'error');
        return;
      }
      const confirmed = await confirmAction({
        title: 'Create this user account?',
        description: `${formName.trim()} will get the ${formRole} role, and an activation link will be sent to ${formEmail.trim()}.`,
        confirmLabel: 'Create account',
      });
      if (!confirmed) return;
      const id = `USR-${String(Math.max(0, ...users.map((user) => Number(user.id.replace(/\D/g, '')) || 0)) + 1).padStart(3, '0')}`;
      setUsers((prev) => [...prev, { id, name: formName.trim(), email: formEmail.trim(), role: formRole, status: 'Active' }]);
      toast('User account created', `An activation link was sent to ${formEmail.trim()}.`);
    }
    resetForm();
    setAddOpen(false);
  };

  const toggleUserStatus = async (id: string) => {
    const target = users.find((user) => user.id === id);
    if (!target) {
      toast('Account not updated', 'This user account could not be found.', 'error');
      return;
    }
    const deactivating = target.status === 'Active';
    const confirmed = await confirmAction({
      title: deactivating ? 'Deactivate this account?' : 'Activate this account?',
      description: deactivating
        ? `${target.name} will no longer be able to sign in until the account is activated again.`
        : `${target.name} will be able to sign in again.`,
      confirmLabel: deactivating ? 'Deactivate' : 'Activate',
      tone: deactivating ? 'destructive' : 'default',
    });
    if (!confirmed) return;
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, status: deactivating ? 'Inactive' : 'Active' } : user)));
    toast(deactivating ? 'Account deactivated' : 'Account activated', `${target.name} (${target.email}).`);
  };

  const deleteUser = async (user: UserAccount) => {
    if (user.id === CURRENT_USER_ID) {
      toast('Account not deleted', 'You cannot delete the account you are signed in with.', 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Delete this user account?',
      description: `${user.name} (${user.email}) will be removed and can no longer sign in. This cannot be undone.`,
      confirmLabel: 'Delete account',
      tone: 'destructive',
    });
    if (!confirmed) return;
    const remaining = users.filter((entry) => entry.id !== user.id);
    setUsers(remaining);
    setCurrentPage((page) => Math.min(page, Math.max(1, Math.ceil(remaining.length / pageSize))));
    toast('Account deleted', `${user.name} (${user.email}) was removed.`);
  };

  const deleteRole = async (role: Role) => {
    const assignedUsers = users.filter((user) => user.role === role.name).length;
    if (role.name === 'Administrator' || role.members > 0 || assignedUsers > 0) {
      toast(
        'Role not deleted',
        role.name === 'Administrator'
          ? 'The Administrator role is required and cannot be deleted.'
          : `${role.name} is still assigned to ${Math.max(role.members, assignedUsers)} user(s). Move them to another role first.`,
        'error'
      );
      return;
    }
    const confirmed = await confirmAction({
      title: 'Delete this role?',
      description: `${role.name} and its permissions will be removed. This cannot be undone.`,
      confirmLabel: 'Delete role',
      tone: 'destructive',
    });
    if (!confirmed) return;
    setRoles((prev) => prev.filter((entry) => entry.name !== role.name));
    toast('Role deleted', `${role.name} was removed.`);
  };

  const sendPasswordReset = async (user: UserAccount) => {
    const confirmed = await confirmAction({
      title: 'Send a password reset link?',
      description: `A reset link will be sent to ${user.email}. Their current password keeps working until they change it.`,
      confirmLabel: 'Send link',
    });
    if (!confirmed) return;
    toast('Password reset sent', `A reset link was sent to ${user.email}.`);
  };

  const openRoleEditor = (role: Role) => {
    setEditingRole(role);
    setRoleModules(role.modules);
  };

  const saveRole = async () => {
    if (!editingRole) return;
    if (roleModules.length === 0) {
      toast('Permissions not saved', 'Select at least one module group for this role.', 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Save these permissions?',
      description: `Everyone with the ${editingRole.name} role will be able to access ${roleModules.length} module group(s): ${roleModules.join(', ')}.`,
      confirmLabel: 'Save permissions',
    });
    if (!confirmed) return;
    setRoles((prev) => prev.map((role) => (role.name === editingRole.name ? { ...role, modules: roleModules, updated: today() } : role)));
    toast('Permissions saved', `${editingRole.name} can now access ${roleModules.length} module group(s).`);
    setEditingRole(null);
  };

  const saveSecuritySettings = async () => {
    const minutes = Number(sessionTimeout);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 480) {
      toast('Settings not saved', 'Session timeout must be a whole number from 5 to 480 minutes.', 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Save security settings?',
      description: `Users will be signed out after ${minutes} minutes of inactivity.`,
      confirmLabel: 'Save settings',
    });
    if (!confirmed) return;
    toast('Security settings saved', `Session timeout: ${minutes} minutes.`);
  };

  const exportAuditTrail = () => {
    const saved = saveCsv(
      'sb-capas-audit-trail.csv',
      ['Timestamp', 'User', 'Activity', 'Source'],
      AUDIT_TRAIL.map((row) => [row.timestamp, row.user, row.activity, row.source])
    );
    if (!saved) {
      toast('Export failed', 'The CSV file could not be created. Please try again.', 'error');
      return;
    }
    toast('Audit trail exported');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">{pageTitle}</h1>
          <p className="text-sm text-text-muted">{pageDescription}</p>
        </div>
        {isControlPanel ? (
          <Button size="sm" onClick={saveSecuritySettings}>
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setAddOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {isRoles ? 'Add Role' : 'Add User'}
          </Button>
        )}
      </div>

      {!isRoles && !isControlPanel && (
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <DataTable
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={users.length}
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
                  <TableHead className="px-6 text-right text-[12px] font-semibold text-text-muted">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((user) => (
                  <TableRow key={user.id} className="border-border transition-colors hover:bg-muted/5">
                    <TableCell className="px-6 py-3.5 font-mono text-[13px] text-text-muted">{user.id}</TableCell>
                    <TableCell className="px-6 py-3.5 text-[13px] font-medium">{user.name}</TableCell>
                    <TableCell className="px-6 py-3.5 text-[13px]">{user.email}</TableCell>
                    <TableCell className="px-6 py-3.5 text-[13px]">{user.role}</TableCell>
                    <TableCell className="px-6 py-3.5 text-[13px]">
                      <Badge
                        variant="outline"
                        className={user.status === 'Active' ? 'border-[#c8e6c9] bg-[#e8f5e9] text-[#2e7d32]' : 'border-[#ffcdd2] bg-[#ffebee] text-[#c62828]'}
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions for ${user.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => toggleUserStatus(user.id)}>{user.status === 'Active' ? 'Deactivate account' : 'Activate account'}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => sendPasswordReset(user)}>Reset password</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-[#c62828] hover:bg-[#ffebee]" onClick={() => deleteUser(user)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        </div>
      )}

      {isRoles && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role.name} className="flex flex-col rounded-lg border border-border bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-primary">{role.name}</h3>
              <p className="mt-1 text-sm text-text-muted">{role.scope}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {role.modules.length > 0 ? (
                  role.modules.map((module) => (
                    <span key={module} className="rounded border border-border bg-background px-2 py-0.5 text-[11px]">
                      {module}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-text-muted">No modules assigned yet</span>
                )}
              </div>
              <div className="mt-3 flex-1 text-xs text-text-muted">
                Members: {role.members} · Updated {role.updated}
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openRoleEditor(role)}>
                  Edit permissions
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[#c62828] hover:bg-[#ffebee]"
                  onClick={() => deleteRole(role)}
                  aria-label={`Delete ${role.name} role`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isControlPanel && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-primary">System Health</h2>
            </div>
            {CONTROL_PANELS.map((item) => (
              <div key={item.module} className="flex flex-col gap-2 border-b border-border px-6 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold">{item.module}</p>
                  <p className="text-xs text-text-muted">Owner: {item.owner}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-text-main">
                    {item.mode}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={item.health === 'Healthy' ? 'border-[#c8e6c9] bg-[#e8f5e9] text-[#2e7d32]' : 'border-[#ffe0b2] bg-[#fff3e0] text-[#ef6c00]'}
                  >
                    {item.health}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-primary">Security Policies</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded border border-border p-3 text-sm">
                <div className="font-medium">Multi-Factor Authentication</div>
                {(
                  [
                    ['sms', 'SMS/Text OTP'],
                    ['app', 'Authenticator App'],
                    ['token', 'Physical Token'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={mfa[key]} onChange={(e) => setMfa((prev) => ({ ...prev, [key]: e.target.checked }))} className="accent-primary" />
                    {label}
                  </label>
                ))}
              </div>
              <div className="space-y-2 rounded border border-border p-3 text-sm">
                <div className="font-medium">Session Policy</div>
                <label className="block text-xs text-text-muted">
                  Session timeout (minutes)
                  <Input type="number" min={5} value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)} className="mt-1" />
                </label>
                <p className="text-xs text-text-muted">Passwords: at least 12 characters with uppercase, number, and symbol.</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="text-base font-semibold text-primary">Audit Trail</h3>
              <Button variant="outline" size="sm" onClick={exportAuditTrail}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
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
                {AUDIT_TRAIL.map((row) => (
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">{isRoles ? 'Add Role' : 'Add User'}</DialogTitle>
            <DialogDescription>{isRoles ? 'Create a role, then assign the modules it can access.' : 'The user receives an activation link by email.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="mt-5 space-y-3">
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={isRoles ? 'Role name' : 'Full name or office account name'} aria-label="Name" />
            {isRoles ? (
              <Input value={formScope} onChange={(e) => setFormScope(e.target.value)} placeholder="Short description of the role" aria-label="Description" />
            ) : (
              <>
                <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="name@capas.gov.ph" aria-label="Email address" />
                <label className="block text-xs font-semibold text-text-muted">
                  Role
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-normal text-text-main"
                  >
                    {roles.map((role) => (
                      <option key={role.name}>{role.name}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {formError ? <p className="text-xs text-red-700">{formError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{isRoles ? 'Create role' : 'Create account'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editingRole !== null} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent>
          {editingRole ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl text-primary">{editingRole.name} permissions</DialogTitle>
                <DialogDescription>Select the module groups this role can access.</DialogDescription>
              </DialogHeader>
              <div className="mt-5 space-y-2">
                {MODULE_GROUPS.map((module) => (
                  <label key={module} className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={roleModules.includes(module)}
                      onChange={(e) => setRoleModules((prev) => (e.target.checked ? [...prev, module] : prev.filter((entry) => entry !== module)))}
                      className="accent-primary"
                    />
                    {module}
                  </label>
                ))}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingRole(null)}>
                  Cancel
                </Button>
                <Button onClick={saveRole}>Save permissions</Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
