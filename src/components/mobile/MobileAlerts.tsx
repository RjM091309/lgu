import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellOff, BellRing, CalendarPlus, ChevronRight, Megaphone } from 'lucide-react';
import { nowInManila, useCalendarSessions } from '@/lib/esession-sync';
import { useMobile } from '@/components/mobile/mobile-context';
import { noticeText, timeAgo } from '@/components/mobile/mobile-ui';
import { cn } from '@/lib/utils';

const canAskForNotifications = () => typeof Notification !== 'undefined' && window.isSecureContext && Notification.permission === 'default';

/** Newly scheduled sessions and attendance reminders for the signed-in account. */
export function MobileAlerts() {
  const { notices, unseenIds, markNoticesSeen } = useMobile();
  const sessions = useCalendarSessions();
  const now = nowInManila();
  // Remember which were new when the tab opened, so they stay highlighted while being read.
  const [unseenOnOpen] = useState(() => new Set(unseenIds));
  const [askPermission, setAskPermission] = useState(canAskForNotifications);

  useEffect(() => {
    markNoticesSeen();
  }, [markNoticesSeen]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-primary">Alerts</h1>

      {askPermission ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
          <BellRing className="h-5 w-5 shrink-0 text-primary" />
          <p className="flex-1 text-xs text-text-main">Get a phone notification when a session is scheduled or a reminder is sent.</p>
          <button
            type="button"
            onClick={() => void Notification.requestPermission().finally(() => setAskPermission(false))}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white"
          >
            Allow
          </button>
        </div>
      ) : null}

      {notices.length ? (
        <ul className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-border">
          {notices.map((notice) => {
            const session = sessions.find((entry) => entry.id === notice.sessionId);
            const { heading, body } = noticeText(notice, session?.title ?? 'A session');
            const Icon = notice.kind === 'reminder' ? BellRing : notice.kind === 'announcement' ? Megaphone : CalendarPlus;
            return (
              <li key={notice.id} className="border-b border-border last:border-b-0">
                <Link to={session ? `/m/session/${session.id}` : '/m'} className={cn('flex items-start gap-3 px-4 py-3 active:bg-muted', unseenOnOpen.has(notice.id) && 'bg-primary/[0.03]')}>
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', notice.kind === 'reminder' ? 'bg-amber-100 text-amber-800' : notice.kind === 'announcement' ? 'bg-red-50 text-red-700' : 'bg-primary/10 text-primary')}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-text-main">{heading}</span>
                    <span className="block text-xs text-text-muted">{body}</span>
                    <span className="mt-0.5 block text-[11px] text-text-muted">{timeAgo(now, notice.at)}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 self-center text-text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <BellOff className="h-10 w-10 text-primary/30" />
          <p className="mt-3 text-sm font-semibold text-text-main">No alerts yet</p>
          <p className="mt-1 text-xs text-text-muted">New sessions you are invited to and reminders from the Secretariat appear here.</p>
        </div>
      )}
    </div>
  );
}
