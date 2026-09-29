import { Fragment, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Lock, Minus, MoreHorizontal, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { logActivity } from '@/lib/activity-log';
import { ADMIN_ROLE, ALL_PAGES, PERMISSION_GROUPS, ROLE_TONE, initials, setRoles, useRoles, useUsers, type Role } from '@/lib/access-store';
import { cn } from '@/lib/utils';

const today = () => new Date().toISOString().slice(0, 10);
const TONES: Role['tone'][] = ['blue', 'violet', 'emerald', 'slate', 'indigo'];
const pageLabel = (id: string) => PERMISSION_GROUPS.flatMap((group) => group.pages).find((page) => page.id === id)?.label ?? id;

export function RolesPage() {
  const roles = useRoles();
  const users = useUsers();
  // Matrix edits are staged here until saved.
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', scope: '' });
  const [formError, setFormError] = useState('');

  const pagesOf = (role: Role) => draft[role.name] ?? role.pages;
  const changedRoles = useMemo(
    () =>
      roles.filter((role) => {
        const staged = draft[role.name];
        return staged && (staged.length !== role.pages.length || staged.some((page) => !role.pages.includes(page)));
      }),
    [roles, draft]
  );

  const setPages = (role: Role, ids: string[], grant: boolean) => {
    if (role.name === ADMIN_ROLE) return;
    const current = pagesOf(role);
    // Kept in sidebar order so the saved list reads the same way as the matrix.
    const next = grant ? ALL_PAGES.filter((id) => current.includes(id) || ids.includes(id)) : current.filter((id) => !ids.includes(id));
    setDraft((prev) => ({ ...prev, [role.name]: next }));
  };

  const saveChanges = async () => {
    const empty = changedRoles.find((role) => pagesOf(role).length === 0);
    if (empty) {
      toast('Permissions not saved', `${empty.name} needs access to at least one page.`, 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Save permission changes?',
      description: `${changedRoles.map((role) => role.name).join(', ')} will get the updated access immediately for everyone assigned to ${changedRoles.length === 1 ? 'that role' : 'those roles'}.`,
      confirmLabel: 'Save changes',
    });
    if (!confirmed) return;
    setRoles((prev) => prev.map((role) => (draft[role.name] && changedRoles.includes(role) ? { ...role, pages: draft[role.name], updated: today() } : role)));
    changedRoles.forEach((role) =>
      logActivity({ module: 'Administration', action: 'Updated', summary: `Saved permissions for the ${role.name} role`, detail: `Access to ${pagesOf(role).map(pageLabel).join(', ')}.` })
    );
    toast('Permissions saved', `${changedRoles.length} role${changedRoles.length === 1 ? '' : 's'} updated.`);
    setDraft({});
  };

  const deleteRole = async (role: Role) => {
    const assigned = users.filter((user) => user.role === role.name).length;
    if (role.name === ADMIN_ROLE || assigned > 0) {
      toast(
        'Role not deleted',
        role.name === ADMIN_ROLE ? 'The Administrator role is required and cannot be deleted.' : `${role.name} is still assigned to ${assigned} user(s). Move them to another role first.`,
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
    setDraft(({ [role.name]: _removed, ...rest }) => rest);
    toast('Role deleted', `${role.name} was removed.`);
    logActivity({ module: 'Administration', action: 'Deleted', summary: `Deleted the ${role.name} role` });
  };

  const createRole = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFormError('Please enter a role name.');
      return;
    }
    if (roles.some((role) => role.name.toLowerCase() === name.toLowerCase())) {
      setFormError('A role with this name already exists.');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Create this role?',
      description: `${name} will be added with no page access. Tick its pages in the access matrix next.`,
      confirmLabel: 'Create role',
    });
    if (!confirmed) return;
    setRoles((prev) => [...prev, { name, scope: form.scope.trim() || 'Custom access', updated: today(), pages: [], tone: TONES[prev.length % TONES.length] }]);
    toast('Role created', `${name} was added. Set its permissions in the access matrix.`);
    logActivity({ module: 'Administration', action: 'Created', summary: `Created the ${name} role` });
    setAddOpen(false);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Roles &amp; Permissions</h1>
          <p className="text-sm text-text-muted">Who can open which part of the system. Changes apply to everyone in the role.</p>
        </div>
        <Button
          onClick={() => {
            setForm({ name: '', scope: '' });
            setFormError('');
            setAddOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Role
        </Button>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {roles.map((role) => {
          const tone = ROLE_TONE[role.tone];
          const members = users.filter((user) => user.role === role.name);
          const pageCount = role.name === ADMIN_ROLE ? ALL_PAGES.length : pagesOf(role).length;
          return (
            <div key={role.name} className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-white p-5 shadow-sm">
              <span className={cn('absolute inset-x-0 top-0 h-1', tone.bar)} aria-hidden />
              <div className="flex items-start justify-between gap-2">
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tone.pill)}>
                  {role.name === ADMIN_ROLE ? <Lock className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions for ${role.name}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem className="text-[#c62828] hover:bg-[#ffebee]" onClick={() => deleteRole(role)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete role
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <h3 className="mt-3 text-base font-semibold text-text-main">{role.name}</h3>
              <p className="mt-0.5 flex-1 text-xs leading-relaxed text-text-muted">{role.scope}</p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {members.slice(0, 4).map((user) => (
                    <span
                      key={user.id}
                      className={cn('flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-white', user.status === 'Active' ? tone.avatar : 'bg-slate-200 text-slate-500')}
                      title={user.name}
                    >
                      {initials(user.name)}
                    </span>
                  ))}
                  {members.length > 4 ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-text-muted ring-2 ring-white">+{members.length - 4}</span>
                  ) : null}
                  {members.length === 0 ? <span className="text-xs text-text-muted">No members</span> : null}
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                  <Users className="h-3.5 w-3.5" />
                  {members.length} · {pageCount}/{ALL_PAGES.length} pages
                </span>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setForm({ name: '', scope: '' });
            setFormError('');
            setAddOpen(true);
          }}
          className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-text-muted transition-colors hover:border-primary/50 hover:text-primary"
        >
          <Plus className="h-5 w-5" />
          New role
        </button>
      </div>

      {/* Access matrix */}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <header className="border-b border-border px-4 py-4 sm:px-5">
          <h2 className="text-base font-semibold text-text-main">Access Matrix</h2>
          <p className="text-xs text-text-muted">
            Tick a page to let a role open it; the group row ticks every page in the group. People only see the pages their role allows. The Administrator role always has full access.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="sticky left-0 z-10 w-[190px] bg-[#f9fbfd] px-4 py-3 text-left text-xs font-bold uppercase text-text-main sm:w-auto sm:px-5">Page</th>
                {roles.map((role) => (
                  <th key={role.name} className="px-3 py-3 text-center text-xs font-bold uppercase text-text-main">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', ROLE_TONE[role.tone].bar)} />
                      {role.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => {
                const ids = group.pages.map((page) => page.id);
                return (
                  <Fragment key={group.id}>
                    <tr className="border-b border-border bg-muted/25">
                      <td className="sticky left-0 z-10 w-[190px] bg-[#fbfcfe] px-4 py-2.5 font-semibold text-text-main shadow-[1px_0_0_var(--color-border)] sm:w-auto sm:px-5">{group.name}</td>
                      {roles.map((role) => {
                        const locked = role.name === ADMIN_ROLE;
                        const granted = locked ? ids.length : ids.filter((id) => pagesOf(role).includes(id)).length;
                        const state = granted === ids.length ? 'all' : granted > 0 ? 'some' : 'none';
                        return (
                          <td key={role.name} className="px-3 py-2.5 text-center">
                            <AccessBox
                              checked={state === 'all' ? true : state === 'some' ? 'mixed' : false}
                              locked={locked}
                              label={`${role.name}: all ${group.name} pages`}
                              onClick={() => setPages(role, ids, state !== 'all')}
                            />
                          </td>
                        );
                      })}
                    </tr>
                    {group.pages.map((page) => (
                      <tr key={page.id} className="border-b border-border last:border-b-0">
                        <td className="sticky left-0 z-10 w-[190px] bg-white py-2.5 pl-8 pr-4 text-text-main shadow-[1px_0_0_var(--color-border)] sm:w-auto sm:pl-10 sm:pr-5">{page.label}</td>
                        {roles.map((role) => {
                          const locked = role.name === ADMIN_ROLE;
                          const granted = locked || pagesOf(role).includes(page.id);
                          const changed = !locked && granted !== role.pages.includes(page.id);
                          return (
                            <td key={role.name} className={cn('px-3 py-2.5 text-center', changed && 'bg-amber-50')}>
                              <AccessBox checked={granted} locked={locked} label={`${role.name}: ${page.label}`} onClick={() => setPages(role, [page.id], !granted)} small />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Unsaved-changes bar */}
      {changedRoles.length > 0 ? (
        <div className="sticky bottom-4 z-10 mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-xl border border-border bg-[#0f1650] px-5 py-3 text-white shadow-2xl">
          <span className="text-sm">
            Unsaved changes to <b>{changedRoles.map((role) => role.name).join(', ')}</b>
          </span>
          <span className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => setDraft({})}>
              Discard
            </Button>
            <Button size="sm" className="bg-white text-primary hover:bg-white/90" onClick={saveChanges}>
              Save changes
            </Button>
          </span>
        </div>
      ) : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">Add Role</DialogTitle>
            <DialogDescription>Create a role, then tick the module groups it can access in the matrix.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createRole} className="mt-5 space-y-3">
            <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Role name" aria-label="Role name" />
            <Input value={form.scope} onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value }))} placeholder="Short description of the role" aria-label="Description" />
            {formError ? <p className="text-xs text-red-700">{formError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create role</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccessBox({ checked, locked, label, onClick, small = false }: { checked: boolean | 'mixed'; locked: boolean; label: string; onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={locked ? 'Administrator always has full access' : undefined}
      className={cn(
        'mx-auto flex items-center justify-center rounded-lg border-2 transition-colors',
        small ? 'h-7 w-7' : 'h-8 w-8',
        checked === true && 'border-primary bg-primary text-white',
        checked === 'mixed' && 'border-primary bg-primary/10 text-primary',
        checked === false && 'border-border bg-white text-transparent hover:border-primary/50',
        locked && 'cursor-not-allowed border-primary/40 bg-primary/40 text-white'
      )}
    >
      {locked ? <Lock className="h-3.5 w-3.5" /> : checked === 'mixed' ? <Minus className="h-4 w-4" strokeWidth={3} /> : <Check className="h-4 w-4" strokeWidth={3} />}
    </button>
  );
}
