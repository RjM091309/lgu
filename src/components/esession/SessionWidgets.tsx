import { CalendarDays, CheckCircle2, Circle, Clock, History, MapPin, Radio, Users, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUsers } from '@/lib/access-store';
import { inviteesFor, rsvpOf, useAttendance } from '@/lib/attendance';
import { quorumFor, useLobby, type RoomSummary } from '@/lib/esession-room';
import type { Session } from '@/lib/mock-data';
import { buildAgenda, formatLongDate, isOfficial } from '@/lib/sessions';
import { SESSION_TYPE_TONE, dayMonth } from '@/components/dashboard/widgets';
import { SegmentMeter } from '@/components/dashboard/charts';
import { useNow } from '@/components/esession-room/es-ui';
import { esessionPath } from '@/components/esession/use-open-esession';
import { cn } from '@/lib/utils';

// Pieces shared by the Staff Portal dashboard and the E-Session Monitor: what is live in E-Session right now, the
// next sitting with its replies, and what is coming up. All of it is the server's data, the same on every device.

const typeLabel = (type: Session['type']) => (type === 'Committee Hearing' ? 'Hearing' : type);

const clock = (ms: number) => {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

/** Who replied to an invitation, and whether enough members said they will come for a quorum. */
export function useReplies(session: Session | undefined) {
  const users = useUsers();
  const rsvps = useAttendance();
  if (!session) return null;
  const invitees = inviteesFor(session, users);
  const status = (id: string) => rsvpOf(rsvps, session.id, id)?.status ?? 'none';
  const attending = invitees.filter((invitee) => status(invitee.id) === 'attending').length;
  const declined = invitees.filter((invitee) => status(invitee.id) === 'declined').length;
  const membersAttending = invitees.filter((invitee) => invitee.group === 'member' && status(invitee.id) === 'attending').length;
  const { memberTotal, quorum } = quorumFor(session, users);
  return { total: invitees.length, attending, declined, waiting: invitees.length - attending - declined, membersAttending, memberTotal, quorum, official: isOfficial(session) };
}

/** The sitting coming up next: when and where, the replies so far, and a way into E-Session. */
export function NextSittingCard({ session, room, onOpenESession }: { session: Session | undefined; room: RoomSummary | undefined; onOpenESession?: (path: string) => void }) {
  const replies = useReplies(session);
  if (!session || !replies) {
    return <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">Nothing is scheduled yet. Sessions and meetings appear here once they are on the calendar.</p>;
  }
  const quorumOk = replies.membersAttending >= replies.quorum;
  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', SESSION_TYPE_TONE[session.type])}>{session.type}</span>
          {room ? <RoomBadge room={room} /> : null}
        </div>
        <h3 className="mt-2 text-lg font-bold leading-snug text-text-main">{session.title}</h3>
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatLongDate(session.date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {session.time}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{session.location}</span>
          </span>
        </p>
        <p className="mt-3 text-xs text-text-muted">
          {buildAgenda(session).length} agenda item{buildAgenda(session).length === 1 ? '' : 's'} · {replies.total} invited
        </p>
        {onOpenESession ? (
          <Button className={cn('mt-4 h-10', room && !room.onHold && 'bg-red-600 hover:bg-red-700 hover:opacity-100')} onClick={() => onOpenESession(esessionPath(session.id))}>
            <Video className="mr-2 h-4 w-4" />
            {room ? (room.onHold ? 'Open in E-Session' : `Join · ${room.participantCount} in the room`) : 'Open in E-Session'}
          </Button>
        ) : null}
      </div>
      <div className="w-full shrink-0 rounded-lg border border-border bg-muted/30 p-4 lg:w-64">
        <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Replies</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Attending', value: replies.attending, tone: 'text-green-700' },
            { label: 'Not coming', value: replies.declined, tone: 'text-red-700' },
            { label: 'No reply', value: replies.waiting, tone: 'text-amber-700' },
          ].map((item) => (
            <div key={item.label}>
              <p className={cn('text-xl font-bold tabular-nums', item.tone)}>{item.value}</p>
              <p className="text-[10px] text-text-muted">{item.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <SegmentMeter
            segments={[
              { label: 'attending', value: replies.attending, color: '#15803d' },
              { label: 'not coming', value: replies.declined, color: '#dc2626' },
              { label: 'no reply', value: replies.waiting, color: '#d1d5db' },
            ]}
          />
        </div>
        {replies.official ? (
          <p className={cn('mt-3 flex items-start gap-1.5 text-xs font-medium', quorumOk ? 'text-green-700' : 'text-amber-700')}>
            {quorumOk ? <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" /> : <Circle className="mt-px h-3.5 w-3.5 shrink-0" />}
            {quorumOk ? `Quorum expected: ${replies.membersAttending} members confirmed (${replies.quorum} needed).` : `${replies.membersAttending} of the ${replies.quorum} members needed for a quorum have confirmed.`}
          </p>
        ) : (
          <p className="mt-3 text-xs text-text-muted">A meeting: no quorum is needed.</p>
        )}
      </div>
    </div>
  );
}

/** LIVE with a running timer, or on hold while nobody is in the call. */
export function RoomBadge({ room }: { room: RoomSummary }) {
  const now = useNow(room.onHold ? null : 1000);
  if (room.onHold) return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-300">On hold</span>;
  return (
    <span data-fixed-dark className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden />
      Live · {clock(now - (room.liveSince ?? room.startedAt))}
    </span>
  );
}

/**
 * The e-sessions running now and the ones that ended since the server started, newest first. `detailed` adds who is
 * in each room and the links to its record (the E-Session Monitor).
 */
export function LiveSessionsList({ sessions, onOpenESession, detailed = false, endedLimit = 4 }: { sessions: Session[]; onOpenESession?: (path: string) => void; detailed?: boolean; endedLimit?: number }) {
  const { live, ended } = useLobby();
  const users = useUsers();
  const recent = [...ended].sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)).slice(0, endedLimit);
  if (!live.length && !recent.length) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
        <Radio className="h-4 w-4 shrink-0" />
        No e-session is running. Started sittings show here, live, on every computer.
      </p>
    );
  }
  const membersOf = (room: RoomSummary) => room.participants.filter((person) => person.group === 'member').length;
  return (
    <ul className="space-y-2.5">
      {live.map((room) => {
        const session = sessions.find((entry) => entry.id === room.sessionId);
        const quorum = session && isOfficial(session) ? quorumFor(session, users) : null;
        return (
          <li key={room.roomId} className="rounded-lg border border-red-200 bg-red-50/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <RoomBadge room={room} />
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', SESSION_TYPE_TONE[room.type])}>{typeLabel(room.type)}</span>
              {room.recording ? <span className="rounded-full bg-red-600/10 px-2 py-0.5 text-[10px] font-bold text-red-700">● Recording</span> : null}
            </div>
            <p className="mt-1.5 text-sm font-semibold text-text-main">{room.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-text-muted">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {room.onHold ? 'Nobody in the room yet' : `${room.participantCount} in the room`}
              </span>
              {quorum ? (
                <span className={cn('font-semibold', membersOf(room) >= quorum.quorum ? 'text-green-700' : 'text-amber-700')}>
                  {membersOf(room)}/{quorum.memberTotal} members · {membersOf(room) >= quorum.quorum ? 'quorum' : `${quorum.quorum} needed`}
                </span>
              ) : null}
              <span>Started by {room.startedBy.name}</span>
            </p>
            {room.agendaItem ? (
              <p className="mt-1 truncate text-xs text-text-main" title={room.agendaItem}>
                <span className="font-semibold text-[#8a6a12]">Now:</span> {room.agendaItem}
              </p>
            ) : null}
            {detailed && room.participants.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {room.participants.map((person) => (
                  <li key={person.inviteeId} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-text-main ring-1 ring-inset ring-border">
                    {person.name}
                    {person.device ? <span className="text-text-muted"> · {person.device}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {onOpenESession ? (
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button size="sm" className="h-8 bg-red-600 text-xs hover:bg-red-700 hover:opacity-100" onClick={() => onOpenESession(esessionPath(room.sessionId))}>
                  <Video className="mr-1.5 h-3.5 w-3.5" />
                  Open in E-Session
                </Button>
              </div>
            ) : null}
          </li>
        );
      })}
      {recent.map((room) => (
        <li key={room.roomId} className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-text-muted">Ended {room.endedAt ? new Date(room.endedAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : ''}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', SESSION_TYPE_TONE[room.type])}>{typeLabel(room.type)}</span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-text-main">{room.title}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {clock((room.endedAt ?? Date.now()) - (room.liveSince ?? room.startedAt))} · {room.attendeeCount} attended{room.endedBy ? ` · ended by ${room.endedBy.name}` : ''}
          </p>
          {detailed && onOpenESession ? (
            <Button size="sm" variant="outline" className="mt-2.5 h-8 text-xs" onClick={() => onOpenESession(`/es/history/${room.roomId}`)}>
              <History className="mr-1.5 h-3.5 w-3.5" />
              Record of this e-session
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The next few sittings, one line each, with how many replied. */
export function ComingUpList({ sessions, onSelect }: { sessions: Session[]; onSelect?: (session: Session) => void }) {
  if (!sessions.length) return <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-text-muted">Nothing else is scheduled.</p>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {sessions.map((session) => (
        <ComingUpRow key={session.id} session={session} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function ComingUpRow({ session, onSelect }: { session: Session; onSelect?: (session: Session) => void }) {
  const replies = useReplies(session);
  const content = (
    <>
      <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
        <span className="text-[9px] font-bold uppercase">{dayMonth(session.date).split(' ')[0]}</span>
        <span className="text-base font-bold leading-none">{Number(session.date.slice(8))}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cn('shrink-0 rounded-full px-2 py-px text-[10px] font-semibold', SESSION_TYPE_TONE[session.type])}>{typeLabel(session.type)}</span>
          <span className="text-[11px] text-text-muted">{session.time}</span>
        </span>
        <span className="mt-0.5 block truncate text-sm font-medium text-text-main" title={session.title}>
          {session.title}
        </span>
      </span>
      {replies ? (
        <span className="shrink-0 text-right text-[11px] text-text-muted">
          <span className="block font-semibold tabular-nums text-text-main">
            {replies.attending + replies.declined}/{replies.total}
          </span>
          replied
        </span>
      ) : null}
    </>
  );
  return (
    <li>
      {onSelect ? (
        <button type="button" onClick={() => onSelect(session)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-primary/[0.03]">
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2.5">{content}</div>
      )}
    </li>
  );
}
