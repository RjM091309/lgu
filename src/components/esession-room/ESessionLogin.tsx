import { useState, type FormEvent } from 'react';
import { ArrowLeft, ChevronDown, Lock, LogIn, User, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { DEMO_PASSWORD, useUsers } from '@/lib/access-store';
import { mobileAccounts, type MobileAccount } from '@/lib/mobile-accounts';
import { signInESession } from '@/lib/esession-room';
import { cn } from '@/lib/utils';
import { InsecureNotice } from '@/components/esession-room/es-ui';

/** Sign-in for opening /es directly (a bookmark or the home-screen icon). The landing page's Staff Login does the same. */
export function ESessionLogin({ onSignIn }: { onSignIn: (account: MobileAccount, remember: boolean) => void }) {
  const users = useUsers();
  // Opened from the dashboard's E-Session button on another address: the username comes filled in.
  const [username, setUsername] = useState(() => new URLSearchParams(window.location.search).get('user') ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [showAccounts, setShowAccounts] = useState(false);
  const accounts = mobileAccounts(users);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) return setError('Enter your username and password.');
    const result = signInESession(users, username, password);
    if ('error' in result) {
      setError(
        result.error === 'inactive'
          ? 'This account is deactivated. Contact the SB Secretariat administrator.'
          : result.error === 'no-sessions'
            ? `The ${result.role} role does not take part in sessions. Use the Staff Portal instead.`
            : 'The username or password is incorrect.'
      );
      return;
    }
    toast('Signed in', `Welcome, ${result.account.name}.`);
    onSignIn(result.account, remember);
  };

  const pick = (account: MobileAccount) => {
    setUsername(account.username);
    setPassword(DEMO_PASSWORD);
    setError('');
    setShowAccounts(false);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#0a0f3d] via-[#1a237e] to-[#283593] px-4 pb-10 pt-[calc(1.5rem+env(safe-area-inset-top))] text-white">
      <div className="mx-auto w-full max-w-md">
        <a href="/" className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Public site
        </a>
        <div className="mt-6 flex flex-col items-center text-center">
          <img src="/lims-logo.svg" alt="" className="h-20 w-20 drop-shadow-lg" />
          <h1 className="mt-4 text-3xl font-bold tracking-wide">LIMS E-Session</h1>
          <p className="mt-1 text-sm text-white/75">Legislative Information Management System</p>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#f1d27a]">
            <Video className="h-3.5 w-3.5" />
            Live sittings of the Sanggunian
          </p>
        </div>

        <InsecureNotice className="mt-6" />

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl bg-white p-5 text-text-main shadow-2xl sm:p-6" noValidate>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-text-muted">Username</span>
            <span className="relative block">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" placeholder="e.g. councilor1 or admin" className="h-12 pl-9 text-base" />
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-text-muted">Password</span>
            <span className="relative block">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-12 pl-9 text-base" />
            </span>
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm text-text-muted">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-primary" />
            Keep me signed in on this device
          </label>
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="h-12 w-full text-base font-bold">
            <LogIn className="mr-2 h-4 w-4" />
            Sign in to E-Session
          </Button>
        </form>

        <div className="mt-5 overflow-hidden rounded-2xl bg-white/10">
          <button type="button" onClick={() => setShowAccounts((prev) => !prev)} className="flex min-h-12 w-full items-center justify-between px-4 text-sm font-semibold" aria-expanded={showAccounts}>
            Demo accounts (password {DEMO_PASSWORD})
            <ChevronDown className={cn('h-4 w-4 transition-transform', showAccounts && 'rotate-180')} />
          </button>
          {showAccounts ? (
            <ul className="max-h-80 divide-y divide-white/10 overflow-y-auto border-t border-white/10">
              {accounts.map((account) => (
                <li key={account.inviteeId}>
                  <button type="button" onClick={() => pick(account)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/10">
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', account.group === 'member' ? 'bg-[#d4a72c] text-[#141b66]' : 'bg-white/20')}>
                      {account.abbr}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{account.name}</span>
                      <span className="block truncate text-[11px] text-white/60">{account.canManage ? 'Administrator · hosts e-sessions' : account.detail}</span>
                    </span>
                    <span className="font-mono text-[11px] text-white/60">{account.username}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
