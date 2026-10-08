import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { Bell, CalendarDays, ChevronDown, ListChecks, LogIn, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toaster, toast } from '@/components/ui/toast';
import { ConfirmDialogHost } from '@/components/ui/confirm';
import { DEMO_PASSWORD, useUsers } from '@/lib/access-store';
import { useCalendarSessions, useESessionState, useSyncStatus, type Notice } from '@/lib/esession-sync';
import { isInvited, mobileAccounts, signInMobile, type MobileAccount } from '@/lib/mobile-accounts';
import { LocalNotifications } from '@capacitor/local-notifications';
import { MobileContext, useMobile } from '@/components/mobile/mobile-context';
import { ServerSettings } from '@/components/mobile/ServerSettings';
import { useDevicePresence } from '@/components/mobile/use-device-presence';
import { isNativeApp } from '@/lib/native';
import { noticeText } from '@/components/mobile/mobile-ui';
import { MobileSchedule } from '@/components/mobile/MobileSchedule';
import { MobileCalendar } from '@/components/mobile/MobileCalendar';
import { MobileAlerts } from '@/components/mobile/MobileAlerts';
import { MobileAccountPage } from '@/components/mobile/MobileAccountPage';
import { MobileSessionDetail } from '@/components/mobile/MobileSessionDetail';
import { cn } from '@/lib/utils';

// LIMS Mobile (/m): each member's and staff member's session schedule, attendance replies, and
// reminders. Shares its data with the web calendar through the E-Session sync.

const ACCOUNT_KEY = 'lims-mobile-account';
const seenKey = (inviteeId: string) => `lims-mobile-seen:${inviteeId}`;

// Per phone: which account is signed in and which notices it has already opened. Storage failures
// (private mode) only mean signing in again after a refresh.
const readStored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStored = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: kept for this visit only.
  }
};

/** Adds the web app manifest and phone chrome colour while the mobile app is open, so it can be added to the home screen. */
function useMobileHead() {
  useEffect(() => {
    const added: HTMLElement[] = [];
    const add = (tag: 'link' | 'meta', attrs: Record<string, string>) => {
      const element = document.createElement(tag);
      Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value));
      document.head.appendChild(element);
      added.push(element);
    };
    add('link', { rel: 'manifest', href: '/manifest.webmanifest' });
    add('meta', { name: 'theme-color', content: '#1a237e' });
    add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    add('meta', { name: 'apple-mobile-web-app-title', content: 'LIMS' });
    add('link', { rel: 'apple-touch-icon', href: '/lims-logo.svg' });
    const title = document.title;
    document.title = 'LIMS Mobile';
    return () => {
      added.forEach((element) => element.remove());
      document.title = title;
    };
  }, []);
}

export function MobileApp() {
  useMobileHead();
  const users = useUsers();
  const [accountId, setAccountId] = useState(() => readStored(ACCOUNT_KEY));
  const account = useMemo(() => mobileAccounts(users).find((entry) => entry.inviteeId === accountId) ?? null, [users, accountId]);

  // Listed on the Session Platform from the moment it connects, signed in or not.
  useDevicePresence(account);

  const signIn = (next: MobileAccount) => {
    writeStored(ACCOUNT_KEY, next.inviteeId);
    setAccountId(next.inviteeId);
  };
  const signOut = useCallback(() => {
    writeStored(ACCOUNT_KEY, null);
    setAccountId(null);
  }, []);

  return (
    <div className="min-h-dvh bg-slate-200/70 font-sans antialiased">
      <div className="relative mx-auto min-h-dvh w-full max-w-md bg-background shadow-xl">
        {account ? <SignedIn account={account} signOut={signOut} /> : <MobileLogin onSignIn={signIn} />}
      </div>
      <Toaster className="left-1/2 top-3 -translate-x-1/2" />
      <ConfirmDialogHost />
    </div>
  );
}

