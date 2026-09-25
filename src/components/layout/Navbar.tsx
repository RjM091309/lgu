import * as React from 'react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bell, ChevronDown, ChevronRight, CircleHelp, KeyRound, LogOut, Mail, Menu, Search, User, X } from 'lucide-react';
import { LGU_PROFILE, mockBills, mockMembers, mockSessions } from '@/lib/mock-data';
import { NAV_GROUPS, findNavItem } from '@/lib/navigation';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { logActivity } from '@/lib/activity-log';

interface NavbarProps {
  activeTab: string;
  onMenuClick: () => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

const INITIAL_NOTIFICATIONS = [
  {
    id: 'n1',
    title: 'Committee report due',
    body: 'Committee on Transportation report on Prop. Ord. No. 2026-P-012 is due this week.',
    time: '2 hours ago',
    tab: 'manage-legislation',
    unread: true,
  },
  {
    id: 'n2',
    title: 'Signature requested',
    body: 'Mun. Ord. No. 2026-007 is awaiting electronic signatures.',
    time: '5 hours ago',
    tab: 'esig-electronic-signature',
    unread: true,
  },
  {
    id: 'n3',
    title: 'Agenda ready for review',
    body: 'The order of business for the 38th Regular Session is ready.',
    time: 'Yesterday',
    tab: 'manage-transactions',
    unread: true,
  },
  {
    id: 'n4',
    title: 'Account request',
    body: 'A new committee staff account is pending approval.',
    time: '2 days ago',
    tab: 'access-users',
    unread: false,
  },
];

export function Navbar({ activeTab, onMenuClick, onLogout, onNavigate }: NavbarProps) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [dialog, setDialog] = useState<'help' | 'profile' | 'settings' | null>(null);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const searchBoxRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const current = findNavItem(activeTab);
  const unreadCount = notifications.filter((item) => item.unread).length;
  const today = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const searchEntries = useMemo(
    () => [
      ...NAV_GROUPS.flatMap((group) =>
        group.items.map((item) => ({
          id: `menu-${item.id}`,
          label: item.label,
          tab: item.id,
          keywords: [group.label, ...item.keywords],
          group: 'Page',
        }))
      ),
      ...mockBills.map((bill) => ({
        id: `bill-${bill.id}`,
        label: `${bill.number} - ${bill.title}`,
        tab: 'manage-legislation',
        keywords: [bill.number, bill.title, bill.author, bill.category],
        group: 'Legislation',
      })),
      ...mockMembers.map((member) => ({
        id: `member-${member.id}`,
        label: `${member.name} (${member.role})`,
        tab: 'manage-master-files',
        keywords: [member.name, member.role, member.position, member.seat],
        group: 'Member',
      })),
      ...mockSessions.map((session) => ({
        id: `session-${session.id}`,
        label: `${session.title} (${session.date})`,
        tab: 'manage-transactions',
        keywords: [session.title, session.type, session.location, session.date],
        group: 'Session',
      })),
      ...['38th Regular Session Agenda - Week 41.pdf', 'Plenary Recording - Week 41.mp4', 'Session Minutes Draft.docx'].map((fileName, index) => ({
        id: `session-file-${index}`,
        label: fileName,
        tab: 'esig-session-files',
        keywords: [fileName, 'session file', 'attachment'],
        group: 'Session File',
      })),
    ],
    []
  );

