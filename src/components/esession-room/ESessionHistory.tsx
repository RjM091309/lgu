import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ClipboardList, Download, FileText, History, MessageSquare, Mic, Timer, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { logActivity } from '@/lib/activity-log';
import { useUsers } from '@/lib/access-store';
import { inviteesFor } from '@/lib/attendance';
import { useCalendarSessions } from '@/lib/esession-sync';
import type { MobileAccount } from '@/lib/mobile-accounts';
import { formatLongDate } from '@/lib/sessions';
import { cn } from '@/lib/utils';
import { ROLE_LABEL, clockTime, clockTimeWithSeconds, dateTime, durationText, fetchAudit, timeInRoom, useLobby, type RoomAudit, type RoomSummary } from '@/lib/esession-room';
import { EVENT_GROUP, EVENT_GROUP_LABEL, attendanceRecordName, attendanceRecordPdf, eventText, exportAuditCsv, type EventGroup } from '@/lib/esession-records';
import { EsHeader, LiveBadge, PersonAvatar, TypeBadge, useNow } from '@/components/esession-room/es-ui';

const canSee = (account: MobileAccount, room: RoomSummary) => account.canManage || room.invitees.includes(account.inviteeId);

export function ESessionHistory({ account, onSignOut }: { account: MobileAccount; onSignOut: () => void }) {
  const { live, ended } = useLobby();
  const rooms = [...live, ...ended].filter((room) => canSee(account, room)).sort((a, b) => b.startedAt - a.startedAt);
  const now = useNow(30_000);

  return (
    <>
      <EsHeader account={account} onSignOut={onSignOut} />
      <main className="mx-auto max-w-6xl space-y-5 px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-6 md:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">E-Session History</h1>
          <p className="text-sm text-text-muted">Who joined, when, and everything that happened in each e-session, as recorded by the LIMS server.</p>
        </div>
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
            <History className="h-10 w-10 text-primary/40" />
            <p className="font-semibold text-text-main">No e-sessions yet</p>
            <p className="max-w-md text-sm text-text-muted">E-sessions held since the LIMS server last started appear here. Each one’s attendance record is also saved to its folder in Session Files.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rooms.map((room) => (
              <li key={room.roomId}>
                <Link
                  to={`/es/history/${room.roomId}`}
                  className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.02] sm:p-5"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
                    <ClipboardList className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {room.status === 'live' ? <LiveBadge onHold={room.onHold} /> : null}
                      <TypeBadge type={room.type} />
                    </span>
                    <span className="mt-1 block truncate font-semibold text-text-main">{room.title}</span>
                    <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-text-muted">
                      <span>{dateTime(room.startedAt)}</span>
                      <span>{durationText((room.endedAt ?? now) - (room.liveSince ?? room.startedAt))}</span>
                      <span>
                        {room.attendeeCount} attendee{room.attendeeCount === 1 ? '' : 's'}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

const FILTERS: ('all' | EventGroup)[] = ['all', 'attendance', 'floor', 'moderation', 'recording', 'chat'];

export function ESessionRecord({ account, onSignOut }: { account: MobileAccount; onSignOut: () => void }) {
  const { roomId = '' } = useParams();
  const [audit, setAudit] = useState<RoomAudit | null | 'loading'>('loading');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const isLive = audit !== null && audit !== 'loading' && audit.room.status === 'live';
  const now = useNow(isLive ? 15_000 : null);
  // The invitation list names the members who never joined, in the PDF.
  const users = useUsers();
  const sessions = useCalendarSessions();

  // A live e-session's record keeps filling in, so it is refreshed while open.
  useEffect(() => {
    let cancelled = false;
    const load = () => void fetchAudit(roomId).then((result) => !cancelled && setAudit(result));
    load();
    const timer = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [roomId]);

  const events = useMemo(() => (audit && audit !== 'loading' ? [...audit.events].reverse().filter((event) => filter === 'all' || EVENT_GROUP[event.type] === filter) : []), [audit, filter]);

  if (audit === 'loading') return <RecordShell account={account} onSignOut={onSignOut} message="Loading the record…" />;
  if (!audit || !canSee(account, audit.room)) return <RecordShell account={account} onSignOut={onSignOut} message="This record is not available. Records are kept until the LIMS server restarts; the attendance record stays in Session Files." />;

  const { room } = audit;
  const end = room.endedAt ?? now;
  const membersPresent = audit.attendance.filter((entry) => entry.group === 'member').length;
  const attendance = [...audit.attendance].sort((a, b) => Number(a.group !== 'member') - Number(b.group !== 'member') || a.stints[0].joinedAt - b.stints[0].joinedAt);

  const downloadPdf = () => {
    const session = sessions.find((entry) => entry.id === room.sessionId);
    const url = URL.createObjectURL(attendanceRecordPdf(audit, session ? inviteesFor(session, users) : []));
    const link = document.createElement('a');
    link.href = url;
    link.download = attendanceRecordName(audit);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    logActivity({ user: account.username, module: 'E-Session', action: 'Exported', summary: `Downloaded the e-session attendance record of the ${room.title}` });
  };
  const downloadCsv = () => {
    if (!exportAuditCsv(audit)) return toast('Download failed', 'The browser blocked the download.', 'error');
    logActivity({ user: account.username, module: 'E-Session', action: 'Exported', summary: `Exported the e-session record of the ${room.title}`, detail: `${audit.events.length} events` });
  };

  // A meeting has no quorum and no roll call.
  const meeting = room.type === 'Meeting';
  const stats = [
    { label: 'Duration', value: durationText(end - (room.liveSince ?? room.startedAt)), icon: Timer },
    meeting
      ? { label: 'Members present', value: String(membersPresent), icon: Users, hint: 'Meeting · not an official session' }
      : { label: 'Members present', value: `${membersPresent}/${audit.memberTotal}`, icon: Users, hint: membersPresent >= audit.quorum ? 'Quorum reached' : `Quorum is ${audit.quorum}` },
    ...(meeting ? [] : [{ label: 'Roll calls', value: String(audit.rollCalls.length), icon: ClipboardList }]),
    { label: 'Chat messages', value: String(audit.chat.length), icon: MessageSquare },
  ];

  return (
    <>
      <EsHeader account={account} onSignOut={onSignOut} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-6 md:px-8">
        <Link to="/es/history" className="inline-flex h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          All e-sessions
        </Link>
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-white p-5 shadow-sm md:flex-row md:items-start md:justify-between md:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {isLive ? <LiveBadge since={room.liveSince} onHold={room.onHold} /> : <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">Ended</span>}
              <TypeBadge type={room.type} />
            </div>
            <h1 className="mt-2 text-xl font-bold text-text-main">{room.title}</h1>
            <p className="mt-1 text-sm text-text-muted">
              Scheduled {formatLongDate(room.date)}, {room.time}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Started {dateTime(room.startedAt)} by {room.startedBy.name}
              {room.endedAt ? ` · Ended ${clockTime(room.endedAt)}${room.endedBy ? ` by ${room.endedBy.name}` : ' automatically'}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={downloadCsv} className="h-11 bg-white">
              <Download className="mr-2 h-4 w-4" />
              Full record (CSV)
            </Button>
            <Button onClick={downloadPdf} className="h-11">
              <FileText className="mr-2 h-4 w-4" />
              Attendance (PDF)
            </Button>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted">{stat.label}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                  <stat.icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-text-main">{stat.value}</p>
              {stat.hint ? <p className="mt-1 text-xs text-text-muted">{stat.hint}</p> : null}
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-text-main">Attendance</h2>
            <p className="text-xs text-text-muted">Times from the LIMS server’s clock (Philippine Standard Time)</p>
          </header>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>First joined</TableHead>
                <TableHead>Last left</TableHead>
                <TableHead>Time in session</TableHead>
                <TableHead>Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.map((entry) => {
                const last = entry.stints.at(-1);
                return (
                  <TableRow key={entry.inviteeId}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <PersonAvatar abbr={entry.abbr} group={entry.group} className="h-8 w-8 text-[10px]" />
                        <span className="min-w-0">
                          <span className="block font-semibold text-text-main">{entry.name}</span>
                          <span className="block text-xs font-normal text-text-muted">{entry.detail}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>{ROLE_LABEL[entry.role]}</TableCell>
                    <TableCell className="tabular-nums">{clockTimeWithSeconds(entry.stints[0].joinedAt)}</TableCell>
                    <TableCell className="tabular-nums">
                      {last?.leftAt ? clockTimeWithSeconds(last.leftAt) : <span className="font-semibold text-green-700">In the room</span>}
                      {last?.reason && last.leftAt ? <span className="block text-xs text-text-muted">{last.reason}</span> : null}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {durationText(timeInRoom(entry, end))}
                      {entry.stints.length > 1 ? <span className="block text-xs text-text-muted">Joined {entry.stints.length} times</span> : null}
                    </TableCell>
                    <TableCell className="text-xs text-text-muted">{[...new Set(entry.stints.map((stint) => stint.device))].join(', ')}</TableCell>
                  </TableRow>
                );
              })}
              {attendance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-text-muted">
                    Nobody has joined yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <header className="flex flex-col gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-text-main">Audit trail</h2>
                <p className="text-xs text-text-muted">{audit.events.length} events, newest first</p>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show events">
                {FILTERS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFilter(option)}
                    aria-pressed={filter === option}
                    className={cn('h-9 rounded-full px-3 text-xs font-semibold transition-colors', filter === option ? 'bg-primary text-white' : 'bg-muted text-text-muted hover:text-text-main')}
                  >
                    {option === 'all' ? 'All' : EVENT_GROUP_LABEL[option]}
                  </button>
                ))}
              </div>
            </header>
            <ol className="max-h-[32rem] divide-y divide-border overflow-y-auto">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3 px-5 py-3">
                  <span className="w-20 shrink-0 pt-0.5 text-xs tabular-nums text-text-muted">{clockTimeWithSeconds(event.at)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-main">{eventText(event)}</p>
                    {event.detail ? <p className="mt-0.5 break-words text-xs text-text-muted">{event.detail}</p> : null}
                  </div>
                  <span className="hidden shrink-0 self-start rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-text-muted sm:inline">{EVENT_GROUP_LABEL[EVENT_GROUP[event.type]]}</span>
                </li>
              ))}
              {events.length === 0 ? <li className="px-5 py-8 text-center text-sm text-text-muted">No events of this kind.</li> : null}
            </ol>
          </section>

          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-text-main">Roll calls</h2>
              {audit.rollCalls.length ? (
                <ul className="mt-3 space-y-3">
                  {audit.rollCalls.map((call) => (
                    <li key={call.at} className="rounded-lg bg-muted/60 p-3 text-sm">
                      <p className="font-semibold text-text-main">
                        {clockTime(call.at)} · {call.presentCount} of {call.memberTotal} present
                        <span className={cn('ml-2 text-xs', call.hasQuorum ? 'text-green-700' : 'text-amber-700')}>{call.hasQuorum ? 'Quorum' : 'No quorum'}</span>
                      </p>
                      <p className="mt-1 text-xs text-text-muted">{call.present.map((person) => person.name).join(', ') || 'No members present'}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-text-muted">The roll was not called during this e-session.</p>
              )}
            </section>
            <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <header className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-text-main">Chat</h2>
              </header>
              {audit.chat.length ? (
                <ul className="max-h-80 space-y-3 overflow-y-auto p-5">
                  {audit.chat.map((message) => (
                    <li key={message.id} className="text-sm">
                      <p className="text-xs text-text-muted">
                        <span className="font-semibold text-text-main">{message.from.name}</span> · {clockTime(message.at)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-text-main">{message.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-5 text-sm text-text-muted">No messages.</p>
              )}
            </section>
            {audit.events.some((event) => event.type === 'recording-saved') ? (
              <p className="flex gap-2 rounded-xl border border-border bg-white p-4 text-sm text-text-muted shadow-sm">
                <Mic className="h-5 w-5 shrink-0 text-primary" />
                The audio recording was saved to this session’s folder in Session Files on the host’s device.
              </p>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
}

function RecordShell({ account, onSignOut, message }: { account: MobileAccount; onSignOut: () => void; message: string }) {
  return (
    <>
      <EsHeader account={account} onSignOut={onSignOut} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 pt-6 md:px-8">
        <Link to="/es/history" className="inline-flex h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          All e-sessions
        </Link>
        <p className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-text-muted">{message}</p>
      </main>
    </>
  );
}
