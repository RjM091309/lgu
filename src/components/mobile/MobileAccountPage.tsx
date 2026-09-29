import { LogOut, MonitorSmartphone, Share, ShieldCheck, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { confirmAction } from '@/components/ui/confirm';
import { useSyncStatus } from '@/lib/esession-sync';
import { useMobile } from '@/components/mobile/mobile-context';
import { useMySessions } from '@/components/mobile/mobile-sessions';
import { todayInManila } from '@/lib/session-files';
import { cn } from '@/lib/utils';
import { isNativeApp } from '@/lib/native';
import { ServerSettings } from '@/components/mobile/ServerSettings';

/** The signed-in account, attendance summary, connection, and sign-out. */
export function MobileAccountPage() {
  const { account, signOut } = useMobile();
  const status = useSyncStatus();
  const today = todayInManila();
  const invited = useMySessions().filter((entry) => entry.invited && entry.session.date >= today);
  const count = (value: string) => invited.filter((entry) => entry.status === value).length;

  const confirmSignOut = async () => {
    if (await confirmAction({ title: 'Sign out?', description: 'You will stop seeing reminders on this phone until you sign in again.', confirmLabel: 'Sign out' })) signOut();
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-col items-center rounded-2xl bg-white px-4 py-6 text-center shadow-sm ring-1 ring-border">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-bold text-white ring-4 ring-[#d4a72c]/40">{account.abbr}</span>
        <h1 className="mt-3 text-lg font-bold text-primary">{account.name}</h1>
        <p className="text-xs text-text-muted">{account.detail}</p>
        <p className="mt-1 font-mono text-[11px] text-text-muted">@{account.username}</p>
        {account.canManage ? (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Administrator: schedules sessions and sees all replies
          </p>
        ) : null}
      </section>

      <section className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Attending', value: count('attending'), tone: 'text-green-700' },
          { label: 'Not attending', value: count('declined'), tone: 'text-red-700' },
          { label: 'Reply needed', value: count('none'), tone: 'text-amber-700' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-white px-2 py-3 shadow-sm ring-1 ring-border">
            <p className={cn('text-2xl font-bold tabular-nums', stat.tone)}>{stat.value}</p>
            <p className="text-[10px] font-medium text-text-muted">{stat.label}</p>
          </div>
        ))}
      </section>
      <p className="-mt-2 text-center text-[11px] text-text-muted">Your replies to upcoming sessions</p>

      {isNativeApp ? <ServerSettings /> : null}

      <section className="space-y-3 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-border">
        <p className="flex items-start gap-3">
          <Wifi className={cn('mt-0.5 h-4 w-4 shrink-0', status === 'live' ? 'text-green-600' : 'text-amber-600')} />
          <span>
            <span className="block font-semibold text-text-main">{status === 'live' ? 'Connected to LIMS' : 'Not connected'}</span>
            <span className="block text-xs text-text-muted">
              {status === 'live' ? 'Your replies reach the Secretariat at once.' : 'Replies stay on this phone until it reconnects to the LIMS network.'}
            </span>
          </span>
        </p>
        {isNativeApp ? null : (
        <p className="flex items-start gap-3">
          <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="block font-semibold text-text-main">Add to home screen</span>
            <span className="block text-xs text-text-muted">
              Android (Chrome): menu ⋮ then <b>Add to Home screen</b>. iPhone (Safari): <Share className="inline h-3 w-3" /> Share then <b>Add to Home Screen</b>.
            </span>
          </span>
        </p>
        )}
      </section>

      <Button variant="outline" className="h-12 w-full border-red-200 text-base text-red-700 hover:bg-red-50" onClick={confirmSignOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}
