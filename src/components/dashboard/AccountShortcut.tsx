import { ShieldCheck, UserCog } from 'lucide-react';
import { logActivity } from '@/lib/activity-log';
import { setCurrentUser, useAccess, useRoles, useUsers } from '@/lib/access-store';
import { cn } from '@/lib/utils';

/** Dashboard row of role tabs: picking one signs in as that role's sample account, so each role's view can be shown. */
export function AccountShortcut() {
  const { user } = useAccess();
  const roles = useRoles();
  const users = useUsers();

  // One sample account per role; roles with no active account are left out.
  const accounts = roles
    .map((role) => ({ role, account: users.find((candidate) => candidate.role === role.name && candidate.status === 'Active') }))
    .filter((entry) => entry.account);

  const switchTo = (id: string) => {
    const next = users.find((candidate) => candidate.id === id);
    if (!next || next.id === user.id) return;
    logActivity({ module: 'Authentication', action: 'Signed out', summary: 'Signed out of the Secretariat portal' });
    setCurrentUser(next.id);
    logActivity({ module: 'Authentication', action: 'Signed in', summary: 'Signed in to the Secretariat portal' });
  };

  return (
    <div className="flex flex-wrap items-center gap-1 lg:justify-end" role="group" aria-label="Switch role">
      {accounts.map(({ role, account }) => {
        const active = role.name === user.role;
        const Icon = active ? ShieldCheck : UserCog;
        return (
          <button
            key={role.name}
            type="button"
            onClick={() => switchTo(account!.id)}
            aria-pressed={active}
            title={`${account!.name} · ${account!.username}`}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold uppercase tracking-wide transition-colors',
              active ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-primary/5 hover:text-primary'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {role.name}
          </button>
        );
      })}
    </div>
  );
}
