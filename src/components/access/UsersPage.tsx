import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Mail, MoreHorizontal, Plus, Search, ShieldCheck, ShieldOff, Trash2, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { logActivity, useActivityLog } from '@/lib/activity-log';
import { MODULE_GROUPS, ROLE_TONE, initials, setUsers, useRoles, useUsers, type UserAccount } from '@/lib/access-store';
import { todayInManila } from '@/lib/session-files';
import { cn } from '@/lib/utils';

// The signed-in account; it can't be deleted or deactivated from here.
const CURRENT_USER_ID = 'USR-001';

const lastActiveLabel = (timestamp: string, today: string) => {
  const days = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${timestamp.slice(0, 10)}T00:00:00`).getTime()) / 86_400_000);
  const [hour, minute] = timestamp.slice(11, 16).split(':').map(Number);
  const time = `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
  if (days <= 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  if (days < 30) return `${days} days ago`;
  return new Date(`${timestamp.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

export function UsersPage() {
  const users = useUsers();
  const roles = useRoles();
  const activity = useActivityLog();
  const today = todayInManila();

  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', office: '', role: 'Records Officer' });
  const [formError, setFormError] = useState('');
  const pageSize = 8;

  const roleOptions: SelectOption[] = [
    { value: 'All', label: `All roles (${users.length})` },
    ...roles.map((role) => ({ value: role.name, label: `${role.name} (${users.filter((user) => user.role === role.name).length})` })),
  ];

  const roleTone = (roleName: string) => ROLE_TONE[roles.find((role) => role.name === roleName)?.tone ?? 'slate'];

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return users.filter(
      (user) =>
        (roleFilter === 'All' || user.role === roleFilter) &&
        (statusFilter === 'All' || user.status === statusFilter) &&
        (query === '' || `${user.name} ${user.username} ${user.email} ${user.office}`.toLowerCase().includes(query))
    );
  }, [users, keyword, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const profile = users.find((user) => user.id === profileId) ?? null;

  const summary = [
    { label: 'Accounts', value: users.length },
    { label: 'Active', value: users.filter((user) => user.status === 'Active').length },
    { label: 'Inactive', value: users.filter((user) => user.status === 'Inactive').length },
    { label: 'Using MFA', value: `${users.filter((user) => user.mfa).length}/${users.length}` },
  ];

  const toggleStatus = async (user: UserAccount) => {
    if (user.id === CURRENT_USER_ID) {
      toast('Account not updated', 'You cannot deactivate the account you are signed in with.', 'error');
      return;
    }
    const deactivating = user.status === 'Active';
    const confirmed = await confirmAction({
      title: deactivating ? 'Deactivate this account?' : 'Activate this account?',
      description: deactivating ? `${user.name} will no longer be able to sign in until the account is activated again.` : `${user.name} will be able to sign in again.`,
      confirmLabel: deactivating ? 'Deactivate' : 'Activate',
      tone: deactivating ? 'destructive' : 'default',
    });
    if (!confirmed) return;
    setUsers((prev) => prev.map((entry) => (entry.id === user.id ? { ...entry, status: deactivating ? 'Inactive' : 'Active' } : entry)));
    toast(deactivating ? 'Account deactivated' : 'Account activated', `${user.name} (${user.email}).`);
    logActivity({ module: 'Administration', action: 'Updated', summary: `${deactivating ? 'Deactivated' : 'Activated'} the account of ${user.name}`, detail: user.email });
  };

  const resetPassword = async (user: UserAccount) => {
    const confirmed = await confirmAction({
      title: 'Send a password reset link?',
      description: `A reset link will be sent to ${user.email}. Their current password keeps working until they change it.`,
      confirmLabel: 'Send link',
    });
    if (!confirmed) return;
    toast('Password reset sent', `A reset link was sent to ${user.email}.`);
    logActivity({ module: 'Administration', action: 'Updated', summary: `Sent a password reset link to ${user.name}`, detail: user.email });
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
    setUsers((prev) => prev.filter((entry) => entry.id !== user.id));
    if (profileId === user.id) setProfileId(null);
    toast('Account deleted', `${user.name} (${user.email}) was removed.`);
    logActivity({ module: 'Administration', action: 'Deleted', summary: `Deleted the account of ${user.name}`, detail: user.email });
  };

  const createUser = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name || !email) {
      setFormError('Please enter the account name and email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      setFormError('An account with this email already exists.');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Create this user account?',
      description: `${name} will get the ${form.role} role, and an activation link will be sent to ${email}.`,
      confirmLabel: 'Create account',
    });
    if (!confirmed) return;
    const id = `USR-${String(Math.max(0, ...users.map((user) => Number(user.id.replace(/\D/g, '')) || 0)) + 1).padStart(3, '0')}`;
    setUsers((prev) => [
      ...prev,
      { id, name, username: email.split('@')[0], email, office: form.office.trim() || 'SB Secretariat', role: form.role, status: 'Active', mfa: false, lastActive: `${today}T00:00` },
    ]);
    toast('User account created', `An activation link was sent to ${email}.`);
    logActivity({ module: 'Administration', action: 'Created', summary: `Created a user account for ${name}`, detail: `${form.role} · activation link sent to ${email}` });
    setAddOpen(false);
  };

  const Avatar = ({ user, size = 'sm' }: { user: UserAccount; size?: 'sm' | 'lg' }) => (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'sm' ? 'h-9 w-9 text-xs' : 'h-16 w-16 text-lg',
        user.status === 'Active' ? roleTone(user.role).avatar : 'bg-slate-200 text-slate-500'
      )}
    >
      {initials(user.name)}
      <span
        className={cn('absolute bottom-0 right-0 rounded-full ring-2 ring-white', size === 'sm' ? 'h-2.5 w-2.5' : 'h-4 w-4', user.status === 'Active' ? 'bg-green-500' : 'bg-slate-400')}
        aria-hidden
      />
    </span>
  );

  const userActions = (user: UserAccount) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions for ${user.name}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => setProfileId(user.id)}>View profile</DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleStatus(user)}>{user.status === 'Active' ? 'Deactivate account' : 'Activate account'}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => resetPassword(user)}>Reset password</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-[#c62828] hover:bg-[#ffebee]" onClick={() => deleteUser(user)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">User Accounts</h1>
          <p className="text-sm text-text-muted">Staff accounts of the Sangguniang Bayan Secretariat and who can sign in.</p>
        </div>
        <Button
          onClick={() => {
            setForm({ name: '', email: '', office: '', role: roles.find((role) => role.name !== 'Administrator')?.name ?? roles[0].name });
            setFormError('');
            setAddOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Summary strip */}
        <dl className="grid grid-cols-2 divide-border border-b border-border sm:grid-cols-4 sm:divide-x">
          {summary.map((item) => (
            <div key={item.label} className="px-5 py-4">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{item.label}</dt>
              <dd className="mt-1 text-2xl font-semibold text-text-main">{item.value}</dd>
            </div>
          ))}
        </dl>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input value={keyword} onChange={(e) => { setKeyword(e.target.value); setCurrentPage(1); }} placeholder="Search name, username, office" className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-60">
              <Select
                options={roleOptions}
                value={roleOptions.find((option) => option.value === roleFilter) ?? null}
                onChange={(option) => {
                  setRoleFilter(option?.value ?? 'All');
                  setCurrentPage(1);
                }}
                isSearchable={false}
              />
            </div>
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
            <div className="flex h-10 w-full rounded-md border border-[rgb(228_228_231)] p-1 sm:w-60" role="group" aria-label="Status">
              {(['All', 'Active', 'Inactive'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                  aria-pressed={statusFilter === status}
                  className={cn('flex-1 rounded text-sm font-medium transition-colors', statusFilter === status ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main')}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DataTable
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filtered.length}
          currentCount={paginated.length}
          onPreviousPage={() => setCurrentPage(Math.max(1, page - 1))}
          onNextPage={() => setCurrentPage(Math.min(totalPages, page + 1))}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((user) => (
                <TableRow key={user.id} onClick={() => setProfileId(user.id)} className="cursor-pointer hover:bg-primary/[0.03]">
                  <TableCell>
                    <div className="mx-auto flex w-60 items-center gap-3 text-left">
                      <Avatar user={user} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-text-main" title={user.name}>{user.name}</span>
                        <span className="block font-mono text-[11px] text-text-muted">@{user.username}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-text-main">{user.office}</TableCell>
                  <TableCell>
                    <span className={cn('inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold', roleTone(user.role).pill)}>{user.role}</span>
                  </TableCell>
                  <TableCell>
                    <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium', user.status === 'Active' ? 'text-green-700' : 'text-slate-500')}>
                      <span className={cn('h-2 w-2 rounded-full', user.status === 'Active' ? 'bg-green-500' : 'bg-slate-400')} />
                      {user.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {user.mfa ? (
                      <ShieldCheck className="mx-auto h-4 w-4 text-green-600" aria-label="MFA on" />
                    ) : (
                      <ShieldOff className="mx-auto h-4 w-4 text-slate-400" aria-label="MFA off" />
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-text-muted">{lastActiveLabel(user.lastActive, today)}</TableCell>
                  {/* Menu clicks bubble through the portal; keep them from opening the profile. */}
                  <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                    {userActions(user)}
                  </TableCell>
                </TableRow>
              ))}
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-text-muted">
                    No accounts match the current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </DataTable>
      </section>

      {/* Profile drawer */}
      <Sheet open={profile !== null} onOpenChange={(open) => !open && setProfileId(null)}>
        <SheetContent side="right" className="w-full p-0 sm:w-[440px]">
          {profile ? (
            <div className="flex h-full flex-col bg-white">
              <div className="border-b border-border px-6 pb-5 pt-8 text-center">
                <div className="flex justify-center">
                  <Avatar user={profile} size="lg" />
                </div>
                <h2 className="mt-3 text-lg font-semibold text-text-main">{profile.name}</h2>
                <p className="font-mono text-xs text-text-muted">@{profile.username}</p>
                <div className="mt-3 flex justify-center gap-2">
                  <span className={cn('inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold', roleTone(profile.role).pill)}>{profile.role}</span>
                  <span
                    className={cn(
                      'inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold',
                      profile.status === 'Active' ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-200 bg-slate-50 text-slate-600'
                    )}
                  >
                    {profile.status}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Email</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-text-main">
                      <Mail className="h-3.5 w-3.5 text-text-muted" />
                      {profile.email}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Office</dt>
                    <dd className="mt-0.5 text-text-main">{profile.office}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Multi-factor</dt>
                    <dd className={cn('mt-0.5 font-medium', profile.mfa ? 'text-green-700' : 'text-amber-700')}>{profile.mfa ? 'Enabled' : 'Not set up'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Account ID</dt>
                    <dd className="mt-0.5 font-mono text-text-main">{profile.id}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Last active</dt>
                    <dd className="mt-0.5 text-text-main">{lastActiveLabel(profile.lastActive, today)}</dd>
                  </div>
                </dl>

                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Access through the {profile.role} role</h3>
                  <ul className="mt-2 space-y-2">
                    {MODULE_GROUPS.map((group) => {
                      const allowed = roles.find((role) => role.name === profile.role)?.modules.includes(group.name) ?? false;
                      return (
                        <li key={group.name} className={cn('rounded-lg border px-3 py-2', allowed ? 'border-border' : 'border-dashed border-border opacity-60')}>
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="font-medium text-text-main">{group.name}</span>
                            <span className={cn('text-[11px] font-semibold', allowed ? 'text-green-700' : 'text-text-muted')}>{allowed ? 'Allowed' : 'No access'}</span>
                          </div>
                          {allowed ? <div className="mt-0.5 text-[11px] text-text-muted">{group.pages.join(' · ')}</div> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Recent activity</h3>
                  {(() => {
                    const entries = activity.filter((entry) => entry.user === profile.username).slice(0, 5);
                    return entries.length > 0 ? (
                      <ol className="mt-2 space-y-2 border-l-2 border-border pl-4">
                        {entries.map((entry) => (
                          <li key={entry.id} className="text-[13px] leading-snug text-text-main">
                            {entry.summary}
                            <div className="text-[11px] text-text-muted">
                              {entry.module} · {lastActiveLabel(entry.timestamp, today)}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-2 text-xs text-text-muted">No recorded activity yet.</p>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-border px-6 py-4">
                <Button variant="outline" onClick={() => toggleStatus(profile)}>
                  {profile.status === 'Active' ? <UserX className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
                  {profile.status === 'Active' ? 'Deactivate' : 'Activate'}
                </Button>
                <Button variant="outline" onClick={() => resetPassword(profile)}>
                  Reset password
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">Add User</DialogTitle>
            <DialogDescription>The user receives an activation link by email.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createUser} className="mt-5 space-y-3">
            <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Office account name, e.g. Committee Secretary, Health" aria-label="Account name" />
            <Input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="name@capas.gov.ph" aria-label="Email address" />
            <Input value={form.office} onChange={(e) => setForm((prev) => ({ ...prev, office: e.target.value }))} placeholder="Office, e.g. Records Section" aria-label="Office" />
            <label className="block text-xs font-semibold text-text-muted">
              Role
              <select
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-normal text-text-main"
              >
                {roles.map((role) => (
                  <option key={role.name}>{role.name}</option>
                ))}
              </select>
            </label>
            {formError ? <p className="text-xs text-red-700">{formError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create account</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
