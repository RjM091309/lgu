import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, CalendarPlus, CheckCircle2, ChevronDown, Clock, EyeOff, Headphones, Lock, MapPin, Pencil, Play, ShieldCheck, Trash2, Users, Video, Wifi, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { confirmAction } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { ScheduleSessionForm } from '@/components/esession/ScheduleSessionForm';
import { useUsers } from '@/lib/access-store';
import { logActivity } from '@/lib/activity-log';
import { committeeNameOf, rsvpOf, useAttendance } from '@/lib/attendance';
import { CHANGE_REFUSED, canChangeSession, cancelScheduledSession, useCalendarSessions, useStartedSessions } from '@/lib/esession-sync';
import { isInvited, type MobileAccount } from '@/lib/mobile-accounts';
import type { Session } from '@/lib/mock-data';
import { formatLongDate } from '@/lib/sessions';
import { todayInManila } from '@/lib/session-files';
import { cn } from '@/lib/utils';
import { roleIn, roleLabelFor, useLobby, type RoomSummary } from '@/lib/esession-room';
import { EsHeader, InsecureNotice, LiveBadge, PersonAvatar, RoleBadge, TypeBadge } from '@/components/esession-room/es-ui';

const UPCOMING_LIMIT = 8;

const greeting = () => {
  const hour = Number(new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
};

const dayParts = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  return { day: date.getDate(), month: date.toLocaleDateString('en-PH', { month: 'short' }), weekday: date.toLocaleDateString('en-PH', { weekday: 'short' }) };
};

/** What the schedule dialog is open for: a new session, a meeting starting now, or changes to one already set. */
type Planning = { mode: 'schedule' } | { mode: 'start-now' } | { mode: 'edit'; session: Session };

