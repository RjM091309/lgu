import { useState, type FormEvent } from 'react';
import { AlertTriangle, CalendarPlus, Check, Info, Save, Users, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LGU_PROFILE, mockCommitteeAssignments, mockCommittees, type Session } from '@/lib/mock-data';
import { inviteePool, inviteesFor, type Invitee } from '@/lib/attendance';
import { useUsers } from '@/lib/access-store';
import { useHolidays } from '@/lib/holidays';
import { todayInManila } from '@/lib/session-files';
import { formatLongDate } from '@/lib/sessions';
import { CHANGE_REFUSED, newSessionId, nowInManila, scheduleSession, updateScheduledSession, useCalendarSessions } from '@/lib/esession-sync';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const TYPES: Session['type'][] = ['Regular', 'Special', 'Committee Hearing', 'Meeting'];

const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
};

/** `14:30` (from a time input) → `02:30 PM`. */
const toSessionTime = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
};

/** `02:30 PM` → `14:30` (for a time input). */
const toInputTime = (time: string) => {
  const [clock, meridiem] = time.split(' ');
  const [hour, minute] = clock.split(':').map(Number);
  return `${String((hour % 12) + (meridiem === 'PM' ? 12 : 0)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const selectClass =
  'h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-ring/30';

/** What an edit changed, in the words of the notice the invitees get. */
const describeChanges = (before: Session, after: Session) => {
  const changes: string[] = [];
  if (before.date !== after.date || before.time !== after.time) changes.push(`Moved to ${formatLongDate(after.date)}, ${after.time}`);
  if (before.title !== after.title) changes.push(`Now titled "${after.title}"`);
  if (before.location !== after.location) changes.push(`Venue: ${after.location}`);
  if ((before.purpose ?? '') !== (after.purpose ?? '')) changes.push('Purpose updated');
  if ((before.invitees ?? []).join() !== (after.invitees ?? []).join()) changes.push('Invitees updated');
  if ((before.agenda ?? []).join('\n') !== (after.agenda ?? []).join('\n')) changes.push('Agenda updated');
  return changes.join(' · ');
};

interface ScheduleSessionFormProps {
  /** Who is scheduling, for the notice sent to invitees. */
  scheduledBy: string;
  /** The invitee id of whoever is scheduling (`user:USR-001`): always invited to a meeting they set up. */
  scheduledById?: string;
  /** Editing a session scheduled in the app: its kind (and committee) stay as they are. */
  session?: Session;
  /** A meeting that starts right away: today, at the current time. */
  startNow?: boolean;
  onScheduled: (session: Session) => void;
  onCancel: () => void;
  /** Larger touch targets for the mobile app. */
  touch?: boolean;
}

/** Schedules (or edits) a session, hearing or meeting; everyone it concerns is invited and notified. */
export function ScheduleSessionForm({ scheduledBy, scheduledById, session: editing, startNow = false, onScheduled, onCancel, touch = false }: ScheduleSessionFormProps) {
  const sessions = useCalendarSessions();
  const users = useUsers();
  const today = todayInManila();

  const nextRegularTitle = () => {
    const numbers = sessions.map((entry) => Number(entry.title.match(/^(\d+)(?:st|nd|rd|th) Regular Session/)?.[1] ?? 0));
    return `${ordinal(Math.max(0, ...numbers) + 1)} Regular Session`;
  };
  const defaultTitle = (type: Session['type']) => (type === 'Regular' ? nextRegularTitle() : type === 'Special' ? 'Special Session' : type === 'Committee Hearing' ? 'Public Hearing: ' : '');

  const initialType = editing?.type ?? (startNow ? 'Meeting' : 'Regular');
  const [type, setType] = useState<Session['type']>(initialType);
  const [committeeId, setCommitteeId] = useState(editing?.committeeId ?? mockCommittees[0].id);
  const [title, setTitle] = useState(() => editing?.title ?? defaultTitle(initialType));
  const [titleEdited, setTitleEdited] = useState(Boolean(editing));
  const [date, setDate] = useState(editing?.date ?? '');
  const [time, setTime] = useState(editing ? toInputTime(editing.time) : '09:00');
  const [location, setLocation] = useState(editing?.location ?? LGU_PROFILE.sessionHall);
  const [purpose, setPurpose] = useState(editing?.purpose ?? '');
  const [chosen, setChosen] = useState<string[]>(() => editing?.invitees ?? (scheduledById ? [scheduledById] : []));
  const [agendaText, setAgendaText] = useState((editing?.agenda ?? []).join('\n'));
  const [error, setError] = useState('');

  const { byDate: holidaysByDate } = useHolidays(Number((date || today).slice(0, 4)));
  const holiday = date && !startNow ? holidaysByDate.get(date) : undefined;
  const weekday = date && !startNow ? new Date(`${date}T00:00:00`).getDay() : null;
  const sameDay = date && !startNow ? sessions.filter((entry) => entry.date === date && entry.id !== editing?.id) : [];

  const meeting = type === 'Meeting';
  const pool = inviteePool(users);
  const agenda = agendaText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const draft: Session = {
    id: editing?.id ?? '',
    title: title.trim(),
    date,
    time: time ? toSessionTime(time) : '',
    location: location.trim(),
    type,
    ...(type === 'Committee Hearing' ? { committeeId } : {}),
    ...(type === 'Special' && purpose.trim() ? { purpose: purpose.trim() } : {}),
    // Kept in the pool's order, so an edit that only re-ticks the same people changes nothing.
    ...(meeting ? { invitees: pool.filter((invitee) => chosen.includes(invitee.id)).map((invitee) => invitee.id) } : {}),
    ...(meeting && agenda.length ? { agenda } : {}),
  };
  const invitees = inviteesFor(draft, users);
  const memberCount = invitees.filter((invitee) => invitee.group === 'member').length;

  const changeType = (next: Session['type']) => {
    setType(next);
    if (!titleEdited) setTitle(defaultTitle(next));
    setTime((prev) => (prev === '09:00' || prev === '14:00' ? (next === 'Committee Hearing' ? '14:00' : '09:00') : prev));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.title || draft.title === 'Public Hearing:') return setError(meeting ? 'Enter what the meeting is about.' : 'Enter a title for the session.');
    if (type === 'Special' && !draft.purpose) return setError('Enter the purpose of the special session. It is stated in the notice to the members.');
    if (meeting && (draft.invitees?.length ?? 0) < 2) return setError('Invite at least one other person to the meeting.');
    if (!draft.location) return setError('Enter the venue.');
    if (startNow) {
      const now = nowInManila();
      const session = { ...draft, id: newSessionId(), date: now.slice(0, 10), time: toSessionTime(now.slice(11)) };
      scheduleSession(session, scheduledBy, now);
      return onScheduled(session);
    }
    if (!date) return setError(`Choose the date of the ${meeting ? 'meeting' : 'session'}.`);
    if (date < today) return setError('The date has already passed. Choose today or a later date.');
    if (!time) return setError('Choose the start time.');
    if (editing) {
      const changes = describeChanges(editing, draft);
      if (!changes) return setError('Nothing was changed.');
      void updateScheduledSession(draft, changes, scheduledBy, nowInManila()).then((saved) => saved || toast('Changes not saved', `${draft.title}: ${CHANGE_REFUSED}`, 'error'));
      return onScheduled(draft);
    }
    const session = { ...draft, id: newSessionId() };
    scheduleSession(session, scheduledBy, nowInManila());
    onScheduled(session);
  };

  const fieldHeight = touch ? 'h-11 text-base' : '';
  const label = 'text-xs font-semibold text-text-muted';
  const rescheduled = editing && (editing.date !== draft.date || editing.time !== draft.time);
  // Notice of a special session has to reach the members a day ahead; flag a date that leaves less than that.
  const shortNotice = type === 'Special' && Boolean(date) && date <= addDays(today, 1) && (!editing || rescheduled);

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      {editing || startNow ? null : (
        <div>
          <p className={label}>Type</p>
          <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Session type">
            {TYPES.map((entry) => (
              <button
                key={entry}
                type="button"
                role="radio"
                aria-checked={type === entry}
                onClick={() => changeType(entry)}
                className={cn(
                  'rounded-md px-2 font-semibold transition-colors',
                  touch ? 'py-2.5 text-xs' : 'py-1.5 text-xs',
                  type === entry ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text-main'
                )}
              >
                {entry === 'Committee Hearing' ? 'Hearing' : entry}
              </button>
            ))}
          </div>
        </div>
      )}

      {meeting ? (
        <p className="flex items-start gap-1.5 rounded-md bg-teal-50 px-3 py-2 text-xs text-teal-800">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>A meeting (caucus, briefing or coordination) is not an official session: there is no quorum or roll call, and no measure can be acted on in it.</span>
        </p>
      ) : null}

      {type === 'Committee Hearing' && !editing ? (
        <label className="block">
          <span className={label}>Committee</span>
          <select value={committeeId} onChange={(e) => setCommitteeId(e.target.value)} className={cn(selectClass, 'mt-1.5', touch && 'h-11 text-base')}>
            {mockCommittees.map((committee) => (
              <option key={committee.id} value={committee.id}>
                {committee.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block">
        <span className={label}>{meeting ? 'What is it about?' : 'Title'}</span>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleEdited(true);
          }}
          placeholder={meeting ? 'e.g. Caucus on the 2027 Annual Budget' : undefined}
          className={cn('mt-1.5', fieldHeight)}
          maxLength={160}
        />
      </label>

      {type === 'Special' ? (
        <label className="block">
          <span className={label}>Purpose</span>
          <Input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Consideration of the Proposed 2027 Annual Budget"
            className={cn('mt-1.5', fieldHeight)}
            maxLength={300}
          />
          <span className="mt-1 block text-[11px] text-text-muted">Stated in the notice to the members and taken up as the main item of the agenda.</span>
        </label>
      ) : null}

      {startNow ? null : (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Date</span>
            <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={cn('mt-1.5', fieldHeight)} />
          </label>
          <label className="block">
            <span className={label}>Start time</span>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={cn('mt-1.5', fieldHeight)} />
          </label>
        </div>
      )}

      <label className="block">
        <span className={label}>Venue</span>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} className={cn('mt-1.5', fieldHeight)} maxLength={160} />
      </label>

      {meeting ? (
        <>
          <InviteePicker pool={pool} chosen={chosen} setChosen={setChosen} locked={scheduledById} touch={touch} />
          <label className="block">
            <span className={label}>Agenda (optional, one item per line)</span>
            <textarea
              value={agendaText}
              onChange={(e) => setAgendaText(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder={'e.g. Briefing by the Municipal Budget Officer\nQuestions from the members'}
              className={cn(selectClass, 'mt-1.5 h-auto py-2', touch && 'text-base')}
            />
          </label>
        </>
      ) : null}

      {holiday || weekday === 0 || weekday === 6 || sameDay.length || (shortNotice) ? (
        <div className="space-y-1 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {holiday ? (
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              Falls on a holiday: {holiday.name}.
            </p>
          ) : null}
          {weekday === 0 || weekday === 6 ? (
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              Falls on a {weekday === 0 ? 'Sunday' : 'Saturday'}.
            </p>
          ) : null}
          {shortNotice ? (
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              Members must be served written notice at least 24 hours before a special session (LGC Sec. 52). Check that this date allows it.
            </p>
          ) : null}
          {sameDay.map((entry) => (
            <p key={entry.id} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              Same day as {entry.title} ({entry.time}).
            </p>
          ))}
        </div>
      ) : null}

      <p className="flex items-start gap-1.5 rounded-md bg-primary/[0.05] px-3 py-2 text-xs text-primary">
        <Users className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          {editing
            ? `The ${invitees.length} invitees are notified of the change in the mobile app.${rescheduled ? ' The new date or time clears their attendance responses, so they confirm again.' : ''}`
            : `${invitees.length} will be invited and notified in the mobile app: ${memberCount} ${type === 'Committee Hearing' ? 'committee members' : 'members'} and ${invitees.length - memberCount} staff.`}
        </span>
      </p>

      {error ? (
        <p className="text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className={cn('flex gap-2 pt-1', touch ? 'flex-col-reverse' : 'justify-end')}>
        <Button type="button" variant="outline" onClick={onCancel} className={touch ? 'h-11' : undefined}>
          Cancel
        </Button>
        <Button type="submit" className={touch ? 'h-11' : undefined}>
          {startNow ? <Video className="mr-2 h-4 w-4" /> : editing ? <Save className="mr-2 h-4 w-4" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
          {startNow ? 'Start meeting' : editing ? 'Save and notify' : 'Schedule and notify'}
        </Button>
      </div>
    </form>
  );
}

/** Ticks who is invited to a meeting, with shortcuts for the usual groups. `locked`: whoever sets it up, always in. */
function InviteePicker({
  pool,
  chosen,
  setChosen,
  locked,
  touch,
}: {
  pool: Invitee[];
  chosen: string[];
  setChosen: (next: string[]) => void;
  locked?: string;
  touch: boolean;
}) {
  const members = pool.filter((invitee) => invitee.group === 'member');
  const staff = pool.filter((invitee) => invitee.group === 'staff');
  const add = (ids: string[]) => setChosen([...new Set([...chosen, ...ids])]);
  const toggle = (id: string) => (id === locked ? undefined : setChosen(chosen.includes(id) ? chosen.filter((entry) => entry !== id) : [...chosen, id]));
  const committeeIds = (committeeId: string) => {
    const assignment = mockCommitteeAssignments[committeeId];
    return assignment ? [assignment.chair, assignment.viceChair, ...assignment.members].map((id) => `member:${id}`) : [];
  };
  const chip = cn('rounded-full border border-border bg-white px-2.5 font-semibold text-text-main hover:bg-muted', touch ? 'py-1.5 text-xs' : 'py-1 text-[11px]');

  const group = (heading: string, list: Invitee[]) => (
    <div>
      <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-text-muted">{heading}</p>
      <ul className="grid gap-0.5 sm:grid-cols-2">
        {list.map((invitee) => {
          const on = chosen.includes(invitee.id);
          return (
            <li key={invitee.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-disabled={invitee.id === locked}
                onClick={() => toggle(invitee.id)}
                className={cn('flex w-full items-center gap-2 rounded-md px-1.5 text-left hover:bg-muted', touch ? 'min-h-11' : 'min-h-8', invitee.id === locked && 'cursor-default hover:bg-transparent')}
              >
                <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-primary bg-primary text-white' : 'border-input bg-white')}>
                  {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-text-main">
                    {invitee.name}
                    {invitee.id === locked ? <span className="font-normal text-text-muted"> (you)</span> : null}
                  </span>
                  <span className="block truncate text-[11px] text-text-muted">{invitee.detail}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div>
      <p className="text-xs font-semibold text-text-muted">
        Invitees <span className="font-normal">({chosen.length} chosen)</span>
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" className={chip} onClick={() => add(members.map((invitee) => invitee.id))}>
          + All members
        </button>
        <button type="button" className={chip} onClick={() => add(staff.filter((invitee) => !/Committee Staff$/.test(invitee.detail)).map((invitee) => invitee.id))}>
          + Secretariat
        </button>
        <select
          value=""
          onChange={(e) => e.target.value && add(committeeIds(e.target.value))}
          className={cn(chip, 'max-w-[12rem] pr-1')}
          aria-label="Add the members of a committee"
        >
          <option value="">+ Committee…</option>
          {mockCommittees.map((committee) => (
            <option key={committee.id} value={committee.id}>
              {committee.name}
            </option>
          ))}
        </select>
        {chosen.length > (locked ? 1 : 0) ? (
          <button type="button" className={cn(chip, 'text-text-muted')} onClick={() => setChosen(locked ? [locked] : [])}>
            Clear
          </button>
        ) : null}
      </div>
      <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-2">
        {group('Members', members)}
        {group('Staff', staff)}
      </div>
    </div>
  );
}
