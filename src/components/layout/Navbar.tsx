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
import {
  Bell,
  BellOff,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  History,
  KeyRound,
  LogOut,
  Mail,
  Menu,
  PenLine,
  Search,
  Settings,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { LGU_PROFILE, mockBills, mockMembers, mockSessions } from '@/lib/mock-data';
import { NAV_GROUPS, findNavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { logActivity } from '@/lib/activity-log';
import { ADMIN_ROLE, ALL_PAGES, canOpenPage, initials, useAccess } from '@/lib/access-store';

interface NavbarProps {
  activeTab: string;
  onMenuClick: () => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

type NotificationKind = 'committee' | 'signature' | 'agenda' | 'account';

const NOTIFICATION_KIND: Record<NotificationKind, { icon: typeof Bell; tile: string; label: string }> = {
  committee: { icon: ClipboardList, tile: 'bg-amber-50 text-amber-700 ring-amber-200', label: 'Legislative Tracking' },
  signature: { icon: PenLine, tile: 'bg-violet-50 text-violet-700 ring-violet-200', label: 'E-Signature' },
  agenda: { icon: CalendarDays, tile: 'bg-sky-50 text-sky-700 ring-sky-200', label: 'Sessions' },
  account: { icon: UserPlus, tile: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'Administration' },
};

interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  time: string;
  day: 'Today' | 'Earlier';
  tab: string;
  unread: boolean;
}

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    kind: 'committee',
    title: 'Committee report due',
    body: 'Committee on Transportation report on Prop. Ord. No. 2026-P-012 is due this week.',
    time: '2 hours ago',
    day: 'Today',
    tab: 'manage-legislation',
    unread: true,
  },
  {
    id: 'n2',
    kind: 'signature',
    title: 'Signature requested',
    body: 'Mun. Ord. No. 2026-007 is awaiting electronic signatures.',
    time: '5 hours ago',
    day: 'Today',
    tab: 'esig-electronic-signature',
    unread: true,
  },
  {
    id: 'n3',
    kind: 'agenda',
    title: 'Agenda ready for review',
    body: 'The order of business for the 38th Regular Session is ready.',
    time: 'Yesterday',
    day: 'Earlier',
    tab: 'manage-transactions',
    unread: true,
  },
  {
    id: 'n4',
    kind: 'account',
    title: 'Account request',
    body: 'A new committee staff account is pending approval.',
    time: '2 days ago',
    day: 'Earlier',
    tab: 'access-users',
    unread: false,
  },
];

