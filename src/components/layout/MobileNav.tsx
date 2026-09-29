import { Calendar, FileText, LayoutDashboard, Menu, PenLine, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onMoreClick: () => void;
}

// Most-used pages; everything else stays reachable through "More" (the slide-in sidebar).
const PRIMARY_ITEMS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'manage-legislation', label: 'Tracking', icon: FileText },
  { id: 'manage-transactions', label: 'Sessions', icon: Calendar },
  { id: 'esig-electronic-signature', label: 'E-Sign', icon: PenLine },
];

export function MobileNav({ activeTab, onNavigate, onMoreClick }: MobileNavProps) {
  const isMoreActive = !PRIMARY_ITEMS.some((item) => item.id === activeTab);

  const itemClassName = (active: boolean) =>
    cn(
      'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
      active ? 'text-primary' : 'text-text-muted hover:text-primary'
    );

  return (
    <nav
      className="shrink-0 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_-6px_rgba(10,15,61,0.15)] lg:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md">
        {PRIMARY_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={itemClassName(active)}
              aria-current={active ? 'page' : undefined}
            >
              {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" aria-hidden />}
              <Icon className="h-5 w-5" />
              {label}
            </button>
          );
        })}
        <button type="button" onClick={onMoreClick} className={itemClassName(isMoreActive)} aria-label="More pages">
          {isMoreActive && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" aria-hidden />}
          <Menu className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}