  const matchesSearchQuery = (query: string, values: string[]) => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return false;
    const haystack = values.join(' ').toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  };

  const searchResults = useMemo(() => {
    if (!searchKeyword.trim()) return [];
    return searchEntries.filter((entry) => matchesSearchQuery(searchKeyword, [entry.label, ...entry.keywords])).slice(0, 12);
  }, [searchKeyword, searchEntries]);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('lgu-global-recent-searches');
      if (!saved) return;
      const parsed = JSON.parse(saved) as string[];
      if (Array.isArray(parsed)) setRecentSearches(parsed.slice(0, 5));
    } catch {
      // Ignore parse/storage errors to keep search usable.
    }
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!searchBoxRef.current?.contains(event.target as Node)) setIsSearchOpen(false);
    };
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
      if (event.key === 'Escape') setIsSearchOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleShortcut);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleShortcut);
    };
  }, []);

  const saveRecentSearch = (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;
    setRecentSearches((prev) => {
      const next = [normalized, ...prev.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 5);
      try {
        localStorage.setItem('lgu-global-recent-searches', JSON.stringify(next));
      } catch {
        // Ignore storage errors.
      }
      return next;
    });
  };

  const openEntry = (entry: { tab: string; label: string }, query: string) => {
    saveRecentSearch(query);
    onNavigate(entry.tab);
    setSearchKeyword('');
    setIsSearchOpen(false);
  };

  const navigateByQuery = (query: string) => {
    const match = searchEntries.find((entry) => matchesSearchQuery(query, [entry.label, ...entry.keywords]));
    if (!match) {
      toast('No matching page or record', `Nothing matched "${query}".`, 'info');
      return;
    }
    openEntry(match, query);
  };

  const handleGlobalSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchKeyword.trim()) navigateByQuery(searchKeyword);
  };

  const openNotification = (id: string, tab: string) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, unread: false } : item)));
    onNavigate(tab);
  };

  const handlePasswordSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fail = (message: string) => {
      setPasswordError(message);
      toast('Password not updated', message, 'error');
    };
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      fail('Please complete all password fields.');
      return;
    }
    if (passwordForm.next.length < 12) {
      fail('The new password must be at least 12 characters.');
      return;
    }
    if (passwordForm.next === passwordForm.current) {
      fail('The new password must be different from your current password.');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      fail('The new passwords do not match.');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Change your password?',
      description: 'You will need to use the new password the next time you sign in.',
      confirmLabel: 'Change password',
    });
    if (!confirmed) return;
    setPasswordError('');
    setPasswordForm({ current: '', next: '', confirm: '' });
    setDialog(null);
    toast('Password updated', 'Use your new password the next time you sign in.');
    logActivity({ module: 'Administration', action: 'Updated', summary: 'Changed the account password' });
  };

  const closeDialog = () => setDialog(null);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-white">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>

        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm lg:flex">
          <button type="button" onClick={() => onNavigate('dashboard')} className="text-text-muted hover:text-primary">
            Home
          </button>
          {current && current.item.id !== 'dashboard' ? (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
              <span className="text-text-muted">{current.group.label}</span>
              <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
              <span className="truncate font-semibold text-primary">{current.item.label}</span>
            </>
          ) : (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
              <span className="font-semibold text-primary">Dashboard</span>
            </>
          )}
        </nav>

        <div ref={searchBoxRef} className="relative ml-auto w-full max-w-sm">
          <form onSubmit={handleGlobalSearchSubmit} role="search">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchKeyword}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setIsSearchOpen(true);
              }}
              placeholder="Search pages, records, members..."
              aria-label="Search"
              className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-16 text-[13px] outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
            />
            {searchKeyword ? (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-white px-1.5 text-[11px] text-text-muted sm:block">
                /
              </kbd>
            )}
          </form>

          {isSearchOpen ? (
            <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-lg border border-border bg-white p-2 shadow-xl">
              {searchKeyword.trim() ? (
                searchResults.length > 0 ? (
                  <ul className="max-h-80 space-y-0.5 overflow-y-auto">
                    {searchResults.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                          onClick={() => openEntry(entry, searchKeyword)}
                          title={entry.label}
                        >
                          <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                          <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] leading-none text-text-muted">{entry.group}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-2 py-1.5 text-sm text-text-muted">No matching results.</p>
                )
              ) : (
                <>
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {recentSearches.length > 0 ? 'Recent searches' : 'Try searching for'}
                  </p>
                  <div className="flex flex-wrap gap-1.5 px-2 pb-1">
                    {(recentSearches.length > 0 ? recentSearches : ['tricycle', 'budget', 'regular session', 'users', 'archives']).map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => {
                          setSearchKeyword(term);
                          navigateByQuery(term);
                        }}
                        className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary hover:text-primary"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        <span className="hidden whitespace-nowrap text-xs text-text-muted xl:inline">{today}</span>

        <Button variant="ghost" size="icon" onClick={() => setDialog('help')} aria-label="Help" title="Help">
          <CircleHelp className="h-5 w-5 text-text-muted" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unreadCount} unread)`} title="Notifications">
              <Bell className="h-5 w-5 text-text-muted" />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              <button
                type="button"
                onClick={() => setNotifications((prev) => prev.map((item) => ({ ...item, unread: false })))}
                className="text-xs font-semibold text-primary hover:underline disabled:text-text-muted disabled:no-underline"
                disabled={unreadCount === 0}
              >
                Mark all as read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-1">
              {notifications.map((item) => (
                <DropdownMenuItem key={item.id} onClick={() => openNotification(item.id, item.tab)} className="items-start gap-3 px-3 py-2.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.unread ? 'bg-primary' : 'bg-transparent'}`} />
                  <span className="min-w-0">
                    <span className={`block text-sm ${item.unread ? 'font-semibold' : ''}`}>{item.title}</span>
                    <span className="mt-0.5 block text-xs text-text-muted">{item.body}</span>
                    <span className="mt-1 block text-[11px] text-text-muted">{item.time}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-muted" aria-label="Account menu">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">SB</span>
              <span className="hidden text-left leading-tight md:block">
                <span className="block text-[13px] font-semibold">SB Secretariat Admin</span>
                <span className="block text-[11px] text-text-muted">Administrator</span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-text-muted md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="end">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-semibold">SB Secretariat Admin</p>
              <p className="text-xs text-text-muted">sb.admin@capas.gov.ph</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDialog('profile')}>
              <User className="mr-2 h-4 w-4" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog('settings')}>
              <KeyRound className="mr-2 h-4 w-4" />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog('help')}>
              <CircleHelp className="mr-2 h-4 w-4" />
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={dialog === 'help'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="relative max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">Help & Support</DialogTitle>
            <DialogDescription>Quick guide to the Legislative Management System.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            {[
              { tab: 'manage-legislation', title: 'Record and track legislation', text: 'Create records, move them through readings, and attach full texts.' },
              { tab: 'manage-transactions', title: 'Prepare sessions', text: 'Route documents, build the agenda, and issue transmittals.' },
              { tab: 'esig-electronic-signature', title: 'Sign measures electronically', text: 'Collect signatures from members present in session.' },
              { tab: 'report-search-listing', title: 'Generate reports', text: 'Download listings, statistics, and attendance reports.' },
            ].map((guide) => (
              <button
                key={guide.tab}
                type="button"
                onClick={() => {
                  closeDialog();
                  onNavigate(guide.tab);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left hover:border-primary"
              >
                <span>
                  <span className="block text-sm font-semibold text-primary">{guide.title}</span>
                  <span className="block text-xs text-text-muted">{guide.text}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-background p-3 text-xs text-text-muted">
            <p>
              Press <kbd className="rounded border border-border bg-white px-1">/</kbd> anywhere to search.
            </p>
            <p className="mt-1 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Technical support:{' '}
              <a href={`mailto:${LGU_PROFILE.email}`} className="font-semibold text-primary hover:underline">
                {LGU_PROFILE.email}
              </a>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'profile'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="relative max-w-md">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">SB</span>
            <div>
              <DialogTitle className="text-xl text-primary">SB Secretariat Admin</DialogTitle>
              <DialogDescription>Administrator</DialogDescription>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-border rounded-lg border border-border text-sm">
            {[
              ['Email', 'sb.admin@capas.gov.ph'],
              ['Office', 'Office of the Secretary to the Sanggunian'],
              ['Access level', 'Full module access'],
              ['Last sign-in', today],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-text-muted">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog('settings')}>
              Account Settings
            </Button>
            <Button onClick={closeDialog}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'settings'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="relative max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">Account Settings</DialogTitle>
            <DialogDescription>Change your password and notification preferences.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSave} className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold">Change password</h3>
            <Input
              type="password"
              placeholder="Current password"
              aria-label="Current password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
            />
            <Input
              type="password"
              placeholder="New password (at least 12 characters)"
              aria-label="New password"
              value={passwordForm.next}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, next: e.target.value }))}
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              aria-label="Confirm new password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
            />
            {passwordError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
                {passwordError}
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              Update password
            </Button>
          </form>
          <div className="mt-6 space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} className="h-4 w-4 accent-primary" />
              Email me about routing and signature requests
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={smsAlerts} onChange={(e) => setSmsAlerts(e.target.checked)} className="h-4 w-4 accent-primary" />
              Send SMS reminders before sessions
            </label>
            <Button
              variant="outline"
              className="mt-2"
              onClick={async () => {
                const confirmed = await confirmAction({
                  title: 'Save notification preferences?',
                  description: `Email alerts will be ${emailAlerts ? 'on' : 'off'} and SMS reminders will be ${smsAlerts ? 'on' : 'off'}.`,
                  confirmLabel: 'Save preferences',
                });
                if (!confirmed) return;
                toast(
                  'Notification preferences saved',
                  emailAlerts || smsAlerts
                    ? `You will get ${[emailAlerts && 'email', smsAlerts && 'SMS'].filter(Boolean).join(' and ')} alerts.`
                    : 'All email and SMS alerts are turned off.'
                );
              }}
            >
              Save preferences
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}