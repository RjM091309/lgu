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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { User, Settings, LogOut, Search, Menu, X } from 'lucide-react';
import { mockBills, mockMembers, mockSessions } from '@/lib/mock-data';

export function Navbar({ 
  onMenuClick, 
  isLoggedIn, 
  onLogout, 
  onLogin,
  onNavigateFromSearch,
}: { 
  onMenuClick?: () => void;
  isLoggedIn: boolean;
  onLogout: () => void;
  onLogin: () => void;
  onNavigateFromSearch: (tab: string) => void;
}) {
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSuggestedExpanded, setIsSuggestedExpanded] = useState(false);
  const searchBoxRef = React.useRef<HTMLDivElement>(null);

  const searchTargets = useMemo(
    () => [
      { tab: 'dashboard', keywords: ['dashboard', 'overview', 'home'] },
      { tab: 'manage-legislation', keywords: ['legislation', 'legislative', 'tracking', 'bills'] },
      { tab: 'manage-master-files', keywords: ['master', 'files', 'members', 'listings'] },
      { tab: 'manage-transactions', keywords: ['transaction', 'operations', 'session'] },
      { tab: 'access-users', keywords: ['access', 'user', 'users'] },
      { tab: 'access-roles', keywords: ['role', 'roles', 'permissions'] },
      { tab: 'access-control-panel', keywords: ['control', 'panel', 'security', 'settings'] },
      { tab: 'report-search-listing', keywords: ['report', 'reports', 'search', 'listing'] },
      { tab: 'report-statistical-performance', keywords: ['statistics', 'statistical', 'performance'] },
      { tab: 'report-attendance-publication', keywords: ['attendance', 'publication'] },
      { tab: 'archive', keywords: ['archive', 'archives'] },
      { tab: 'req-core-modules', keywords: ['requirements', 'core', 'modules'] },
      { tab: 'req-public-inquiry', keywords: ['public', 'inquiry'] },
      { tab: 'req-reports-analytics', keywords: ['analytics', 'report analytics'] },
      { tab: 'req-e-session-signature', keywords: ['e-session', 'esig', 'signature'] },
      { tab: 'esig-platform', keywords: ['platform', 'e-session platform'] },
      { tab: 'esig-electronic-signature', keywords: ['electronic signature', 'digital signature'] },
      { tab: 'esig-session-files', keywords: ['session files', 'attachments'] },
    ],
    []
  );

  const searchEntries = useMemo(
    () => {
      const sessionFileEntries = [
        'Regular Session Agenda - Week 16.pdf',
        'Plenary Recording - Week 16.mp4',
        'Plenary Highlights - April 2024.mp4',
        'Session Minutes Draft.docx',
      ];

      return [
      ...searchTargets.map((target) => ({
        id: `menu-${target.tab}`,
        label: target.keywords[0],
        tab: target.tab,
        keywords: target.keywords,
        group: 'Menu',
      })),
      ...mockBills.map((bill) => ({
        id: `bill-${bill.id}`,
        label: `${bill.number} - ${bill.title}`,
        tab: 'manage-legislation',
        keywords: [bill.number, bill.title, bill.author, bill.category],
        group: 'Legislative Data',
      })),
      ...mockMembers.map((member) => ({
        id: `member-${member.id}`,
        label: `${member.name} (${member.role})`,
        tab: 'manage-master-files',
        keywords: [member.name, member.role, member.party, member.district],
        group: 'Member Data',
      })),
      ...mockSessions.map((session) => ({
        id: `session-${session.id}`,
        label: `${session.title} (${session.date})`,
        tab: 'manage-transactions',
        keywords: [session.title, session.type, session.location, session.date],
        group: 'Session Data',
      })),
      {
        id: 'access-users-data',
        label: 'Access Users',
        tab: 'access-users',
        keywords: ['users', 'maria santos', 'robert chen', 'elena rodriguez'],
        group: 'Access Data',
      },
      {
        id: 'access-roles-data',
        label: 'Access Roles',
        tab: 'access-roles',
        keywords: ['roles', 'administrator', 'records officer', 'committee staff'],
        group: 'Access Data',
      },
      ...sessionFileEntries.map((fileName, index) => ({
        id: `session-file-${index}`,
        label: fileName,
        tab: 'esig-session-files',
        keywords: [fileName, 'session file', 'attachment', 'e-session'],
        group: 'Session File',
      })),
      ];
    },
    [searchTargets]
  );

  const suggestedSearches = useMemo(
    () => ['users', 'roles', 'control panel', 'legislation', 'reports', 'archive'],
    []
  );

  const matchesSearchQuery = (query: string, values: string[]) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return false;

    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const haystack = values.join(' ').toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  };

  const searchResults = useMemo(() => {
    const query = searchKeyword.trim();
    if (!query) return [];

    const entries = searchEntries.filter((entry) => matchesSearchQuery(query, [entry.label, ...entry.keywords]));
    return entries.slice(0, 20);
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
      if (!searchBoxRef.current?.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const findTargetTab = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) return null;
    return (
      searchEntries.find((entry) =>
        matchesSearchQuery(query, [entry.label, ...entry.keywords])
      ) ?? null
    );
  };

  const navigateByQuery = (query: string) => {
    const match = findTargetTab(query);
    if (!match) return;
    saveRecentSearch(query);
    onNavigateFromSearch(match.tab);
    setIsSearchOpen(false);
  };

  const handleGlobalSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchKeyword.trim()) return;
    navigateByQuery(searchKeyword);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin();
    setShowLoginDialog(false);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-surface h-16">
      <div className="flex h-full w-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          <div ref={searchBoxRef} className="relative w-[360px] hidden md:block">
            <form className="relative" onSubmit={handleGlobalSearchSubmit}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                value={searchKeyword}
                onFocus={() => setIsSearchOpen(true)}
                onClick={() => setIsSearchOpen(true)}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="General search: modules, pages, users, reports..."
                className="w-full bg-[#eee] border-none rounded-[4px] py-2 pl-10 pr-9 text-[13px] text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
              {searchKeyword ? (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-[#3d5d95] hover:bg-black/5"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </form>

            {isSearchOpen ? (
              <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-md border border-border bg-white p-2 shadow-lg">
                {recentSearches.length > 0 ? (
                  <div className="mb-2 border-b border-border pb-2">
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Recent Searches</p>
                    <div className="space-y-1">
                      {recentSearches.slice(0, 5).map((recent) => (
                        <button
                          key={recent}
                          type="button"
                          className="w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm hover:bg-muted truncate"
                          onClick={() => {
                            setSearchKeyword(recent);
                            navigateByQuery(recent);
                          }}
                          title={recent}
                        >
                          {recent}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className={searchKeyword.trim() ? 'mb-2 border-b border-border pb-2' : 'mb-1'}>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted hover:bg-muted"
                    onClick={() => setIsSuggestedExpanded((prev) => !prev)}
                  >
                    <span>Suggested Searches</span>
                    <span>{isSuggestedExpanded ? 'Hide' : 'Show'}</span>
                  </button>
                  {isSuggestedExpanded ? (
                    <div className="mt-1 space-y-1">
                      {suggestedSearches.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm hover:bg-muted truncate"
                          onClick={() => {
                            setSearchKeyword(suggestion);
                            navigateByQuery(suggestion);
                          }}
                          title={suggestion}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {searchKeyword.trim() ? (
                  <div>
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Results</p>
                    {searchResults.length > 0 ? (
                      <div className="space-y-1">
                        {searchResults.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                            onClick={() => {
                              setSearchKeyword(entry.label);
                              navigateByQuery(entry.label);
                            }}
                            title={entry.label}
                          >
                            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                            <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] leading-none text-text-muted">
                              {entry.group}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="px-2 py-1.5 text-sm text-text-muted">No matching results.</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-[12px] text-text-muted font-medium">
            <span className="cursor-pointer hover:text-primary transition-colors">Help Desk</span>
            <div className="w-px h-5 bg-border"></div>
          </div>

          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src="https://i.pravatar.cc/150?u=admin" alt="Admin" />
                      <AvatarFallback>AD</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">Admin User</p>
                      <p className="text-xs leading-none text-muted-foreground">admin@olmis.gov</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="sm" onClick={onLogout} className="h-9">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          ) : (
            <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
              <DialogTrigger asChild>
                <button className="bg-primary text-white border-none px-5 py-2 rounded-[4px] text-[13px] font-semibold cursor-pointer hover:bg-primary-light transition-colors">
                  Sign In to Portal
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold">Login to OLMIS</DialogTitle>
                  <DialogDescription>
                    Enter your credentials to access the legislative management system.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleLoginSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Email Address
                    </label>
                    <Input placeholder="name@example.com" type="email" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Password
                    </label>
                    <Input type="password" required />
                  </div>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary-light">
                    Sign In
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </nav>
  );
}
