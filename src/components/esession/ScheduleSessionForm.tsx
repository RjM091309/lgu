import { useState, type FormEvent } from 'react';
import { AlertTriangle, CalendarPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LGU_PROFILE, mockCommittees, type Session } from '@/lib/mock-data';
import { inviteesFor } from '@/lib/attendance';
import { useUsers } from '@/lib/access-store';
import { useHolidays } from '@/lib/holidays';
import { todayInManila } from '@/lib/session-files';
import { newSessionId, nowInManila, scheduleSession, useCalendarSessions } from '@/lib/esession-sync';
import { cn } from '@/lib/utils';

const TYPES: Session['type'][] = ['Regular', 'Special', 'Committee Hearing'];

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

const selectClass =
  'h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-ring/30';

interface ScheduleSessionFormProps {
  /** Who is scheduling, for the notice sent to invitees. */
  scheduledBy: string;
  onScheduled: (session: Session) => void;
  onCancel: () => void;
  /** Larger touch targets for the mobile app. */
  touch?: boolean;
}

/** Schedules a session or hearing; everyone the session concerns is invited and notified. */
export function ScheduleSessionForm({ scheduledBy, onScheduled, onCancel, touch = false }: ScheduleSessionFormProps) {
  const sessions = useCalendarSessions();
  const users = useUsers();
  const today = todayInManila();

  const nextRegularTitle = () => {
    const numbers = sessions.map((entry) => Number(entry.title.match(/^(\d+)(?:st|nd|rd|th) Regular Session/)?.[1] ?? 0));
    return `${ordinal(Math.max(0, ...numbers) + 1)} Regular Session`;
  };
  const defaultTitle = (type: Session['type']) => (type === 'Regular' ? nextRegularTitle() : type === 'Special' ? 'Special Session' : 'Public Hearing: ');

  const [type, setType] = useState<Session['type']>('Regular');
  const [committeeId, setCommitteeId] = useState(mockCommittees[0].id);
  const [title, setTitle] = useState(() => defaultTitle('Regular'));
  const [titleEdited, setTitleEdited] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [location, setLocation] = useState(LGU_PROFILE.sessionHall);
  const [error, setError] = useState('');

  const { byDate: holidaysByDate } = useHolidays(Number((date || today).slice(0, 4)));
  const holiday = date ? holidaysByDate.get(date) : undefined;
  const weekday = date ? new Date(`${date}T00:00:00`).getDay() : null;
  const sameDay = date ? sessions.filter((entry) => entry.date === date) : [];

  const draft: Session = {
    id: '',
    title: title.trim(),
    date,
    time: time ? toSessionTime(time) : '',
    location: location.trim(),
    type,
    ...(type === 'Committee Hearing' ? { committeeId } : {}),
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
    if (!draft.title || draft.title === 'Public Hearing:') return setError('Enter a title for the session.');
    if (!date) return setError('Choose the date of the session.');
    if (date < today) return setError('The date has already passed. Choose today or a later date.');
    if (!time) return setError('Choose the start time.');
    if (!draft.location) return setError('Enter the venue.');
    const session = { ...draft, id: newSessionId() };
    scheduleSession(session, scheduledBy, nowInManila());
    onScheduled(session);
  };

  const fieldHeight = touch ? 'h-11 text-base' : '';
  const label = 'text-xs font-semibold text-text-muted';

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <div>
        <p className={label}>Type</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Session type">
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

      {type === 'Committee Hearing' ? (
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
        <span className={label}>Title</span>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleEdited(true);
          }}
          className={cn('mt-1.5', fieldHeight)}
          maxLength={160}
        />
      </label>

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

      <label className="block">
        <span className={label}>Venue</span>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} className={cn('mt-1.5', fieldHeight)} maxLength={160} />
      </label>

      {holiday || weekday === 0 || weekday === 6 || sameDay.length ? (
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
          {invitees.length} will be invited and notified in the mobile app: {memberCount} {type === 'Committee Hearing' ? 'committee members' : 'members'} and{' '}
          {invitees.length - memberCount} Secretariat staff.
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
          <CalendarPlus className="mr-2 h-4 w-4" />
          Schedule and notify
        </Button>
      </div>
    </form>
  );
}
