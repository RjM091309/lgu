import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BellRing, CalendarPlus, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, Flag, MapPin, Plus, Printer, Smartphone, Trash2, Undo2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { type Session } from '@/lib/mock-data';
import { SESSION_TONE, addSessionToCalendar, buildAgenda, formatLongDate, printAgenda } from '@/lib/sessions';
import { todayInManila } from '@/lib/session-files';
import { openPrintWindow } from '@/lib/files';
import { HOLIDAY_SOURCE_LABEL, holidayTitle, holidayTone, useHolidays } from '@/lib/holidays';
import { SCOPE_LABEL } from '@/lib/local-holidays';
import { ADMIN_ROLE, useAccess, useUsers } from '@/lib/access-store';
import { QUORUM, committeeNameOf, inviteesFor, rsvpOf, setRsvp, useAttendance, type Invitee, type RsvpStatus } from '@/lib/attendance';
import { cancelScheduledSession, isScheduledInApp, nowInManila, sendReminder, useCalendarSessions, useSyncStatus } from '@/lib/esession-sync';
import { confirmAction } from '@/components/ui/confirm';
import { ScheduleSessionForm } from '@/components/esession/ScheduleSessionForm';
import { MobileAppDialog } from '@/components/esession/MobileAppDialog';
import { logActivity } from '@/lib/activity-log';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DECLINE_REASONS = ['On official travel', 'On leave', 'Schedule conflict', 'Health reasons'];

type RsvpFilter = 'all' | RsvpStatus | 'none';