export function Navbar({ activeTab, onMenuClick, onLogout, onNavigate }: NavbarProps) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all');
  const [dialog, setDialog] = useState<'help' | 'profile' | 'settings' | null>(null);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const searchBoxRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const current = findNavItem(activeTab);
  const { user, role } = useAccess();
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
        tab: 'esig-calendar-sessions',
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
    // Only results that lead to a page the signed-in role can open.
    return searchEntries
      .filter((entry) => canOpenPage(role, entry.tab) && matchesSearchQuery(searchKeyword, [entry.label, ...entry.keywords]))
      .slice(0, 12);
  }, [searchKeyword, searchEntries, role]);

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

  const dismissNotification = (id: string) => setNotifications((prev) => prev.filter((item) => item.id !== id));

  const visibleNotifications = notifications.filter((item) => notificationFilter === 'all' || item.unread);
  const notificationGroups = (['Today', 'Earlier'] as const)
    .map((day) => ({ day, items: visibleNotifications.filter((item) => item.day === day) }))
    .filter((group) => group.items.length > 0);

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
    // A floating navy panel that matches the sidebar: same gradient, rounded edge, inner ring and layered shadow.
    <header className="sticky top-0 z-40 w-full bg-background px-2 pt-2 sm:px-3 sm:pt-3 lg:pl-0 lg:pr-4 lg:pt-4">
      <div className="relative flex h-16 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#18237f] via-[#0f1650] to-[#0a0f3d] px-3 ring-1 ring-inset ring-white/10 shadow-[0_1px_2px_rgba(10,15,61,0.30),0_6px_12px_-2px_rgba(10,15,61,0.22),0_18px_36px_-8px_rgba(10,15,61,0.35)] sm:gap-3 sm:px-4 md:px-6">
        {/* Hairline highlight on the top edge and the sidebar's gold accent along the edge that meets the content. */}
        <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden />
        <span className="pointer-events-none absolute inset-x-8 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[#d4a72c]/80 to-transparent" aria-hidden />
        <Button variant="ghost" size="icon" className="shrink-0 text-white hover:bg-white/10 lg:hidden" onClick={onMenuClick} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>

        {/* Dashboard is the home page, so it roots the trail; every crumb navigates. */}
        <nav aria-label="Breadcrumb" className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-sm xl:flex">
          {(() => {
            const crumbs: { label: string; tab: string }[] = [{ label: 'Dashboard', tab: 'dashboard' }];
            if (current && current.item.id !== 'dashboard') {
              if (current.group.id !== 'overview') crumbs.push({ label: current.group.label, tab: current.group.items[0].id });
              crumbs.push({ label: current.item.label, tab: current.item.id });
            }
            return crumbs.map((crumb, index) => {
              const isCurrent = index === crumbs.length - 1;
              return (
                <span key={crumb.label} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/40" /> : null}
                  <button
                    type="button"
                    onClick={() => onNavigate(crumb.tab)}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={cn(
                      'truncate rounded px-1 py-0.5 transition-colors hover:bg-white/10 hover:text-white',
                      isCurrent ? 'font-semibold text-[#e8c766]' : 'text-white/65'
                    )}
                    title={!isCurrent && index === 1 && crumbs.length === 3 ? `Go to ${current?.group.items[0].label}` : undefined}
                  >
                    {crumb.label}
                  </button>
                </span>
              );
            });
          })()}
        </nav>

        <div ref={searchBoxRef} className="relative ml-auto min-w-0 flex-1 sm:max-w-sm">
          <form onSubmit={handleGlobalSearchSubmit} role="search">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchKeyword}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setIsSearchOpen(true);
              }}
              placeholder="Search pages, records..."
              aria-label="Search"
              className="h-10 w-full rounded-lg border border-white/15 bg-white/10 pl-9 pr-16 text-[13px] text-white outline-none placeholder:text-white/50 focus:border-white/40 focus:bg-white/15 focus:ring-2 focus:ring-white/15"
            />
            {searchKeyword ? (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-white/20 bg-white/10 px-1.5 text-[11px] text-white/70 sm:block">
                /
              </kbd>
            )}
          </form>

          {isSearchOpen ? (
            <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-lg border border-border bg-white p-2 shadow-xl max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.75rem] max-sm:w-auto">
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

        <span className="hidden whitespace-nowrap text-xs text-white/60 2xl:inline">{today}</span>

        <Button variant="ghost" size="icon" className="hidden hover:bg-white/10 sm:inline-flex" onClick={() => setDialog('help')} aria-label="Help" title="Help">
          <CircleHelp className="h-5 w-5 text-white/70" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative shrink-0 hover:bg-white/10" aria-label={`Notifications (${unreadCount} unread)`} title="Notifications">
              <Bell className={cn('h-5 w-5', unreadCount > 0 ? 'bell-ring text-[#e8c766]' : 'text-white/70')} />
              {unreadCount > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-[#0f1650]">
                  {unreadCount}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[380px] overflow-hidden rounded-xl p-0 shadow-xl max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.75rem] max-sm:w-auto"
          >
            <div className="px-4 pb-3 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-text-main">Notifications</span>
                  {unreadCount > 0 ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{unreadCount} new</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setNotifications((prev) => prev.map((item) => ({ ...item, unread: false })))}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-primary hover:bg-primary/5 disabled:text-text-muted disabled:hover:bg-transparent"
                  disabled={unreadCount === 0}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all as read
                </button>
              </div>
              <div className="mt-3 inline-flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Filter notifications">
                {(['all', 'unread'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    role="tab"
                    aria-selected={notificationFilter === filter}
                    onClick={() => setNotificationFilter(filter)}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                      notificationFilter === filter ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
                    )}
                  >
                    {filter === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[min(420px,calc(100vh-14rem))] overflow-y-auto border-t border-border">
              {notificationGroups.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-text-muted">
                    <BellOff className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-semibold text-text-main">{notifications.length === 0 ? 'No notifications' : "You're all caught up"}</p>
                  <p className="text-xs text-text-muted">New updates on measures, sessions, and signatures will show here.</p>
                </div>
              ) : (
                notificationGroups.map((group) => (
                  <div key={group.day}>
                    <p className="sticky top-0 z-10 bg-white/95 px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted backdrop-blur">
                      {group.day}
                    </p>
                    <ul className="space-y-1 px-2 pb-2">
                      {group.items.map((item) => {
                        const kind = NOTIFICATION_KIND[item.kind];
                        return (
                          <li key={item.id} className="group relative">
                            <DropdownMenuItem
                              onClick={() => openNotification(item.id, item.tab)}
                              className={cn('items-start gap-3 rounded-lg px-2.5 py-2.5 pr-9', item.unread ? 'bg-primary/[0.04] hover:bg-primary/[0.07]' : 'hover:bg-muted')}
                            >
                              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', kind.tile)}>
                                <kind.icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className={cn('truncate text-sm', item.unread ? 'font-semibold text-text-main' : 'font-medium text-text-main/80')}>{item.title}</span>
                                  {item.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                                </span>
                                <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-text-muted">{item.body}</span>
                                <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                                  <span>{item.time}</span>
                                  <span aria-hidden>·</span>
                                  <span>{kind.label}</span>
                                </span>
                              </span>
                            </DropdownMenuItem>
                            <button
                              type="button"
                              onClick={() => dismissNotification(item.id)}
                              className="absolute right-2 top-2.5 rounded-md p-1 text-text-muted opacity-0 transition-opacity hover:bg-white hover:text-text-main focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                              aria-label={`Dismiss: ${item.title}`}
                              title="Dismiss"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="grid grid-cols-2 border-t border-border bg-muted/40 text-xs font-semibold">
              <DropdownMenuItem onClick={() => onNavigate('activity-log')} className="justify-center gap-1.5 rounded-none py-2.5 text-xs text-text-muted hover:bg-muted hover:text-text-main">
                <History className="h-3.5 w-3.5" />
                Activity log
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDialog('settings')}
                className="justify-center gap-1.5 rounded-none border-l border-border py-2.5 text-xs text-text-muted hover:bg-muted hover:text-text-main"
              >
                <Settings className="h-3.5 w-3.5" />
                Notification settings
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex shrink-0 items-center gap-2 rounded-lg p-1 hover:bg-white/10 xl:pr-2" aria-label="Account menu">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-bold text-primary ring-2 ring-[#d4a72c]/40">{initials(user.name)}</span>
              <span className="hidden whitespace-nowrap text-left leading-tight xl:block">
                <span className="block text-[13px] font-semibold text-white">{user.name}</span>
                <span className="block text-[11px] text-white/55">{user.role}</span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-white/60 xl:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="end">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-text-muted">{user.email}</p>
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
            <DialogDescription>Quick guide to the Legislative Information Management System.</DialogDescription>
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
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">{initials(user.name)}</span>
            <div>
              <DialogTitle className="text-xl text-primary">{user.name}</DialogTitle>
              <DialogDescription>{user.role}</DialogDescription>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-border rounded-lg border border-border text-sm">
            {[
              ['Email', user.email],
              ['Office', user.office],
              ['Access level', user.role === ADMIN_ROLE ? 'Full access' : `${role?.pages.length ?? 0} of ${ALL_PAGES.length} pages`],
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