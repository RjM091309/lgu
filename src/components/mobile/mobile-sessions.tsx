import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Clock, MapPin, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import type { Session } from '@/lib/mock-data';
import { useUsers } from '@/lib/access-store';
import { inviteesFor, rsvpOf, setRsvp, useAttendance, type RsvpStatus } from '@/lib/attendance';
import { nowInManila, useCalendarSessions } from '@/lib/esession-sync';
import { SESSION_TONE } from '@/lib/sessions';
import { useMobile } from '@/components/mobile/mobile-context';
import { BottomSheet, StatusChip, dateParts, typeLabel, type MyStatus } from '@/components/mobile/mobile-ui';
import { cn } from '@/lib/utils';

const DECLINE_REASONS = ['On official travel', 'On leave', 'Schedule conflict', 'Health reasons'];

export interface MySession {
  session: Session;
  invited: boolean;
  status: MyStatus;
  invitedCount: number;
  confirmed: number;
}

/** Sessions the signed-in account is invited to (the Administrator sees every session), with its reply. */
export function useMySessions(): MySession[] {
  const { account } = useMobile();
  const sessions = useCalendarSessions();
  const users = useUsers();
  const attendance = useAttendance();
  return useMemo(
    () =>
      sessions.flatMap((session) => {
        const invitees = inviteesFor(session, users);
        const invited = invitees.some((invitee) => invitee.id === account.inviteeId);
        if (!invited && !account.canManage) return [];
        return [
          {
            session,
            invited,
            status: invited ? rsvpOf(attendance, session.id, account.inviteeId)?.status ?? 'none' : 'none',
            invitedCount: invitees.length,
            confirmed: invitees.filter((invitee) => rsvpOf(attendance, session.id, invitee.id)?.status === 'attending').length,
          },
        ];
      }),
    [sessions, users, attendance, account]
  );
}

/** One session in a list: date, title, time and place, and the account's reply. */
export function SessionCard({ entry, muted = false }: { entry: MySession; muted?: boolean }) {
  const { account } = useMobile();
  const { session } = entry;
  const parts = dateParts(session.date);
  return (
    <Link
      to={`/m/session/${session.id}`}
      className={cn('flex items-stretch gap-3 rounded-xl border border-border bg-white p-3 shadow-sm transition-colors active:bg-muted', muted && 'opacity-70')}
    >
      <div className={cn('flex w-14 shrink-0 flex-col items-center justify-center rounded-lg py-1.5', SESSION_TONE[session.type])}>
        <span className="text-[10px] font-semibold uppercase opacity-80">{parts.month}</span>
        <span className="text-xl font-bold leading-none tabular-nums">{parts.day}</span>
        <span className="text-[10px] font-medium opacity-80">{parts.weekday}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{typeLabel(session.type)}</p>
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-text-main">{session.title}</p>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-text-muted">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="shrink-0 whitespace-nowrap">{session.time}</span>
          <MapPin className="ml-1.5 h-3 w-3 shrink-0" />
          <span className="truncate">{session.location}</span>
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {entry.invited ? <StatusChip status={entry.status} /> : null}
          {/* Others' replies are for the Administrator only, as on the web calendar. */}
          {account.canManage ? (
            <span className="text-[11px] text-text-muted">
              {entry.confirmed}/{entry.invitedCount} confirmed
            </span>
          ) : null}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 self-center text-text-muted" />
    </Link>
  );
}

/** The account's own reply to an invitation: attend, or decline with a reason. */
export function RsvpButtons({ session, status, compact = false }: { session: Session; status: MyStatus; compact?: boolean }) {
  const { account } = useMobile();
  const attendance = useAttendance();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');

  const respond = (next: RsvpStatus | null, why?: string) => {
    setRsvp(session.id, account.inviteeId, next ? { status: next, reason: why?.trim() || undefined, respondedAt: nowInManila(), recordedBy: account.name } : null);
    navigator.vibrate?.(40);
    if (next === 'attending') toast('See you there', `You confirmed attendance for ${session.title}.`);
    else if (next === 'declined') toast('Reply sent', `The Secretariat was told you cannot attend ${session.title}.`, 'info');
    else toast('Reply cleared', `${session.title} is back to awaiting your reply.`, 'info');
  };

  const openDecline = () => {
    setReason(rsvpOf(attendance, session.id, account.inviteeId)?.reason ?? '');
    setDeclineOpen(true);
  };

  const height = compact ? 'h-10' : 'h-12';
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={status === 'attending' ? 'default' : 'outline'}
          className={cn(height, 'text-sm', status === 'attending' ? 'bg-green-600 hover:bg-green-700' : 'border-green-600/40 bg-white text-green-800')}
          onClick={() => respond('attending')}
          aria-pressed={status === 'attending'}
        >
          <Check className="mr-1.5 h-4 w-4" strokeWidth={3} />
          {status === 'attending' ? 'Attending' : 'I will attend'}
        </Button>
        <Button
          type="button"
          variant={status === 'declined' ? 'default' : 'outline'}
          className={cn(height, 'text-sm', status === 'declined' ? 'bg-red-600 hover:bg-red-700' : 'border-red-600/40 bg-white text-red-800')}
          onClick={openDecline}
          aria-pressed={status === 'declined'}
        >
          <X className="mr-1.5 h-4 w-4" strokeWidth={3} />
          {status === 'declined' ? 'Not attending' : "I can't attend"}
        </Button>
      </div>
      {status !== 'none' && !compact ? (
        <button type="button" onClick={() => respond(null)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-text-muted">
          <Undo2 className="h-3.5 w-3.5" />
          Clear my reply
        </button>
      ) : null}

      <BottomSheet open={declineOpen} onClose={() => setDeclineOpen(false)} title="Can't attend">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            respond('declined', reason);
            setDeclineOpen(false);
          }}
        >
          <p className="text-sm text-text-muted">{session.title}. The reason is shown to the Secretariat only.</p>
          <div className="flex flex-wrap gap-2">
            {DECLINE_REASONS.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setReason(entry)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  reason === entry ? 'border-primary bg-primary text-white' : 'border-border text-text-main'
                )}
              >
                {entry}
              </button>
            ))}
          </div>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" maxLength={200} className="h-11 text-base" aria-label="Reason" />
          <Button type="submit" className="h-12 w-full bg-red-600 text-base hover:bg-red-700">
            Send reply
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}