export function ESessionLobby({ account, onSignOut }: { account: MobileAccount; onSignOut: () => void }) {
  const users = useUsers();
  const sessions = useCalendarSessions();
  const { live, status } = useLobby();
  const started = useStartedSessions();
  const [planning, setPlanning] = useState<Planning | null>(null);
  const rsvps = useAttendance();
  const navigate = useNavigate();
  const today = todayInManila();

  // Hosts see every session; everyone else the ones they are invited to.
  const mine = useMemo(() => sessions.filter((session) => account.canManage || isInvited(session, users, account.inviteeId)), [sessions, users, account]);
  const liveRooms = live.filter((room) => account.canManage || room.invitees.includes(account.inviteeId));
  const liveBySession = new Map(liveRooms.map((room) => [room.sessionId, room]));
  const todays = mine.filter((session) => session.date === today);
  const upcoming = mine.filter((session) => session.date > today).slice(0, UPCOMING_LIMIT);
  // Sessions of the body this person is not invited to (mostly other committees' hearings): shown so they know
  // what is on, but without a way to join. Hosts already see everything above.
  const others = account.canManage ? [] : sessions.filter((session) => session.date >= today && !isInvited(session, users, account.inviteeId)).slice(0, UPCOMING_LIMIT);
  const othersToday = others.filter((session) => session.date === today).length;
  const anyLiveBySession = new Map(live.map((room) => [room.sessionId, room]));

  const start = async (session: Session) => {
    if (session.date !== today) {
      const confirmed = await confirmAction({
        title: 'Start this e-session early?',
        description: `${session.title} is scheduled for ${formatLongDate(session.date)}, ${session.time}. It starts when you join from the camera and microphone check, and invitees can join from then on.`,
        confirmLabel: 'Continue',
      });
      if (!confirmed) return;
    }
    // The e-session starts from the camera and microphone check, as the host goes in, so it never shows as live
    // while nobody is in it yet.
    navigate(`/es/session/${encodeURIComponent(session.id)}`);
  };

  const open = (session: Session) => navigate(`/es/session/${encodeURIComponent(session.id)}`);

  // The same rule as the calendar and LIMS Mobile: editable sessions only, before their e-session starts.
  const editable = (session: Session) => account.canManage && canChangeSession(session, started, today);
  const noun = (session: Session) => (session.type === 'Meeting' ? 'meeting' : 'session');

  const cancel = async (session: Session) => {
    const confirmed = await confirmAction({
      title: `Cancel ${session.title}?`,
      description: `The ${noun(session)} is removed from the calendar of everyone invited, together with their responses.`,
      confirmLabel: `Cancel ${noun(session)}`,
      cancelLabel: 'Keep',
      tone: 'destructive',
    });
    if (!confirmed) return;
    if (!(await cancelScheduledSession(session.id))) return toast('Not cancelled', `${session.title}: ${CHANGE_REFUSED}`, 'error');
    toast(session.type === 'Meeting' ? 'Meeting cancelled' : 'Session cancelled', `${session.title} was removed from the calendar.`);
    logActivity({ module: 'E-Session', action: 'Deleted', summary: `Cancelled ${session.title}`, detail: `${formatLongDate(session.date)}, ${session.time}` });
  };

  const planned = (session: Session) => {
    const mode = planning?.mode;
    setPlanning(null);
    if (mode === 'edit') {
      toast('Changes saved', `${session.title}: invitees were notified in the mobile app.`);
      logActivity({ module: 'E-Session', action: 'Updated', summary: `Changed ${session.title}`, detail: `${formatLongDate(session.date)}, ${session.time} · ${session.location}` });
      return;
    }
    if (mode === 'start-now') {
      logActivity({ module: 'E-Session', action: 'Created', summary: `Started a meeting: ${session.title}`, detail: `${session.invitees?.length ?? 0} invitees · ${session.location}` });
      // Straight to the camera and microphone check; the meeting goes live as the host enters.
      navigate(`/es/session/${encodeURIComponent(session.id)}`);
      return;
    }
    toast(`${session.type === 'Meeting' ? 'Meeting' : 'Session'} scheduled`, `${session.title} on ${formatLongDate(session.date)}. Invitees were notified in the mobile app.`);
    logActivity({ module: 'E-Session', action: 'Created', summary: `Scheduled ${session.title}`, detail: `${formatLongDate(session.date)}, ${session.time} · ${session.location}` });
  };

  return (
    <>
      <EsHeader account={account} onSignOut={onSignOut} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-text-muted">{formatLongDate(today)}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              {greeting()}, {account.name}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {account.canManage
                ? 'You host e-sessions: schedule and start them, admit participants, and keep the record.'
                : 'Join the e-sessions you are invited to. Your joining and leaving times are recorded.'}
            </p>
          </div>
          {account.canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setPlanning({ mode: 'schedule' })} disabled={status === 'offline'} className="h-11 bg-white px-4 font-semibold">
                <CalendarPlus className="mr-2 h-4 w-4" />
                Schedule
              </Button>
              <Button onClick={() => setPlanning({ mode: 'start-now' })} disabled={status === 'offline'} className="h-11 px-4 font-semibold">
                <Video className="mr-2 h-4 w-4" />
                Start a meeting
              </Button>
            </div>
          ) : null}
        </div>

        <BeforeYouJoin />

        <InsecureNotice />

        {status === 'offline' ? (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="status">
            <Wifi className="h-5 w-5 shrink-0" />
            The LIMS server cannot be reached right now. E-sessions will show here again once the connection is back.
          </div>
        ) : null}

        {liveRooms.length ? (
          <section aria-labelledby="live-heading" className="space-y-3">
            <h2 id="live-heading" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-red-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" aria-hidden />
              Live now
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {liveRooms.map((room) => {
                const session = sessions.find((entry) => entry.id === room.sessionId);
                const myRole = session ? roleIn(account, session) : 'participant';
                // "Join as Presiding Officer" / "as Host" says something; "as Participant" does not.
                return (
                  <LiveCard
                    key={room.roomId}
                    room={room}
                    role={session && myRole !== 'participant' ? roleLabelFor(myRole, session) : null}
                    wide={liveRooms.length === 1}
                    onJoin={() => navigate(`/es/session/${encodeURIComponent(room.sessionId)}`)}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Today, Upcoming and Other sessions share one shape: full width, cards in two equal columns. */}
        <section aria-labelledby="today-heading" className="space-y-3">
          <h2 id="today-heading" className="text-base font-semibold text-text-main">
            Today
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {todays.length ? (
              todays.map((session) => (
                <SessionCard
                  key={session.id}
                  wide={todays.length === 1}
                  session={session}
                  account={account}
                  room={liveBySession.get(session.id)}
                  rsvp={rsvpOf(rsvps, session.id, account.inviteeId)?.status}
                  onStart={() => void start(session)}
                  onOpen={() => open(session)}
                  onEdit={editable(session) ? () => setPlanning({ mode: 'edit', session }) : undefined}
                  onCancel={editable(session) ? () => void cancel(session) : undefined}
                />
              ))
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-white p-5 text-sm text-text-muted lg:col-span-2">
                <CalendarClock className="h-8 w-8 shrink-0 text-primary/40" />
                <span>
                  {account.canManage ? 'No sessions today.' : 'No sessions you are invited to today.'}{' '}
                  {othersToday ? `${othersToday === 1 ? 'Another session is' : `${othersToday} other sessions are`} on today; see Other sessions below.` : upcoming.length ? 'Upcoming sessions are listed below.' : 'Upcoming sessions are listed here once they are scheduled.'}
                </span>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="upcoming-heading" className="space-y-3">
          <h2 id="upcoming-heading" className="text-base font-semibold text-text-main">
            Upcoming
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {upcoming.length ? (
              upcoming.map((session) => (
                <SessionCard
                  key={session.id}
                  compact
                  wide={upcoming.length === 1}
                  session={session}
                  account={account}
                  room={liveBySession.get(session.id)}
                  rsvp={rsvpOf(rsvps, session.id, account.inviteeId)?.status}
                  onStart={() => void start(session)}
                  onOpen={() => open(session)}
                  onEdit={editable(session) ? () => setPlanning({ mode: 'edit', session }) : undefined}
                  onCancel={editable(session) ? () => void cancel(session) : undefined}
                />
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-white p-5 text-sm text-text-muted lg:col-span-2">No upcoming sessions you are invited to.</p>
            )}
          </div>
        </section>

        {others.length ? (
          <section aria-labelledby="others-heading" className="space-y-3">
            <div>
              <h2 id="others-heading" className="text-base font-semibold text-text-main">
                Other sessions
              </h2>
              <p className="text-sm text-text-muted">Sessions of the Sanggunian you are not invited to. They are listed so you know what is on; only their invitees can join.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {others.map((session) => (
                <OtherSessionCard key={session.id} session={session} room={anyLiveBySession.get(session.id)} today={session.date === today} wide={others.length === 1} />
              ))}
            </div>
          </section>
        ) : null}

        <Dialog open={planning !== null} onOpenChange={(value) => !value && setPlanning(null)}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl text-primary">
                {planning?.mode === 'start-now' ? 'Start a meeting' : planning?.mode === 'edit' ? `Edit ${noun(planning.session)}` : 'Schedule'}
              </DialogTitle>
              <DialogDescription>
                {planning?.mode === 'start-now'
                  ? 'An informal meeting that starts now. Invitees are notified in the mobile app and can join from their lobby.'
                  : planning?.mode === 'edit'
                    ? 'Invitees are notified of the change in the mobile app.'
                    : 'Everyone it concerns is invited and notified in the mobile app.'}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5">
              {planning ? (
                <ScheduleSessionForm
                  key={planning.mode === 'edit' ? planning.session.id : planning.mode}
                  scheduledBy={account.name}
                  scheduledById={account.inviteeId}
                  session={planning.mode === 'edit' ? planning.session : undefined}
                  startNow={planning.mode === 'start-now'}
                  onCancel={() => setPlanning(null)}
                  onScheduled={planned}
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}

/** A live e-session this person can join. `wide` (the only one live): spans both columns, with joining on the right. */
function LiveCard({ room, role, wide = false, onJoin }: { room: RoomSummary; role: string | null; wide?: boolean; onJoin: () => void }) {
  return (
    <article className={cn('relative overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-white to-red-50/60 p-5 shadow-sm', wide && 'lg:col-span-2 lg:flex lg:items-center lg:gap-8')}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <LiveBadge since={room.liveSince} onHold={room.onHold} />
          <TypeBadge type={room.type} />
          {room.recording ? <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-200">Recording</span> : null}
          {room.locked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-text-muted">
              <Lock className="h-3 w-3" />
              Locked
            </span>
          ) : null}
        </div>
        <h3 className="mt-3 text-lg font-bold text-text-main">{room.title}</h3>
        <p className="mt-1 text-sm text-text-muted">{room.onHold ? `On hold, waiting for the host · started by ${room.startedBy.name}` : `Started by ${room.startedBy.name}`}</p>
      </div>
      <div className={cn('mt-4 flex flex-wrap items-center justify-between gap-4', wide && 'lg:mt-0 lg:shrink-0 lg:justify-end lg:gap-6')}>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {room.participants.slice(0, 6).map((person) => (
              <PersonAvatar key={person.inviteeId} abbr={person.abbr} group={person.group} className="h-9 w-9 text-[10px] ring-2 ring-white" />
            ))}
          </div>
          <span className="text-sm font-semibold text-text-main">{room.onHold ? 'Nobody in the room yet' : `${room.participantCount} in the room`}</span>
        </div>
        <Button onClick={onJoin} className="h-12 min-w-36 bg-red-600 px-6 text-base font-bold hover:bg-red-700 hover:opacity-100">
          <Video className="mr-2 h-5 w-5" />
          Join{role ? ` as ${role}` : ''}
        </Button>
      </div>
    </article>
  );
}

function SessionCard({
  session,
  account,
  room,
  rsvp,
  compact = false,
  wide = false,
  onStart,
  onOpen,
  onEdit,
  onCancel,
}: {
  session: Session;
  account: MobileAccount;
  room: RoomSummary | undefined;
  rsvp: 'attending' | 'declined' | undefined;
  compact?: boolean;
  /** The only card in its section: spans both columns, with the action on the right. */
  wide?: boolean;
  onStart: () => void;
  onOpen: () => void;
  /** Set for sessions set up in the app that have not started: hosts can change or cancel them. */
  onEdit?: () => void;
  onCancel?: () => void;
}) {
  const role = roleIn(account, session);
  const { day, month, weekday } = dayParts(session.date);
  return (
    <article className={cn('flex gap-4 rounded-xl border bg-white shadow-sm', compact ? 'p-4' : 'p-5', room ? 'border-red-200' : 'border-border', wide && 'lg:col-span-2')}>
      <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
        <span className="text-[10px] font-bold uppercase">{month}</span>
        <span className="text-xl font-bold leading-none">{day}</span>
        <span className="text-[10px] font-semibold uppercase text-text-muted">{weekday}</span>
      </div>
      <div className={cn('min-w-0 flex-1', wide && 'lg:flex lg:items-center lg:gap-6')}>
        <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge type={session.type} />
          {role !== 'participant' ? <RoleBadge role={role} label={roleLabelFor(role, session)} /> : null}
          {room ? <LiveBadge onHold={room.onHold} /> : null}
        </div>
        <h3 className={cn('mt-1.5 font-semibold text-text-main', compact ? 'text-sm' : 'text-base')}>{session.title}</h3>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {session.time}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{session.location}</span>
          </span>
          {rsvp ? (
            <span className={cn('inline-flex items-center gap-1 font-semibold', rsvp === 'attending' ? 'text-green-700' : 'text-red-700')}>
              {rsvp === 'attending' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {rsvp === 'attending' ? 'You said you will attend' : 'You said you can’t attend'}
            </span>
          ) : null}
        </p>
        </div>
        <div className={cn('mt-3 flex flex-wrap items-center gap-2', wide && 'lg:mt-0 lg:shrink-0 lg:flex-col lg:items-end lg:text-right')}>
          {room ? (
            <Button onClick={onOpen} className="h-11 bg-red-600 px-5 font-semibold hover:bg-red-700 hover:opacity-100">
              <Video className="mr-2 h-4 w-4" />
              {room.onHold ? 'Open · on hold' : `Join · ${room.participantCount} in the room`}
            </Button>
          ) : account.canManage ? (
            <Button onClick={onStart} variant={compact ? 'outline' : 'default'} className={cn('h-11 px-5 font-semibold', compact && 'bg-white')}>
              <Play className="mr-2 h-4 w-4 fill-current" />
              {compact ? 'Start early' : session.type === 'Meeting' ? 'Start meeting' : 'Start e-session'}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onOpen} className="h-11 bg-white px-5 font-semibold">
                <Video className="mr-2 h-4 w-4" />
                Check camera &amp; mic
              </Button>
              <span className="text-xs text-text-muted">{compact ? 'Not started yet' : 'The Secretariat will start it at the scheduled time.'}</span>
            </>
          )}
          {onEdit || onCancel ? (
            <div className="flex gap-1">
              {onEdit ? (
                <Button variant="ghost" size="sm" onClick={onEdit} className="h-9 px-2.5 text-xs font-semibold text-text-muted" aria-label={`Edit ${session.title}`}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              ) : null}
              {onCancel ? (
                <Button variant="ghost" size="sm" onClick={onCancel} className="h-9 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50" aria-label={`Cancel ${session.title}`}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** A session this person is not invited to: what, when and where, whether it is live, and no way in. */
function OtherSessionCard({ session, room, today, wide = false }: { session: Session; room: RoomSummary | undefined; today: boolean; wide?: boolean }) {
  const { day, month, weekday } = dayParts(session.date);
  const committee = committeeNameOf(session);
  return (
    <article className={cn('flex gap-4 rounded-xl border border-dashed border-border bg-surface/60 p-4', wide && 'lg:col-span-2')}>
      <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-text-muted">
        <span className="text-[10px] font-bold uppercase">{month}</span>
        <span className="text-xl font-bold leading-none">{day}</span>
        <span className="text-[10px] font-semibold uppercase">{weekday}</span>
      </div>
      <div className={cn('min-w-0 flex-1', wide && 'lg:flex lg:items-center lg:gap-6')}>
        <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge type={session.type} />
          {room ? <LiveBadge since={room.liveSince} onHold={room.onHold} /> : today ? <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-text-muted">Today</span> : null}
        </div>
        <h3 className="mt-1.5 text-sm font-semibold text-text-main">{session.title}</h3>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {session.time}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{session.location}</span>
          </span>
          {room && !room.onHold ? (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {room.participantCount} in the room
            </span>
          ) : null}
        </p>
        </div>
        <p className={cn('mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-text-muted', wide && 'lg:mt-0 lg:shrink-0')}>
          <EyeOff className="h-3.5 w-3.5 shrink-0" />
          Not invited{committee ? ` · for ${committee} members` : ''}
        </p>
      </div>
    </article>
  );
}

const TIPS = [
  { icon: Headphones, text: 'Use earphones when others in the same hall are also on the e-session, to avoid echo.' },
  { icon: Wifi, text: 'Stay on the Municipal Hall Wi-Fi. Turn off your camera if the sound breaks up.' },
  { icon: Users, text: 'Raise your hand to ask for the floor; the Presiding Officer recognizes speakers.' },
  { icon: ShieldCheck, text: 'Audio and video are encrypted and go only to the devices in the e-session.' },
];

/** The joining tips: open at first, and folded into one line whenever the person closes them. */
function BeforeYouJoin() {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-xl border border-border bg-white shadow-sm">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex min-h-12 w-full items-center justify-between gap-3 px-5 text-left" aria-expanded={open} aria-controls="es-tips">
        <span className="text-sm font-semibold text-text-main">
          Before you join <span className="font-normal text-text-muted">({TIPS.length} tips)</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <ul id="es-tips" className="grid gap-3 border-t border-border px-5 pb-5 pt-4 text-sm text-text-muted sm:grid-cols-2 lg:grid-cols-4">
          {TIPS.map((tip) => (
            <li key={tip.text} className="flex gap-3">
              <tip.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              {tip.text}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
