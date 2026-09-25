import { useEffect, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_GROUPS } from '@/lib/navigation';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  /** Icon-only rail (desktop). */
  collapsed?: boolean;
  className?: string;
}

export function Sidebar({ activeTab, setActiveTab, onLogout, collapsed = false, className }: SidebarProps) {
  // Accordion: one group open at a time, starting with the group that holds the current page.
  const groupOf = (tab: string) => NAV_GROUPS.find((group) => group.items.some((item) => item.id === tab))?.id ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(() => groupOf(activeTab));
  // Rail tooltips are fixed-positioned so the scrolling nav can't clip them.
  const [hint, setHint] = useState<{ label: string; top: number; left: number } | null>(null);

  useEffect(() => {
    // Navigating (e.g. from search or a dashboard link) opens the page's group and closes the rest.
    const group = groupOf(activeTab);
    if (group && group !== 'overview') setOpenGroup(group);
  }, [activeTab]);

  useEffect(() => {
    if (!collapsed) setHint(null);
  }, [collapsed]);

  const showHint = (label: string) => (event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
    if (!collapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHint({ label, top: rect.top + rect.height / 2, left: rect.right + 14 });
  };
  const hideHint = () => setHint(null);

  return (
    <div className={cn('relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-[#18237f] via-[#0f1650] to-[#0a0f3d] text-white', className)}>
      {/* Soft light from above plus a hairline highlight on the top edge give the panel depth. */}
      <span className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden />
      {/* Gold accent along the edge that meets the content. */}
      <span className="pointer-events-none absolute inset-y-8 right-0 w-[2px] bg-gradient-to-b from-transparent via-[#d4a72c]/80 to-transparent" aria-hidden />

      <button
        type="button"
        onClick={() => setActiveTab('dashboard')}
        onMouseEnter={showHint('Sangguniang Bayan ng Capas')}
        onMouseLeave={hideHint}
        className={cn(
          'flex shrink-0 flex-col items-center border-b border-white/10 text-center',
          collapsed ? 'px-2 py-4' : 'gap-3 px-5 py-6'
        )}
        aria-label="Go to dashboard"
      >
        <img
          src="/capas-logo.jpg"
          alt="Seal of the Municipality of Capas"
          className={cn(
            'shrink-0 rounded-full object-cover ring-2 ring-[#d4a72c]/40 transition-all duration-200',
            collapsed ? 'h-11 w-11' : 'h-36 w-36'
          )}
        />
        {!collapsed ? (
          <div className="min-w-0">
            <div className="font-serif text-xl font-bold leading-tight text-balance">Sangguniang Bayan ng Capas</div>
            <div className="mt-1.5 text-sm text-white/60">Legislative Management System</div>
          </div>
        ) : null}
      </button>

      <nav className={cn('sidebar-scroll flex-1 overflow-y-auto py-4', collapsed ? 'px-2' : 'space-y-4 px-3')} aria-label="Main" onScroll={hideHint}>
        {NAV_GROUPS.map((group, groupIndex) => {
          const showHeader = group.id !== 'overview';
          // The rail shows every item; group headers there become dividers.
          const isClosed = !collapsed && showHeader && openGroup !== group.id;
          return (
            <div key={group.id}>
              {showHeader && collapsed && groupIndex > 0 ? <div className="mx-3 my-2 h-px bg-white/10" aria-hidden /> : null}
              {showHeader && !collapsed ? (
                <button
                  type="button"
                  onClick={() => setOpenGroup((prev) => (prev === group.id ? null : group.id))}
                  className={cn(
                    'mb-1 flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[13px] font-semibold uppercase tracking-[0.12em] transition-colors',
                    // The open group's title is highlighted in the sidebar's gold accent.
                    isClosed ? 'text-white/50 hover:text-white/80' : 'text-[#e8c766]'
                  )}
                  aria-expanded={!isClosed}
                >
                  {group.label}
                  <ChevronDown className={cn('h-4 w-4 transition-transform', isClosed && '-rotate-90')} />
                </button>
              ) : null}
              {!isClosed ? (
                <ul className="space-y-1" aria-label={collapsed ? group.label : undefined}>
                  {group.items.map((item) => {
                    const active = activeTab === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          onMouseEnter={showHint(item.label)}
                          onMouseLeave={hideHint}
                          onFocus={showHint(item.label)}
                          onBlur={hideHint}
                          aria-current={active ? 'page' : undefined}
                          aria-label={collapsed ? item.label : undefined}
                          className={cn(
                            'relative flex w-full items-center rounded-md text-left text-[15px] transition-colors',
                            collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2.5',
                            active ? 'bg-white/12 font-semibold text-white' : 'text-white/75 hover:bg-white/6 hover:text-white'
                          )}
                        >
                          {active ? <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-[#d4a72c]" aria-hidden /> : null}
                          <item.icon className={cn('h-5 w-5 shrink-0', active ? 'text-white' : 'text-white/60')} />
                          {!collapsed ? <span className="truncate">{item.label}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className={cn('shrink-0 border-t border-white/10', collapsed ? 'p-2' : 'p-3')}>
        <div className={cn('flex items-center rounded-lg bg-white/5', collapsed ? 'flex-col gap-2 p-2' : 'gap-3 p-3')}>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-primary"
            onMouseEnter={showHint('SB Secretariat Admin · Administrator')}
            onMouseLeave={hideHint}
          >
            SB
          </span>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">SB Secretariat Admin</div>
              <div className="truncate text-[11px] text-white/55">Administrator</div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onLogout}
            onMouseEnter={showHint('Sign out')}
            onMouseLeave={hideHint}
            className="rounded-md p-2 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
            title={collapsed ? undefined : 'Sign out'}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {collapsed && hint ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#111827] px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ top: hint.top, left: hint.left }}
        >
          {hint.label}
        </div>
      ) : null}
    </div>
  );
}