function SignedIn({ account, signOut }: { account: MobileAccount; signOut: () => void }) {
  const { notices: allNotices } = useESessionState();
  const sessions = useCalendarSessions();
  const users = useUsers();
  const status = useSyncStatus();

  // A reminder concerns the invitees it names; a newly scheduled session concerns everyone invited to it.
  const notices = useMemo(
    () =>
      allNotices.filter((notice) => {
        if (notice.kind === 'reminder') return notice.inviteeIds?.includes(account.inviteeId) ?? false;
        if (notice.kind === 'announcement') return true;
        const session = sessions.find((entry) => entry.id === notice.sessionId);
        return session ? account.canManage || isInvited(session, users, account.inviteeId) : false;
      }),
    [allNotices, sessions, users, account]
  );

  const [seen, setSeen] = useState<string[]>(() => {
    try {
      return JSON.parse(readStored(seenKey(account.inviteeId)) ?? '[]');
    } catch {
      return [];
    }
  });
  const unseenIds = useMemo(() => notices.filter((notice) => !seen.includes(notice.id)).map((notice) => notice.id), [notices, seen]);
  const markNoticesSeen = useCallback(() => {
    const ids = notices.map((notice) => notice.id).slice(0, 100);
    setSeen(ids);
    writeStored(seenKey(account.inviteeId), JSON.stringify(ids));
  }, [notices, account.inviteeId]);

  // Pop up notices that arrive while the app is open (only ones sent by someone else). Notices already
  // on the server when the app connects are not new.
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (status !== 'live') return;
    if (!known.current) {
      known.current = new Set(notices.map((notice) => notice.id));
      return;
    }
    const fresh = notices.filter((notice) => !known.current!.has(notice.id));
    notices.forEach((notice) => known.current!.add(notice.id));
    fresh
      .filter((notice) => notice.from !== account.name)
      .slice(0, 2)
      .forEach((notice) => {
        const session = sessions.find((entry) => entry.id === notice.sessionId);
        announce(notice, session?.title ?? 'a session', session?.type === 'Meeting');
      });
  }, [notices, sessions, account.name, status]);

  // The Android app shows reminders in the phone's notification bar (Android 13+ asks once).
  useEffect(() => {
    if (isNativeApp) void LocalNotifications.requestPermissions().catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ account, signOut, notices, unseenIds, markNoticesSeen }), [account, signOut, notices, unseenIds, markNoticesSeen]);

  return (
    <MobileContext.Provider value={value}>
      <Routes>
        <Route path="session/:id" element={<MobileSessionDetail />} />
        <Route
          path="*"
          element={
            <>
              <MobileHeader />
              <main className="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4">
                <Routes>
                  <Route index element={<MobileSchedule />} />
                  <Route path="calendar" element={<MobileCalendar />} />
                  <Route path="alerts" element={<MobileAlerts />} />
                  <Route path="account" element={<MobileAccountPage />} />
                  <Route path="*" element={<Navigate to="/m" replace />} />
                </Routes>
              </main>
              <TabBar />
            </>
          }
        />
      </Routes>
    </MobileContext.Provider>
  );
}

/** Android notification ids are 32-bit integers; derive a stable one from the notice id. */
const notificationId = (id: string) => [...id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7) & 0x7fffffff;

function announce(notice: Notice, title: string, meeting: boolean) {
  const { heading, body } = noticeText(notice, title, meeting);
  toast(heading, body, 'info');
  navigator.vibrate?.([120, 60, 120]);
  if (isNativeApp) {
    void LocalNotifications.schedule({ notifications: [{ id: notificationId(notice.id), title: heading, body }] }).catch(() => undefined);
    return;
  }
  // System notifications need a secure page (https or localhost) and the user's permission.
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
      new Notification(heading, { body, icon: '/lims-logo.svg', tag: notice.id });
    }
  } catch {
    // Some mobile browsers only allow notifications from a service worker; the toast is enough.
  }
}

