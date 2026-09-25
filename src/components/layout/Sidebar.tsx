import { useEffect, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_GROUPS } from '@/lib/navigation';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  className?: string;
}

export function Sidebar({ activeTab, setActiveTab, onLogout, className }: SidebarProps) {
  // Groups start closed; only the group holding the current page opens.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((group) => [group.id, !group.items.some((item) => item.id === activeTab)]))
  );

  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((group) => group.items.some((item) => item.id === activeTab));
    if (activeGroup) setCollapsed((prev) => (prev[activeGroup.id] ? { ...prev, [activeGroup.id]: false } : prev));
  }, [activeTab]);

  return (
    <div className={cn('flex h-full flex-col bg-[#0f1650] text-white', className)}>

      <button
        type="button"
        onClick={() => setActiveTab('dashboard')}
        className="flex shrink-0 flex-col items-center gap-3 border-b border-white/10 px-5 py-6 text-center"
      >
        <img src="/capas-logo.jpg" alt="Seal of the Municipality of Capas" className="h-40 w-40 shrink-0 rounded-full object-cover ring-2 ring-white/20" />
        <div className="min-w-0">
          <div className="font-serif text-xl font-bold leading-tight text-balance">Sangguniang Bayan ng Capas</div>
          <div className="mt-1.5 text-sm text-white/60">Legislative Management System</div>
        </div>
      </button>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Main">
        {NAV_GROUPS.map((group) => {
          const showHeader = group.id !== 'overview';
          // A group without a header has no toggle, so it must always stay open (keeps Dashboard visible).
          const isCollapsed = showHeader && collapsed[group.id];
          return (
            <div key={group.id}>
              {showHeader ? (
                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                  className="mb-1 flex w-full items-center justify-between px-3 py-1.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/50 hover:text-white/80"
                  aria-expanded={!isCollapsed}
                >
                  {group.label}
                  <ChevronDown className={cn('h-4 w-4 transition-transform', isCollapsed && '-rotate-90')} />
                </button>
              ) : null}
              {!isCollapsed ? (
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const active = activeTab === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[15px] transition-colors',
                            active ? 'bg-white/12 font-semibold text-white' : 'text-white/75 hover:bg-white/6 hover:text-white'
                          )}
                        >
                          {active ? <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-white" aria-hidden /> : null}
                          <item.icon className={cn('h-5 w-5 shrink-0', active ? 'text-white' : 'text-white/60')} />
                          <span className="truncate">{item.label}</span>
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

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-primary">SB</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">SB Secretariat Admin</div>
            <div className="truncate text-[11px] text-white/55">Administrator</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md p-2 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