const monthOf = (iso: string) => iso.slice(0, 7);
const shiftMonth = (month: string, by: number) => {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const formatResponded = (stamp: string) =>
  new Date(`${stamp}:00`).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Full-page calendar of sessions and hearings, with each session's invitees and their attendance responses. */
export function CalendarSessionsPanel() {
  const today = todayInManila();
  const sessions = useCalendarSessions();
  const firstUpcoming = sessions.find((session) => session.date >= today) ?? sessions[0];

  const [month, setMonth] = useState(monthOf(firstUpcoming?.date ?? today));
  const [selectedId, setSelectedId] = useState(firstUpcoming?.id ?? '');
  const [filter, setFilter] = useState<RsvpFilter>('all');
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<Invitee | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chipList, setChipList] = useState<'upcoming' | 'completed'>('upcoming');
  const syncStatus = useSyncStatus();

  const { user, role } = useAccess();
  const users = useUsers();
  const attendance = useAttendance();
  // Only the Administrator sees everyone's responses and records them; other accounts see and answer only their own invitation.
  const canManage = role?.name === ADMIN_ROLE;

  const [year, monthNumber] = month.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthLabel = new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const { byDate: holidaysByDate, holidays, source: holidaySource } = useHolidays(year);
  const monthHolidays = holidays.filter((holiday) => holiday.date.startsWith(month));
  const monthSessions = sessions.filter((session) => session.date.startsWith(month));

  // A session cancelled from another device falls back to the next one.
  const session = sessions.find((entry) => entry.id === selectedId) ?? firstUpcoming ?? null;
  const invitees = session ? inviteesFor(session, users) : [];
  const statusOf = (invitee: Invitee) => (session ? rsvpOf(attendance, session.id, invitee.id)?.status ?? 'none' : 'none');
  const counts = {
    attending: invitees.filter((invitee) => statusOf(invitee) === 'attending').length,
    declined: invitees.filter((invitee) => statusOf(invitee) === 'declined').length,
    none: invitees.filter((invitee) => statusOf(invitee) === 'none').length,
  };
  const membersAttending = invitees.filter((invitee) => invitee.group === 'member' && statusOf(invitee) === 'attending').length;
  const self = invitees.find((invitee) => invitee.userId === user.id) ?? null;
  const visible = invitees.filter((invitee) => filter === 'all' || statusOf(invitee) === filter);
  const holidayOnSession = session ? holidaysByDate.get(session.date) : undefined;
  // A session already held: responses read as who was present, and there is nothing left to answer.
  const isDone = (entry: Session) => entry.date < today;
  const held = session ? isDone(session) : false;
  const upcomingSessions = sessions.filter((entry) => !isDone(entry));
  const completedSessions = sessions.filter(isDone).reverse();
  const chipSessions = chipList === 'upcoming' ? upcomingSessions : completedSessions;

  // Responses given in the mobile app arrive through the sync; tell the Administrator as they come in.
  // The first update after connecting is the server catching this page up, not a new reply.
  const previousRsvps = useRef(attendance);
  const wasLive = useRef(false);
  useEffect(() => {
    const before = previousRsvps.current;
    const live = wasLive.current;
    previousRsvps.current = attendance;
    wasLive.current = syncStatus === 'live';
    if (!canManage || !live || before === attendance) return;
    const changed = Object.entries(attendance).filter(
      ([key, rsvp]) => rsvp.recordedBy !== user.name && (before[key]?.status !== rsvp.status || before[key]?.respondedAt !== rsvp.respondedAt)
    );
    changed.slice(0, 3).forEach(([key, rsvp]) => {
      const [sessionId, inviteeId] = key.split('|');
      const target = sessions.find((entry) => entry.id === sessionId);
      const who = target ? inviteesFor(target, users).find((invitee) => invitee.id === inviteeId) : undefined;
      if (!target || !who) return;
      toast(
        rsvp.status === 'attending' ? 'Attendance confirmed' : 'Not attending',
        `${who.name} · ${target.title}${rsvp.reason ? ` · “${rsvp.reason}”` : ''}`,
        rsvp.status === 'attending' ? 'success' : 'info'
      );
    });
  }, [attendance, syncStatus, canManage, sessions, user.name, users]);

  const selectSession = (entry: Session) => {
    setSelectedId(entry.id);
    setMonth(monthOf(entry.date));
    setFilter('all');
  };

  const record = (invitee: Invitee, status: RsvpStatus | null, reason?: string) => {
    if (!session) return;
    const previous = rsvpOf(attendance, session.id, invitee.id)?.status ?? null;
    setRsvp(session.id, invitee.id, status ? { status, reason: reason?.trim() || undefined, respondedAt: nowInManila(), recordedBy: user.name } : null);
    const label = status === 'attending' ? 'attending' : status === 'declined' ? 'not attending' : 'no response';
    const who = invitee.userId === user.id ? 'You are' : `${invitee.name} is`;
    toast('Attendance updated', `${who} marked ${label} for ${session.title}.`);
    if (previous !== status) {
      logActivity({
        module: 'E-Session',
        action: 'Updated',
        summary: `Marked ${invitee.name} ${label} for ${session.title}`,
        detail: reason?.trim() ? `Reason: ${reason.trim()}` : undefined,
      });
    }
  };

  const openDecline = (invitee: Invitee) => {
    setDeclineReason(session ? rsvpOf(attendance, session.id, invitee.id)?.reason ?? '' : '');
    setDeclineTarget(invitee);
  };

  const sendReminders = () => {
    if (!session) return;
    const pending = invitees.filter((invitee) => statusOf(invitee) === 'none');
    if (pending.length === 0) {
      toast('No reminders needed', 'Everyone invited has already responded.', 'info');
      return;
    }
    sendReminder(session.id, pending.map((invitee) => invitee.id), user.name, nowInManila());
    toast('Reminders sent', `${pending.length} invitee(s) were reminded in the mobile app to confirm attendance for ${session.title}.`);
    logActivity({ module: 'E-Session', action: 'Updated', summary: `Sent attendance reminders for ${session.title}`, detail: pending.map((invitee) => invitee.name).join(', ') });
  };

  const cancelSession = async () => {
    if (!session) return;
    const confirmed = await confirmAction({
      title: `Cancel ${session.title}?`,
      description: 'It is removed from the calendar of everyone invited, together with their responses.',
      confirmLabel: 'Cancel session',
      cancelLabel: 'Keep',
      tone: 'destructive',
    });
    if (!confirmed) return;
    cancelScheduledSession(session.id);
    toast('Session cancelled', `${session.title} was removed from the calendar.`);
    logActivity({ module: 'E-Session', action: 'Deleted', summary: `Cancelled ${session.title}`, detail: `${formatLongDate(session.date)}, ${session.time}` });
  };

  const printAttendance = () => {
    if (!session) return;
    const row = (invitee: Invitee) => {
      const rsvp = rsvpOf(attendance, session.id, invitee.id);
      const status = statusChip(rsvp?.status ?? 'none').label;
      return `<tr><td>${invitee.name}</td><td>${invitee.detail}</td><td>${status}</td><td>${rsvp?.reason ?? ''}</td></tr>`;
    };
    const ok = openPrintWindow(
      `Attendance · ${session.title}`,
      `<div class="title">${session.title}</div>
       <div class="rows">
         <div><b>Date</b>: ${formatLongDate(session.date)}, ${session.time}</div>
         <div><b>Venue</b>: ${session.location}</div>
         <div><b>${held ? 'Attendance' : 'Confirmed'}</b>: ${counts.attending} ${statusChip('attending').label.toLowerCase()} · ${counts.declined} ${statusChip('declined').label.toLowerCase()} · ${counts.none} ${statusChip('none').label.toLowerCase()}</div>
       </div>
       <table><thead><tr><th>Name</th><th>Position / Office</th><th>Response</th><th>Reason</th></tr></thead><tbody>${invitees.map(row).join('')}</tbody></table>`
    );
    if (!ok) toast('Attendance list not opened', 'Your browser blocked the print window. Allow pop-ups for this site and try again.', 'error');
  };

  const statusChip = (status: RsvpStatus | 'none') =>
    status === 'attending'
      ? { label: held ? 'Present' : 'Attending', tone: 'border-green-200 bg-green-50 text-green-800' }
      : status === 'declined'
        ? { label: held ? 'Absent' : 'Not attending', tone: 'border-red-200 bg-red-50 text-red-800' }
        : { label: held ? 'No record' : 'No response', tone: 'border-slate-200 bg-slate-50 text-slate-600' };

  const renderInvitee = (invitee: Invitee) => {
    const rsvp = session ? rsvpOf(attendance, session.id, invitee.id) : undefined;
    const status = rsvp?.status ?? 'none';
    const chip = statusChip(status);
    const isSelf = invitee.userId === user.id;
    const editable = canManage || isSelf;
    return (
      <li key={invitee.id} className={cn('flex items-start gap-3 px-4 py-3', isSelf && 'bg-primary/[0.03]')}>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
            invitee.group === 'member' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'
          )}
        >
          {invitee.abbr}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-text-main">
            <span className="truncate">{invitee.name}</span>
            {isSelf ? <span className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[9px] font-bold uppercase text-white">You</span> : null}
          </p>
          <p className="truncate text-[11px] text-text-muted">{invitee.detail}</p>
          {rsvp?.reason ? <p className="mt-0.5 text-[11px] italic text-red-700">“{rsvp.reason}”</p> : null}
          {rsvp ? (
            <p className="mt-0.5 text-[10px] text-text-muted">
              {formatResponded(rsvp.respondedAt)} · recorded by {rsvp.recordedBy === user.name && isSelf ? 'you' : rsvp.recordedBy}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={cn('inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-semibold', chip.tone)}>{chip.label}</span>
          {editable ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => record(invitee, status === 'attending' ? null : 'attending')}
                aria-pressed={status === 'attending'}
                title={status === 'attending' ? 'Clear response' : 'Mark attending'}
                aria-label={`${status === 'attending' ? 'Clear response for' : 'Mark attending:'} ${invitee.name}`}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
                  status === 'attending' ? 'border-green-600 bg-green-600 text-white' : 'border-border text-text-muted hover:border-green-600 hover:text-green-700'
                )}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
              <button
                type="button"
                onClick={() => (status === 'declined' ? record(invitee, null) : openDecline(invitee))}
                aria-pressed={status === 'declined'}
                title={status === 'declined' ? 'Clear response' : 'Mark not attending'}
                aria-label={`${status === 'declined' ? 'Clear response for' : 'Mark not attending:'} ${invitee.name}`}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
                  status === 'declined' ? 'border-red-600 bg-red-600 text-white' : 'border-border text-text-muted hover:border-red-600 hover:text-red-700'
                )}
              >
                <X className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
            </div>
          ) : null}
        </div>
      </li>
    );
  };

  const members = visible.filter((invitee) => invitee.group === 'member');
  const staff = visible.filter((invitee) => invitee.group === 'staff');
  const selfStatus = self ? statusOf(self) : 'none';

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Calendar Sessions</h1>
          <p className="text-sm text-text-muted">Sessions and hearings by month, with who is invited and whether they will attend.</p>
          <p
            className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted"
            title={syncStatus === 'live' ? 'Responses from the mobile app appear here at once' : 'Changes stay in this browser'}
          >
            <span className={cn('h-2 w-2 rounded-full', syncStatus === 'live' ? 'animate-pulse bg-green-500' : syncStatus === 'connecting' ? 'bg-amber-400' : 'bg-slate-300')} aria-hidden />
            {syncStatus === 'live' ? 'Live with the mobile app' : syncStatus === 'connecting' ? 'Connecting to the mobile app…' : 'Mobile sync offline'}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="outline" size="sm" className="h-9" onClick={() => setMobileOpen(true)}>
              <Smartphone className="mr-1.5 h-4 w-4" />
              Mobile app
            </Button>
            <Button size="sm" className="h-9" onClick={() => setScheduleOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Schedule session
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2.5">
        <div className="inline-flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Show sessions">
          {(
            [
              ['upcoming', 'Upcoming', upcomingSessions.length],
              ['completed', 'Completed', completedSessions.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={chipList === value}
              onClick={() => setChipList(value)}
              className={cn('rounded-md px-3 py-1 text-xs font-semibold', chipList === value ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main')}
            >
              {label} <span className="tabular-nums opacity-70">({count})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {chipSessions.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => selectSession(entry)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                entry.id === selectedId ? 'border-primary bg-primary text-white' : 'border-border bg-white text-text-main hover:border-primary/40'
              )}
            >
              {isDone(entry) ? (
                <CheckCircle2 className={cn('h-3.5 w-3.5', entry.id === selectedId ? 'text-white' : 'text-green-600')} aria-hidden />
              ) : (
                <span className={cn('h-2 w-2 rounded-full', entry.id === selectedId ? 'bg-white' : SESSION_TONE[entry.type].split(' ')[0])} aria-hidden />
              )}
              {new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · {entry.title}
            </button>
          ))}
          {chipSessions.length === 0 ? <p className="text-xs text-text-muted">{chipList === 'upcoming' ? 'No upcoming sessions.' : 'No completed sessions yet.'}</p> : null}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* Month calendar */}
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setMonth((prev) => shiftMonth(prev, -1))} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="min-w-[150px] text-center text-lg font-semibold text-text-main">{monthLabel}</h2>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setMonth((prev) => shiftMonth(prev, 1))} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setMonth(monthOf(today))}>
                This month
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
              {(['Regular', 'Committee Hearing', 'Special'] as const).map((type) => (
                <span key={type} className="inline-flex items-center gap-1">
                  <span className={cn('h-2.5 w-2.5 rounded-sm', SESSION_TONE[type])} />
                  {type}
                </span>
              ))}
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-100 ring-1 ring-inset ring-red-300" />
                National holiday
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-100 ring-1 ring-inset ring-amber-300" />
                Tarlac / Capas
              </span>
            </div>
          </header>

          <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-2">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstWeekday }, (_, i) => (
              <div key={`blank-${i}`} className="min-h-[112px] border-b border-r border-border bg-muted/20" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const iso = `${month}-${String(day).padStart(2, '0')}`;
              const holiday = holidaysByDate.get(iso);
              const daySessions = monthSessions.filter((entry) => entry.date === iso);
              const isToday = iso === today;
              return (
                <div
                  key={iso}
                  className={cn('flex min-h-[112px] flex-col gap-1 border-b border-r border-border p-1.5', holiday && (holiday.scope === 'national' ? 'bg-red-50/60' : 'bg-amber-50/60'))}
                  title={holiday ? holidayTitle(holiday) : undefined}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums',
                      isToday ? 'bg-primary font-bold text-white' : holiday ? holidayTone(holiday).text + ' font-semibold' : 'text-text-main'
                    )}
                  >
                    {day}
                  </span>
                  {holiday ? <span className={cn('truncate text-[10px] font-medium leading-tight', holidayTone(holiday).text)}>{holiday.name}</span> : null}
                  {daySessions.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => selectSession(entry)}
                      title={`${entry.title} · ${entry.time}${isDone(entry) ? ' · Completed' : ''}`}
                      className={cn(
                        'w-full rounded-md px-1.5 py-1 text-left text-[11px] font-semibold leading-tight shadow-sm transition-opacity hover:opacity-90',
                        SESSION_TONE[entry.type],
                        isDone(entry) && 'opacity-60',
                        entry.id === selectedId && 'opacity-100 ring-2 ring-[#d4a72c] ring-offset-1'
                      )}
                    >
                      <span className="block truncate">{entry.title}</span>
                      <span className="flex items-center gap-1 text-[10px] font-medium opacity-80">
                        {isDone(entry) ? <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden /> : null}
                        {isDone(entry) ? 'Done' : entry.time}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-text-main">
                <Flag className="h-3.5 w-3.5 text-red-600" />
                Holidays this month
              </p>
              {monthHolidays.length ? (
                <ul className="mt-2 space-y-1">
                  {monthHolidays.map((holiday) => (
                    <li key={`${holiday.date}-${holiday.name}`} className="flex gap-2 text-xs" title={holiday.basis}>
                      <span className={cn('w-12 shrink-0 font-semibold tabular-nums', holidayTone(holiday).text)}>
                        {new Date(`${holiday.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="min-w-0 flex-1 text-text-main">{holiday.name}</span>
                      {holiday.scope !== 'national' ? (
                        <span className="h-fit shrink-0 rounded bg-amber-50 px-1 text-[9px] font-semibold uppercase text-amber-800">{SCOPE_LABEL[holiday.scope]}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-text-muted">{holidaySource === 'loading' ? 'Loading…' : 'No public holidays.'}</p>
              )}
              <p className="mt-2 text-[10px] text-text-muted">{HOLIDAY_SOURCE_LABEL[holidaySource]}, with Tarlac and Capas local holidays</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-main">Sessions this month</p>
              {monthSessions.length ? (
                <ul className="mt-2 space-y-1">
                  {monthSessions.map((entry) => (
                    <li key={entry.id}>
                      <button type="button" onClick={() => selectSession(entry)} className="flex w-full items-center gap-2 text-left text-xs hover:text-primary">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', SESSION_TONE[entry.type].split(' ')[0])} />
                        <span className="w-12 shrink-0 font-semibold tabular-nums">{new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                        <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                        {isDone(entry) ? <span className="shrink-0 rounded bg-green-50 px-1 text-[9px] font-semibold uppercase text-green-800">Done</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-text-muted">No sessions scheduled.</p>
              )}
            </div>
          </div>
        </section>

        {/* Selected session and attendance */}
        {session ? (
          <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm xl:sticky xl:top-4">
            <header className="border-b border-border px-5 py-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn('inline-block rounded px-1.5 py-px text-[10px] font-semibold', SESSION_TONE[session.type])}>{session.type}</span>
                {held ? (
                  <span className="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-1.5 py-px text-[10px] font-semibold text-green-800">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                  </span>
                ) : null}
              </div>
              <h2 className="mt-1.5 text-lg font-semibold leading-snug text-text-main">{session.title}</h2>
              {committeeNameOf(session) ? <p className="text-xs text-text-muted">{committeeNameOf(session)}</p> : null}
              <div className="mt-2 space-y-1 text-xs text-text-muted">
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {formatLongDate(session.date)} · {session.time}
                </p>
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {session.location}
                </p>
              </div>
              {holidayOnSession && !held ? (
                <p className="mt-2 flex items-center gap-1.5 rounded bg-red-50 px-2 py-1.5 text-[11px] font-medium text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Falls on a holiday: {holidayOnSession.name}. Consider rescheduling.
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setAgendaOpen(true)}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Agenda
                </Button>
                {!held ? (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => addSessionToCalendar(session)}>
                    <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                    Add to calendar
                  </Button>
                ) : null}
                {canManage ? (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={printAttendance}>
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                    Print attendance
                  </Button>
                ) : null}
                {canManage && isScheduledInApp(session.id) ? (
                  <Button variant="outline" size="sm" className="h-8 text-xs text-red-700 hover:border-red-300 hover:bg-red-50" onClick={cancelSession}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Cancel session
                  </Button>
                ) : null}
              </div>
            </header>

            {self && held ? (
              <div className="border-b border-border bg-primary/[0.04] px-5 py-3">
                <p className="text-sm text-text-main">
                  You were invited.{' '}
                  <span className="font-semibold">{selfStatus === 'attending' ? 'You were present.' : selfStatus === 'declined' ? 'You were absent.' : 'No attendance recorded for you.'}</span>
                </p>
              </div>
            ) : self ? (
              <div className="border-b border-border bg-primary/[0.04] px-5 py-4">
                <p className="text-sm font-semibold text-text-main">You are invited. Will you attend?</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Button size="sm" className={cn('h-9', selfStatus === 'attending' && 'bg-green-600 hover:bg-green-700')} variant={selfStatus === 'attending' ? 'default' : 'outline'} onClick={() => record(self, 'attending')}>
                    <Check className="mr-1.5 h-4 w-4" />
                    I will attend
                  </Button>
                  <Button size="sm" className={cn('h-9', selfStatus === 'declined' && 'bg-red-600 hover:bg-red-700')} variant={selfStatus === 'declined' ? 'default' : 'outline'} onClick={() => openDecline(self)}>
                    <X className="mr-1.5 h-4 w-4" />
                    I can&apos;t attend
                  </Button>
                  {selfStatus !== 'none' ? (
                    <button type="button" onClick={() => record(self, null)} className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-primary">
                      <Undo2 className="h-3.5 w-3.5" />
                      Clear my response
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Everyone's responses are for the Administrator only. */}
            {canManage ? (
              <>
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-text-main">
                  <Users className="h-4 w-4 text-primary" />
                  Attendance
                </p>
                <span className="text-xs text-text-muted">{invitees.length} invited</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: held ? 'Present' : 'Attending', value: counts.attending, tone: 'text-green-700' },
                  { label: held ? 'Absent' : 'Not attending', value: counts.declined, tone: 'text-red-700' },
                  { label: held ? 'No record' : 'No response', value: counts.none, tone: 'text-slate-600' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border px-2 py-2">
                    <p className={cn('text-xl font-bold tabular-nums', stat.tone)}>{stat.value}</p>
                    <p className="text-[10px] font-medium text-text-muted">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="bg-green-600" style={{ width: `${(counts.attending / Math.max(invitees.length, 1)) * 100}%` }} />
                <span className="bg-red-500" style={{ width: `${(counts.declined / Math.max(invitees.length, 1)) * 100}%` }} />
              </div>
              {session.type !== 'Committee Hearing' ? (
                <p className={cn('mt-2 text-[11px] font-medium', membersAttending >= QUORUM ? 'text-green-700' : 'text-amber-700')}>
                  {held
                    ? membersAttending >= QUORUM
                      ? `Quorum was met: ${membersAttending} members present (${QUORUM} needed).`
                      : `No quorum: only ${membersAttending} members present (${QUORUM} needed).`
                    : membersAttending >= QUORUM
                      ? `Quorum expected: ${membersAttending} of ${QUORUM} members needed have confirmed.`
                      : `Quorum not yet assured: ${membersAttending} of ${QUORUM} members needed have confirmed.`}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Filter invitees">
                  {(
                    [
                      ['all', 'All'],
                      ['attending', held ? 'Present' : 'Attending'],
                      ['declined', held ? 'Absent' : 'Not attending'],
                      ['none', held ? 'No record' : 'No response'],
                    ] as [RsvpFilter, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={filter === value}
                      onClick={() => setFilter(value)}
                      className={cn('rounded-md px-2 py-1 text-[11px] font-semibold', filter === value ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {!held ? (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={sendReminders}>
                    <BellRing className="mr-1.5 h-3.5 w-3.5" />
                    Remind no-response
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="max-h-[560px] overflow-y-auto">
              {members.length > 0 ? (
                <>
                  <p className="sticky top-0 z-10 border-b border-border bg-muted/80 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide text-text-muted backdrop-blur">
                    {session.committeeId ? 'Committee members' : 'Members'} · {members.length}
                  </p>
                  <ul className="divide-y divide-border">{members.map(renderInvitee)}</ul>
                </>
              ) : null}
              {staff.length > 0 ? (
                <>
                  <p className="sticky top-0 z-10 border-y border-border bg-muted/80 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide text-text-muted backdrop-blur">
                    Secretariat &amp; staff · {staff.length}
                  </p>
                  <ul className="divide-y divide-border">{staff.map(renderInvitee)}</ul>
                </>
              ) : null}
              {visible.length === 0 ? <p className="px-5 py-8 text-center text-xs text-text-muted">No one in this list.</p> : null}
            </div>
              </>
            ) : (
              <p className="px-5 py-4 text-xs text-text-muted">
                {self ? 'Only the Administrator can see the responses of other invitees.' : 'You are not on the invitation list for this session.'}
              </p>
            )}
          </section>
        ) : null}
      </div>

      {/* Not attending: optional reason */}
      <Dialog open={declineTarget !== null} onOpenChange={(open) => !open && setDeclineTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">Mark as not attending</DialogTitle>
            <DialogDescription>
              {declineTarget?.userId === user.id ? 'You' : declineTarget?.name} · {session?.title}
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (declineTarget) record(declineTarget, 'declined', declineReason);
              setDeclineTarget(null);
            }}
          >
            <div className="flex flex-wrap gap-1.5">
              {DECLINE_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setDeclineReason(reason)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    declineReason === reason ? 'border-primary bg-primary text-white' : 'border-border text-text-main hover:border-primary/40'
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>
            <Input value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Reason (optional)" aria-label="Reason for not attending" />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setDeclineTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700">
                Mark not attending
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Schedule a session */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">Schedule session</DialogTitle>
            <DialogDescription>Everyone the session concerns is invited and notified in the mobile app.</DialogDescription>
          </DialogHeader>
          <div className="mt-5">
            {scheduleOpen ? (
              <ScheduleSessionForm
                scheduledBy={user.name}
                onCancel={() => setScheduleOpen(false)}
                onScheduled={(entry) => {
                  setScheduleOpen(false);
                  selectSession(entry);
                  toast('Session scheduled', `${entry.title} on ${formatLongDate(entry.date)}. Invitees were notified in the mobile app.`);
                  logActivity({ module: 'E-Session', action: 'Created', summary: `Scheduled ${entry.title}`, detail: `${formatLongDate(entry.date)}, ${entry.time} · ${entry.location}` });
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <MobileAppDialog open={mobileOpen} onOpenChange={setMobileOpen} />

      {/* Agenda */}
      <Dialog open={agendaOpen && session !== null} onOpenChange={setAgendaOpen}>
        <DialogContent className="max-w-2xl">
          {session ? (
            <>
              <DialogHeader>
                <p className="text-xs font-bold uppercase tracking-wider text-secondary">{session.type}</p>
                <DialogTitle className="text-xl text-primary">{session.title}</DialogTitle>
                <DialogDescription>
                  {formatLongDate(session.date)} · {session.time} · {session.location}
                </DialogDescription>
              </DialogHeader>
              <h3 className="mt-5 text-sm font-bold uppercase tracking-wider text-text-muted">Order of Business</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                {buildAgenda(session).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => printAgenda(session)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print agenda
                </Button>
                <Button variant="outline" onClick={() => addSessionToCalendar(session)}>
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Add to calendar
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