function MobileHeader() {
  const { account } = useMobile();
  const status = useSyncStatus();
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-[#141b66] to-[#1a237e] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white shadow-md">
      <div className="flex items-center gap-3">
        <img src="/lims-logo.svg" alt="" className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight tracking-wide">LIMS Mobile</p>
          <p className="flex items-center gap-1.5 text-[11px] text-white/70">
            <span className={cn('h-1.5 w-1.5 rounded-full', status === 'live' ? 'bg-green-400' : status === 'connecting' ? 'bg-amber-300' : 'bg-white/40')} aria-hidden />
            {status === 'live' ? 'Connected to LIMS' : status === 'connecting' ? 'Connecting…' : 'Offline · changes stay on this phone'}
          </p>
        </div>
        <NavLink to="/m/account" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[11px] font-bold text-primary ring-2 ring-[#d4a72c]" aria-label="Account">
          {account.abbr}
        </NavLink>
      </div>
    </header>
  );
}

function TabBar() {
  const unseen = useMobile().unseenIds.length;
  const tabs = [
    { to: '/m', label: 'Schedule', icon: ListChecks, end: true },
    { to: '/m/calendar', label: 'Calendar', icon: CalendarDays },
    { to: '/m/alerts', label: 'Alerts', icon: Bell, badge: unseen },
    { to: '/m/account', label: 'Account', icon: UserRound },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main">
      <ul className="grid grid-cols-4">
        {tabs.map(({ to, label, icon: Icon, end, badge }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors', isActive ? 'text-primary' : 'text-text-muted')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('relative flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-primary/10')}>
                    <Icon className="h-5 w-5" />
                    {badge ? (
                      <span className="absolute -right-0.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    ) : null}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function MobileLogin({ onSignIn }: { onSignIn: (account: MobileAccount) => void }) {
  const users = useUsers();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showAccounts, setShowAccounts] = useState(false);
  const accounts = mobileAccounts(users);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError('Enter your username and password.');
    const account = signInMobile(users, username, password);
    if (!account) return setError('The username or password is incorrect.');
    toast('Signed in', `Welcome, ${account.name}.`);
    onSignIn(account);
  };

  const pick = (account: MobileAccount) => {
    setUsername(account.username);
    setPassword(DEMO_PASSWORD);
    setError('');
    setShowAccounts(false);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-[#141b66] via-[#1a237e] to-[#283593] px-6 pb-8 pt-[calc(3.5rem+env(safe-area-inset-top))] text-white">
      <div className="flex flex-col items-center text-center">
        <img src="/lims-logo.svg" alt="" className="h-24 w-24 drop-shadow-lg" />
        <h1 className="mt-4 font-serif text-3xl font-bold tracking-wide">LIMS</h1>
        <p className="mt-1 text-sm text-white/75">Legislative Information Management System</p>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#f1d27a]">
          <CalendarDays className="h-3.5 w-3.5" />
          Session schedule and attendance
        </p>
      </div>

      {isNativeApp ? <ServerSettings dark className="mt-8" /> : null}

      <form onSubmit={submit} className={cn(isNativeApp ? 'mt-4' : 'mt-10', 'space-y-3 rounded-2xl bg-white p-5 text-text-main shadow-2xl')} noValidate>
        <label className="block">
          <span className="text-xs font-semibold text-text-muted">Username</span>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" className="mt-1.5 h-11 text-base" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-text-muted">Password</span>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mt-1.5 h-11 text-base" />
        </label>
        {error ? (
          <p className="text-xs font-medium text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="h-11 w-full text-base">
          <LogIn className="mr-2 h-4 w-4" />
          Sign in
        </Button>
      </form>

      <div className="mt-5 overflow-hidden rounded-2xl bg-white/10">
        <button type="button" onClick={() => setShowAccounts((prev) => !prev)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold" aria-expanded={showAccounts}>
          Demo accounts
          <ChevronDown className={cn('h-4 w-4 transition-transform', showAccounts && 'rotate-180')} />
        </button>
        {showAccounts ? (
          <ul className="max-h-72 divide-y divide-white/10 overflow-y-auto border-t border-white/10">
            {accounts.map((account) => (
              <li key={account.inviteeId}>
                <button type="button" onClick={() => pick(account)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/10">
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', account.group === 'member' ? 'bg-[#d4a72c] text-[#141b66]' : 'bg-white/20')}>
                    {account.abbr}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{account.name}</span>
                    <span className="block truncate text-[11px] text-white/60">{account.canManage ? 'Administrator · schedules sessions' : account.detail}</span>
                  </span>
                  <span className="font-mono text-[11px] text-white/60">{account.username}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
