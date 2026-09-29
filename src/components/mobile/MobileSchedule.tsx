import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CalendarCheck2, ChevronRight, Clock, MapPin, Plus } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { todayInManila } from '@/lib/session-files';
import { SESSION_TONE, formatLongDate } from '@/lib/sessions';
import { nowInManila } from '@/lib/esession-sync';
import { ScheduleSessionForm } from '@/components/esession/ScheduleSessionForm';
import { useMobile } from '@/components/mobile/mobile-context';
import { RsvpButtons, SessionCard, useMySessions } from '@/components/mobile/mobile-sessions';
import { BottomSheet, StatusChip, relativeDay, typeLabel } from '@/components/mobile/mobile-ui';
import { cn } from '@/lib/utils';

const greeting = (stamp: string) => {
  const hour = Number(stamp.slice(11, 13));
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
};

/** Home: the next session, replies still needed, and everything coming up. */
export function MobileSchedule() {
  const { account } = useMobile();
  const today = todayInManila();
  const mine = useMySessions();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const upcoming = mine.filter((entry) => entry.session.date >= today);
  const past = mine.filter((entry) => entry.session.date < today).reverse();
  const next = upcoming.find((entry) => entry.invited) ?? upcoming[0];
  const pending = upcoming.filter((entry) => entry.invited && entry.status === 'none');

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm text-text-muted">{greeting(nowInManila())},</p>
        <h1 className="text-xl font-bold leading-tight text-primary">{account.name}</h1>
        <p className="text-xs text-text-muted">{account.detail}</p>
      </section>

      {pending.length > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <BellRing className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            {pending.length === 1 ? '1 invitation needs your reply.' : `${pending.length} invitations need your reply.`}
          </p>
        </div>
      ) : null}

      {next ? (
        <section className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-border">
          <div className={cn('px-4 py-3', SESSION_TONE[next.session.type])}>
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide opacity-90">
              <span>Next · {typeLabel(next.session.type)}</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 normal-case">{relativeDay(today, next.session.date)}</span>
            </div>
            <h2 className="mt-1 text-lg font-bold leading-snug">{next.session.title}</h2>
          </div>
          <div className="space-y-1.5 px-4 pt-3 text-sm text-text-main">
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-primary" />
              {formatLongDate(next.session.date)} · {next.session.time}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              {next.session.location}
            </p>
          </div>
          <div className="px-4 pb-4 pt-3">
            {next.invited ? (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-text-muted">Will you attend?</p>
                  <StatusChip status={next.status} />
                </div>
                <RsvpButtons session={next.session} status={next.status} compact />
              </>
            ) : (
              <p className="text-xs text-text-muted">
                {next.confirmed} of {next.invitedCount} invited have confirmed.
              </p>
            )}
            <Link to={`/m/session/${next.session.id}`} className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-primary">
              Details and agenda
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : (
        <section className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center">
          <CalendarCheck2 className="h-10 w-10 text-primary/40" />
          <p className="mt-3 text-sm font-semibold text-text-main">No upcoming sessions</p>
          <p className="mt-1 text-xs text-text-muted">You will be notified here when you are invited to a session or hearing.</p>
        </section>
      )}

      {upcoming.length > 1 ? (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Coming up</h2>
          <div className="space-y-2">
            {upcoming
              .filter((entry) => entry !== next)
              .map((entry) => (
                <SessionCard key={entry.session.id} entry={entry} />
              ))}
          </div>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section>
          <button type="button" onClick={() => setShowPast((prev) => !prev)} className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted" aria-expanded={showPast}>
            Past sessions ({past.length}) {showPast ? '▴' : '▾'}
          </button>
          {showPast ? (
            <div className="space-y-2">
              {past.map((entry) => (
                <SessionCard key={entry.session.id} entry={entry} muted />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {account.canManage ? (
        <>
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-[max(1rem,calc(50vw-14rem+1rem))] z-20 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-lg shadow-primary/30 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            Schedule
          </button>
          <BottomSheet open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule session">
            <ScheduleSessionForm
              touch
              scheduledBy={account.name}
              onCancel={() => setScheduleOpen(false)}
              onScheduled={(session) => {
                setScheduleOpen(false);
                toast('Session scheduled', `${session.title} · invitees were notified.`);
              }}
            />
          </BottomSheet>
        </>
      ) : null}
    </div>
  );
}
