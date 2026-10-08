import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BellRing, CalendarPlus, Clock, FileText, MapPin, Pencil, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { useUsers } from '@/lib/access-store';
import { QUORUM, committeeNameOf, inviteesFor, rsvpOf, useAttendance } from '@/lib/attendance';
import { CHANGE_REFUSED, canChangeSession, cancelScheduledSession, nowInManila, sendReminder, useCalendarSessions, useStartedSessions } from '@/lib/esession-sync';
import { SESSION_TONE, addSessionToCalendar, buildAgenda, formatLongDate } from '@/lib/sessions';
import { useHolidays } from '@/lib/holidays';
import { todayInManila } from '@/lib/session-files';
import { useMobile } from '@/components/mobile/mobile-context';
import { RsvpButtons } from '@/components/mobile/mobile-sessions';
import { BottomSheet, StatusChip, relativeDay, typeLabel, type MyStatus } from '@/components/mobile/mobile-ui';
import { ScheduleSessionForm } from '@/components/esession/ScheduleSessionForm';
import { cn } from '@/lib/utils';
import { isNativeApp } from '@/lib/native';

type Filter = 'all' | MyStatus;

/** One session: when and where, the account's reply, the agenda, and (for the Administrator) everyone's replies. */
export function MobileSessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { account } = useMobile();
  const sessions = useCalendarSessions();
  const users = useUsers();
  const attendance = useAttendance();
  const today = todayInManila();
  const session = sessions.find((entry) => entry.id === id);
  const { byDate: holidaysByDate } = useHolidays(Number((session?.date ?? today).slice(0, 4)));
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [editOpen, setEditOpen] = useState(false);
  const started = useStartedSessions();

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/m'));

  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
        <p className="text-base font-semibold text-text-main">This session is no longer on the calendar.</p>
        <p className="mt-1 text-sm text-text-muted">It may have been cancelled by the Secretariat.</p>
        <Link to="/m" className="mt-5 text-sm font-semibold text-primary">
          Back to my schedule
        </Link>
      </div>
    );
  }

  const invitees = inviteesFor(session, users);
  const invited = invitees.some((invitee) => invitee.id === account.inviteeId);
  const statusOf = (inviteeId: string): MyStatus => rsvpOf(attendance, session.id, inviteeId)?.status ?? 'none';
  const myStatus = statusOf(account.inviteeId);
  const myReply = rsvpOf(attendance, session.id, account.inviteeId);
  const holiday = holidaysByDate.get(session.date);
  const isPast = session.date < today;

  // A direct link to a session one is not invited to shows only the public details.
  const canSee = invited || account.canManage;
  const counts = {
    attending: invitees.filter((invitee) => statusOf(invitee.id) === 'attending').length,
    declined: invitees.filter((invitee) => statusOf(invitee.id) === 'declined').length,
    none: invitees.filter((invitee) => statusOf(invitee.id) === 'none').length,
  };
  const membersAttending = invitees.filter((invitee) => invitee.group === 'member' && statusOf(invitee.id) === 'attending').length;
  const visible = invitees.filter((invitee) => filter === 'all' || statusOf(invitee.id) === filter);

  const remind = () => {
    const pending = invitees.filter((invitee) => statusOf(invitee.id) === 'none');
    if (!pending.length) return toast('No reminders needed', 'Everyone invited has already replied.', 'info');
    sendReminder(session.id, pending.map((invitee) => invitee.id), account.name, nowInManila());
    toast('Reminders sent', `${pending.length} invitee(s) were reminded to reply.`);
  };

  const cancel = async () => {
    const confirmed = await confirmAction({
      title: `Cancel ${session.title}?`,
      description: 'It is removed from the calendar of everyone invited, together with their replies.',
      confirmLabel: 'Cancel session',
      cancelLabel: 'Keep',
      tone: 'destructive',
    });
    if (!confirmed) return;
    if (!(await cancelScheduledSession(session.id))) return toast('Not cancelled', `${session.title}: ${CHANGE_REFUSED}`, 'error');
    toast('Session cancelled', `${session.title} was removed from the calendar.`);
    navigate('/m', { replace: true });
  };

  return (
    <div className="pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className={cn('px-4 pb-5 pt-[calc(0.75rem+env(safe-area-inset-top))]', SESSION_TONE[session.type])}>
        <button type="button" onClick={goBack} className="-ml-2 flex items-center gap-1 rounded-full px-2 py-1.5 text-sm font-semibold opacity-90 active:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide opacity-90">
          <span>{typeLabel(session.type)}</span>
          <span className="rounded-full bg-black/20 px-2 py-0.5 normal-case">{relativeDay(today, session.date)}</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold leading-tight">{session.title}</h1>
        {committeeNameOf(session) ? <p className="mt-1 text-sm opacity-85">{committeeNameOf(session)}</p> : null}
      </header>

      <div className="space-y-4 px-4 pt-4">
        <section className="space-y-2.5 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-border">
          <p className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="block font-semibold text-text-main">{formatLongDate(session.date)}</span>
              <span className="block text-xs text-text-muted">Starts {session.time}</span>
            </span>
          </p>
          <p className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="font-semibold text-text-main">{session.location}</span>
          </p>
          {holiday ? (
            <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Falls on a holiday: {holiday.name}.
            </p>
          ) : null}
          {/* Saving an .ics file needs a browser download, which the Android app does not have. */}
          <div className={cn('grid gap-2 pt-1', isNativeApp ? 'grid-cols-1' : 'grid-cols-2')}>
            <Button variant="outline" className="h-10 text-sm" onClick={() => setAgendaOpen((prev) => !prev)} aria-expanded={agendaOpen}>
              <FileText className="mr-1.5 h-4 w-4" />
              {agendaOpen ? 'Hide agenda' : 'Agenda'}
            </Button>
            {isNativeApp ? null : (
              <Button variant="outline" className="h-10 text-sm" onClick={() => addSessionToCalendar(session)}>
                <CalendarPlus className="mr-1.5 h-4 w-4" />
                Add to calendar
              </Button>
            )}
          </div>
          {agendaOpen ? (
            <div className="border-t border-border pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Order of Business</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] text-text-main">
                {buildAgenda(session).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>

        {invited ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-text-main">{isPast ? 'Your reply' : 'Will you attend?'}</p>
              <StatusChip status={myStatus} />
            </div>
            {isPast ? null : <RsvpButtons session={session} status={myStatus} />}
            {myReply?.reason ? <p className="mt-2 text-xs italic text-red-700">“{myReply.reason}”</p> : null}
          </section>
        ) : !canSee ? (
          <p className="rounded-xl bg-muted px-4 py-3 text-xs text-text-muted">You are not on the invitation list for this session.</p>
        ) : null}

        {account.canManage ? (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-border">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-text-main">
                  <Users className="h-4 w-4 text-primary" />
                  Attendance
                </p>
                <span className="text-xs text-text-muted">{invitees.length} invited</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Attending', value: counts.attending, tone: 'text-green-700' },
                  { label: 'Not attending', value: counts.declined, tone: 'text-red-700' },
                  { label: 'No reply', value: counts.none, tone: 'text-slate-600' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border py-2">
                    <p className={cn('text-xl font-bold tabular-nums', stat.tone)}>{stat.value}</p>
                    <p className="text-[10px] font-medium text-text-muted">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="bg-green-600" style={{ width: `${(counts.attending / Math.max(invitees.length, 1)) * 100}%` }} />
                <span className="bg-red-500" style={{ width: `${(counts.declined / Math.max(invitees.length, 1)) * 100}%` }} />
              </div>
              {session.type === 'Regular' || session.type === 'Special' ? (
                <p className={cn('mt-2 text-xs font-medium', membersAttending >= QUORUM ? 'text-green-700' : 'text-amber-700')}>
                  {membersAttending >= QUORUM ? 'Quorum expected' : 'Quorum not yet assured'}: {membersAttending} of {QUORUM} members needed have confirmed.
                </p>
              ) : null}
              <div className="mt-3 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1" role="tablist" aria-label="Filter">
                {(
                  [
                    ['all', 'All'],
                    ['attending', 'Attending'],
                    ['declined', 'Not attending'],
                    ['none', 'No reply'],
                  ] as [Filter, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={filter === value}
                    onClick={() => setFilter(value)}
                    className={cn('shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-semibold', filter === value ? 'bg-white text-text-main shadow-sm' : 'text-text-muted')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {!isPast ? (
                <Button variant="outline" className="mt-3 h-10 w-full text-sm" onClick={remind}>
                  <BellRing className="mr-1.5 h-4 w-4" />
                  Remind those with no reply ({counts.none})
                </Button>
              ) : null}
            </div>
            <ul className="divide-y divide-border border-t border-border">
              {visible.map((invitee) => {
                const reply = rsvpOf(attendance, session.id, invitee.id);
                return (
                  <li key={invitee.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', invitee.group === 'member' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600')}>
                      {invitee.abbr}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-text-main">{invitee.name}</span>
                      <span className="block truncate text-[11px] text-text-muted">{reply?.reason ? `“${reply.reason}”` : invitee.detail}</span>
                    </span>
                    <StatusChip status={reply?.status ?? 'none'} className="text-[10px]" />
                  </li>
                );
              })}
              {visible.length === 0 ? <li className="px-4 py-6 text-center text-xs text-text-muted">No one in this list.</li> : null}
            </ul>
            {/* The same rule as the calendar and the /es lobby: editable sessions only, before their e-session starts. */}
            {canChangeSession(session, started, today) ? (
              <div className="flex gap-2 border-t border-border p-4">
                <Button variant="outline" className="h-10 flex-1 text-sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" className="h-10 flex-1 border-red-200 text-sm text-red-700 hover:bg-red-50" onClick={cancel}>
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Cancel {session.type === 'Meeting' ? 'meeting' : 'session'}
                </Button>
              </div>
            ) : null}
            <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${session.type === 'Meeting' ? 'meeting' : 'session'}`}>
              {editOpen ? (
                <ScheduleSessionForm
                  touch
                  key={session.id}
                  session={session}
                  scheduledBy={account.name}
                  scheduledById={account.inviteeId}
                  onCancel={() => setEditOpen(false)}
                  onScheduled={(entry) => {
                    setEditOpen(false);
                    toast('Changes saved', `${entry.title} · invitees were notified.`);
                  }}
                />
              ) : null}
            </BottomSheet>
          </section>
        ) : null}
      </div>
    </div>
  );
}
