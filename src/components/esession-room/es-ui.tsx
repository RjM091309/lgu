import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Moon, ShieldAlert, Sun, Video } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { SESSION_TONE } from '@/lib/sessions';
import type { MobileAccount } from '@/lib/mobile-accounts';
import type { Session } from '@/lib/mock-data';
import { fetchServerInfo, secureUrlFor, useLobby, type RoomRole } from '@/lib/esession-room';

// Pieces shared by the E-Session screens (/es).

export const ROLE_BADGE: Record<RoomRole, string> = {
  host: 'bg-primary/10 text-primary ring-primary/20',
  presiding: 'bg-[#fdf6e3] text-[#8a6a12] ring-[#d4a72c]/40',
  participant: 'bg-muted text-text-muted ring-border',
};

export function RoleBadge({ role, label, className }: { role: RoomRole; label: string; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', ROLE_BADGE[role], className)}>{label}</span>;
}

export function TypeBadge({ type, className }: { type: Session['type']; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold', SESSION_TONE[type], className)}>{type}</span>;
}

/** LIVE (with how long, when `since` is given), or "On hold" while nobody is in the call. */
export function LiveBadge({ since, onHold = false, className }: { since?: number | null; onHold?: boolean; className?: string }) {
  const now = useNow(since && !onHold ? 1000 : null);
  if (onHold) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-300', className)}>
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
        On hold
      </span>
    );
  }
  // Always red with a white dot, in either theme (data-fixed-dark keeps dark mode from darkening the dot).
  return (
    <span data-fixed-dark className={cn('inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white', className)}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:hidden" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
      </span>
      Live{since ? ` · ${elapsedShort(now - since)}` : ''}
    </span>
  );
}

const elapsedShort = (ms: number) => {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

/** Re-renders every `intervalMs` (null: never) and returns the current time. */
export function useNow(intervalMs: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!intervalMs) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Initials in a circle: gold for members of the body, navy for staff. */
export function PersonAvatar({ abbr, group, className }: { abbr: string; group: 'member' | 'staff'; className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold',
        group === 'member' ? 'bg-[#d4a72c] text-[#141b66]' : 'bg-[#283593] text-white',
        className ?? 'h-9 w-9 text-[11px]'
      )}
      aria-hidden
    >
      {abbr}
    </span>
  );
}

export function EsHeader({ account, onSignOut, children }: { account: MobileAccount; onSignOut: () => void; children?: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { status } = useLobby();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-[#141b66] to-[#1a237e] text-white shadow-md theme-chrome">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:px-8">
        <button type="button" onClick={() => navigate('/es')} className="flex min-w-0 items-center gap-3 text-left">
          <img src="/lims-logo.svg" alt="" className="h-10 w-10 shrink-0" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-bold leading-tight tracking-wide">
              LIMS <span className="rounded bg-white/15 px-1.5 py-px text-[11px] font-semibold text-[#f1d27a]">E-Session</span>
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-white/70">
              <span className={cn('h-1.5 w-1.5 rounded-full', status === 'live' ? 'bg-green-400' : status === 'connecting' ? 'bg-amber-300' : 'bg-white/40')} aria-hidden />
              {status === 'live' ? 'Connected to LIMS' : status === 'connecting' ? 'Connecting…' : 'Reconnecting to LIMS…'}
            </span>
          </span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          {children}
          <button
            type="button"
            onClick={toggle}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5 text-[#e8c766]" /> : <Moon className="h-5 w-5 text-white/70" />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex h-11 items-center gap-2 rounded-full pl-1 pr-2 hover:bg-white/10" aria-label="Account">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[11px] font-bold text-primary ring-2 ring-[#d4a72c]">{account.abbr}</span>
                <span className="hidden max-w-40 truncate text-sm font-semibold md:block">{account.name}</span>
                <ChevronDown className="h-4 w-4 text-white/70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 text-text-main">
              <DropdownMenuLabel>
                <span className="block truncate">{account.name}</span>
                <span className="block truncate text-xs font-normal text-text-muted">{account.canManage ? 'Administrator · hosts e-sessions' : account.detail}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="h-10 gap-2 text-[#c62828]">
                <LogOut className="h-4 w-4" />
                Sign out of E-Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 px-4 md:px-8" aria-label="E-Session">
        {[
          { to: '/es', label: 'Sessions', end: true },
          { to: '/es/history', label: 'History' },
        ].map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn('relative px-4 py-3 text-sm font-semibold transition-colors', isActive ? 'text-white after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t after:bg-[#d4a72c]' : 'text-white/65 hover:text-white')
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

/** Shown on http addresses other than localhost, where browsers block the camera and microphone. */
export function InsecureNotice({ className }: { className?: string }) {
  const [secureUrl, setSecureUrl] = useState<string | null>(null);
  useEffect(() => {
    if (window.isSecureContext) return;
    void fetchServerInfo().then((info) => setSecureUrl(secureUrlFor(info.httpsPort)));
  }, []);
  if (window.isSecureContext) return null;
  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center', className)} role="alert">
      <ShieldAlert className="h-6 w-6 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Camera and microphone are blocked on this address</p>
        <p className="mt-0.5 text-amber-800">
          Browsers only allow them on a secure (https) page. Open the secure address of this LIMS server; you may need to accept its certificate once, and sign in again there.
        </p>
      </div>
      {secureUrl ? (
        <a href={secureUrl} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:opacity-90">
          <Video className="h-4 w-4" />
          Open secure address
        </a>
      ) : null}
    </div>
  );
}
