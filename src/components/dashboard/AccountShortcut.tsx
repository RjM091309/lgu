import { Check, ChevronDown, ShieldCheck, UserCog } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { logActivity } from '@/lib/activity-log';
import { setCurrentUser, useAccess, useRoles, useUsers } from '@/lib/access-store';
import { cn } from '@/lib/utils';

/** Dashboard role switcher (tabs, or a dropdown on phones): picking one signs in as that role's sample account, so each role's view can be shown. */
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
    <>
      <DropdownMenu className="w-full md:hidden">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-full items-center gap-2 rounded-md border border-border bg-white px-3 text-left text-sm shadow-sm"
            aria-label="Switch role"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-xs font-medium text-text-muted">Viewing as</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-primary">{user.role}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full">
          {accounts.map(({ role, account }) => {
            const active = role.name === user.role;
            return (
              <DropdownMenuItem
                key={role.name}
                onClick={() => switchTo(account!.id)}
                className={cn('gap-2 py-2', active && 'font-semibold text-primary')}
              >
                <UserCog className="h-4 w-4 shrink-0 text-text-muted" />
                <span className="flex-1">{role.name}</span>
                {active ? <Check className="h-4 w-4 shrink-0" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="hidden flex-wrap items-center gap-1 md:flex lg:justify-end" role="group" aria-label="Switch role">
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
                active ? 'theme-chrome bg-gradient-to-r from-[#18237f] via-[#151e74] to-[#111866] text-white shadow-sm ring-1 ring-inset ring-white/10' : 'text-text-muted hover:bg-primary/5 hover:text-primary'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {role.name}
            </button>
          );
        })}
      </div>
    </>
  );
}
