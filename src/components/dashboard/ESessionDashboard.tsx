import { useMemo } from 'react';
import { BarChart3, CalendarDays, Captions, ClipboardCheck, FileAudio, FileVideo, MailQuestion, Radio, UserCheck, Users } from 'lucide-react';
import { useAccess } from '@/lib/access-store';
import { useCalendarSessions, useTranscriptIndex } from '@/lib/esession-sync';
import { useLobby } from '@/lib/esession-room';
import { mockAttendanceMarks, mockAttendanceSessions, mockMembers } from '@/lib/mock-data';
import { QUORUM } from '@/lib/attendance';
import { latestVersions, todayInManila, useSessionFiles, type SessionFile } from '@/lib/session-files';
import { isOfficial } from '@/lib/sessions';
import { transcriptKey } from '@/lib/transcripts';
import type { Session } from '@/lib/mock-data';
import { Card, EmptyNote, LinkButton, StatTiles, dayMonth, type Tile } from '@/components/dashboard/widgets';
import { SegmentMeter } from '@/components/dashboard/charts';
import { AdminPanel, MyActivity, MyInvitations, SessionChecklistCard } from '@/components/dashboard/RoleDashboards';
import { ComingUpList, LiveSessionsList, NextSittingCard, useReplies } from '@/components/esession/SessionWidgets';
import { useOpenESession } from '@/components/esession/use-open-esession';
import { cn } from '@/lib/utils';

// The Staff Portal dashboard while the portal is set up for e-sessions (the Legislative Tracking module off):
// what is live, the next sitting and its replies, the files and recordings each sitting still needs, and the
// transcripts still to make. Each role sees the part of it that is its work.

interface Props {
  onNavigate: (tab: string) => void;
}

export type ESessionDashboardKind = 'admin' | 'records' | 'committee' | 'encoder' | 'viewer' | 'general';

/** Upcoming sittings (meetings included), the live ones, and recordings with their transcript state. */
function useSessionPicture(filter: (session: Session) => boolean = () => true) {
  const today = todayInManila();
  const calendar = useCalendarSessions();
  const { live } = useLobby();
  const files = useSessionFiles();
  const transcripts = useTranscriptIndex();
  const upcoming = useMemo(() => calendar.filter((session) => session.date >= today && filter(session)), [calendar, today, filter]);
  const liveRooms = live.filter((room) => upcoming.some((session) => session.id === room.sessionId) || calendar.some((session) => session.id === room.sessionId && filter(session)));
  // The sitting to show first: one live now, else the next official one, else whatever is next.
  const next = calendar.find((session) => liveRooms.some((room) => room.sessionId === session.id)) ?? upcoming.find(isOfficial) ?? upcoming[0];
  const recordings = latestVersions(files).filter((file) => (file.kind === 'audio' || file.kind === 'video') && (file.blob || file.src));
  const hasTranscript = (file: SessionFile) => Boolean(transcripts[transcriptKey(file)] || file.transcriptSrc);
  const untranscribed = recordings.filter((file) => !hasTranscript(file));
  return { calendar, upcoming, liveRooms, next, recordings, untranscribed, hasTranscript, transcripts };
}

const within = (days: number, today: string) => (session: Session) => {
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  return session.date <= end.toISOString().slice(0, 10);
};

export function ESessionDashboard({ kind, onNavigate }: Props & { kind: ESessionDashboardKind }) {
  if (kind === 'viewer') return <ViewerView onNavigate={onNavigate} />;
  if (kind === 'committee') return <CommitteeView onNavigate={onNavigate} />;
  return <SecretariatView onNavigate={onNavigate} withAdmin={kind === 'admin'} withActivity={kind !== 'admin'} />;
}

/** Administrators, Records Officers, Encoders and custom roles: the whole e-session picture. */
function SecretariatView({ onNavigate, withAdmin, withActivity }: Props & { withAdmin: boolean; withActivity: boolean }) {
  const { can } = useAccess();
  // Only people who take part in sessions get the way into E-Session.
  const { account, open: openESession } = useOpenESession();
  const open = account ? openESession : undefined;
  const today = todayInManila();
  const picture = useSessionPicture();
  const replies = useReplies(picture.next);
  const month = picture.upcoming.filter(within(30, today));

  const tiles: Tile[] = [
    {
      label: 'Live now',
      period: picture.liveRooms[0] ? picture.liveRooms[0].title : 'No e-session running',
      value: picture.liveRooms.length,
      icon: Radio,
      tab: 'esig-platform',
    },
    {
      label: 'Coming up',
      period: month[0] ? `Next 30 days · next ${dayMonth(month[0].date)}, ${month[0].time}` : 'Nothing in the next 30 days',
      value: month.length,
      icon: CalendarDays,
      tab: 'esig-calendar-sessions',
    },
    {
      label: 'Replies awaited',
      period: picture.next ? `For ${picture.next.title}` : 'No sitting scheduled',
      value: replies?.waiting ?? 0,
      icon: MailQuestion,
      tab: 'esig-calendar-sessions',
      footer: replies ? (
        <SegmentMeter
          segments={[
            { label: 'attending', value: replies.attending, color: '#15803d' },
            { label: 'not coming', value: replies.declined, color: '#dc2626' },
            { label: 'no reply', value: replies.waiting, color: '#d1d5db' },
          ]}
        />
      ) : undefined,
    },
    {
      label: 'To transcribe',
      period: `${picture.recordings.length - picture.untranscribed.length} of ${picture.recordings.length} recordings transcribed`,
      value: picture.untranscribed.length,
      icon: Captions,
      tab: 'esig-session-files',
      footer: picture.recordings.length ? (
        <SegmentMeter
          segments={[
            { label: 'transcribed', value: picture.recordings.length - picture.untranscribed.length, color: '#15803d' },
            { label: 'to transcribe', value: picture.untranscribed.length, color: '#d1d5db' },
          ]}
        />
      ) : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <StatTiles tiles={tiles} can={can} onNavigate={onNavigate} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card
          title={picture.liveRooms.some((room) => room.sessionId === picture.next?.id) ? 'Sitting Now' : 'Next Sitting'}
          subtitle="Replies from the invitees and the quorum outlook"
          className="xl:col-span-2"
          action={can('esig-calendar-sessions') ? <LinkButton onClick={() => onNavigate('esig-calendar-sessions')}>Calendar</LinkButton> : null}
        >
          <NextSittingCard session={picture.next} room={picture.liveRooms.find((room) => room.sessionId === picture.next?.id)} onOpenESession={open} />
        </Card>
        <Card title="E-Sessions Today" subtitle="Running now, and those already ended" action={can('esig-platform') ? <LinkButton onClick={() => onNavigate('esig-platform')}>Monitor</LinkButton> : null}>
          <LiveSessionsList sessions={picture.calendar} onOpenESession={open} endedLimit={3} />
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Coming Up" subtitle="The next sittings and how many replied" action={can('esig-calendar-sessions') ? <LinkButton onClick={() => onNavigate('esig-calendar-sessions')}>Calendar</LinkButton> : null}>
          <ComingUpList sessions={picture.upcoming.filter((session) => session.id !== picture.next?.id).slice(0, 6)} onSelect={can('esig-calendar-sessions') ? () => onNavigate('esig-calendar-sessions') : undefined} />
        </Card>
        <SessionChecklistCard onNavigate={onNavigate} title="Session Folders" subtitle="Documents and recordings the next sittings still need" />
        <TranscriptsCard picture={picture} onNavigate={onNavigate} />
      </div>
      {withAdmin ? <AdminPanel onNavigate={onNavigate} /> : null}
      {withActivity ? <MyActivity onNavigate={onNavigate} /> : null}
    </div>
  );
}

/** Recordings in Session Files and whether each has its transcript (a client requirement: keep the record). */
function TranscriptsCard({ picture, onNavigate }: Props & { picture: ReturnType<typeof useSessionPicture> }) {
  const { can } = useAccess();
  const sessionTitle = (id: string) => picture.calendar.find((session) => session.id === id)?.title ?? 'Other files';
  // Recordings still to transcribe first, then the transcribed ones, newest first within each.
  const list = [...picture.recordings].sort((a, b) => Number(picture.hasTranscript(a)) - Number(picture.hasTranscript(b)) || b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, 6);
  return (
    <Card title="Recordings & Transcripts" subtitle="Each recording of a sitting, with its transcript" action={can('esig-session-files') ? <LinkButton onClick={() => onNavigate('esig-session-files')}>Session files</LinkButton> : null}>
      {list.length === 0 ? (
        <EmptyNote>No recordings yet. Recordings made in E-Session or uploaded to Session Files show here.</EmptyNote>
      ) : (
        <ul className="space-y-2.5">
          {list.map((file) => {
            const info = picture.transcripts[transcriptKey(file)];
            const done = picture.hasTranscript(file);
            const Icon = file.kind === 'video' ? FileVideo : FileAudio;
            return (
              <li key={file.id} className="flex items-center gap-3">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', done ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text-main" title={file.name}>
                    {file.name}
                  </span>
                  <span className="block truncate text-[11px] text-text-muted">{sessionTitle(file.sessionId)}</span>
                </span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', done ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800')}>
                  {done ? (info?.edited ? `Transcript · ${info.edited} corrected` : 'Transcript') : 'To transcribe'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Committee Staff: the hearings. */
function CommitteeView({ onNavigate }: Props) {
  const { can } = useAccess();
  // Only people who take part in sessions get the way into E-Session.
  const { account, open: openESession } = useOpenESession();
  const open = account ? openESession : undefined;
  const onlyHearings = useMemo(() => (session: Session) => session.type === 'Committee Hearing', []);
  const picture = useSessionPicture(onlyHearings);
  const replies = useReplies(picture.next);
  const hearingFiles = picture.recordings.filter((file) => picture.calendar.some((session) => session.id === file.sessionId && session.type === 'Committee Hearing'));

  const tiles: Tile[] = [
    { label: 'Hearings live', period: picture.liveRooms[0]?.title ?? 'No hearing running', value: picture.liveRooms.length, icon: Radio, tab: 'esig-calendar-sessions' },
    { label: 'Upcoming hearings', period: picture.next ? `Next ${dayMonth(picture.next.date)}, ${picture.next.time}` : 'None scheduled', value: picture.upcoming.length, icon: CalendarDays, tab: 'esig-calendar-sessions' },
    { label: 'Replies awaited', period: picture.next ? `For ${picture.next.title}` : 'No hearing scheduled', value: replies?.waiting ?? 0, icon: MailQuestion, tab: 'esig-calendar-sessions' },
    { label: 'To transcribe', period: 'Hearing recordings without a transcript', value: hearingFiles.filter((file) => !picture.hasTranscript(file)).length, icon: Captions, tab: 'esig-session-files' },
  ];

  return (
    <div className="space-y-6">
      <StatTiles tiles={tiles} can={can} onNavigate={onNavigate} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Next Hearing" subtitle="Replies from the committee and the quorum outlook" className="xl:col-span-2" action={can('esig-calendar-sessions') ? <LinkButton onClick={() => onNavigate('esig-calendar-sessions')}>Calendar</LinkButton> : null}>
          <NextSittingCard session={picture.next} room={picture.liveRooms.find((room) => room.sessionId === picture.next?.id)} onOpenESession={open} />
        </Card>
        <MyInvitations onNavigate={onNavigate} />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Coming Up" subtitle="Committee hearings on the calendar">
          <ComingUpList sessions={picture.upcoming.filter((session) => session.id !== picture.next?.id).slice(0, 6)} />
        </Card>
        <MyActivity onNavigate={onNavigate} />
      </div>
    </div>
  );
}

/** Viewers: the attendance record and what is coming up, read-only. */
function ViewerView({ onNavigate }: Props) {
  const { can } = useAccess();
  const today = todayInManila();
  const calendar = useCalendarSessions();
  const upcoming = calendar.filter((session) => session.date >= today && isOfficial(session));
  const present = mockAttendanceSessions.map((_, index) => mockMembers.filter((member) => (mockAttendanceMarks[member.id] ?? '')[index] !== 'A').length);
  const withQuorum = present.filter((count) => count >= QUORUM).length;
  const average = present.length ? Math.round((present.reduce((sum, count) => sum + count, 0) / present.length / mockMembers.length) * 100) : 0;

  const tiles: Tile[] = [
    { label: 'Sessions recorded', period: 'July–September 2026 register', value: mockAttendanceSessions.length, icon: ClipboardCheck, tab: 'report-attendance-publication' },
    { label: 'With a quorum', period: `${QUORUM} of ${mockMembers.length} members needed`, value: withQuorum, icon: UserCheck, tab: 'report-attendance-publication' },
    { label: 'Average attendance', period: 'Members present per session', value: average, suffix: '%', icon: Users, tab: 'report-attendance-publication' },
    { label: 'Coming up', period: upcoming[0] ? `Next ${dayMonth(upcoming[0].date)}, ${upcoming[0].time}` : 'None scheduled', value: upcoming.length, icon: CalendarDays, tab: 'report-attendance-publication' },
  ];

  return (
    <div className="space-y-6">
      <StatTiles tiles={tiles} can={can} onNavigate={onNavigate} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Coming Up" subtitle="Sessions and hearings on the calendar" className="xl:col-span-2">
          <ComingUpList sessions={upcoming.slice(0, 8)} />
        </Card>
        <Card title="Reports" subtitle="Read-only reports you can open">
          {can('report-attendance-publication') ? (
            <button
              type="button"
              onClick={() => onNavigate('report-attendance-publication')}
              className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.03]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text-main">Attendance</span>
                <span className="block text-[11px] text-text-muted">Who attended each session, and whether it had a quorum.</span>
              </span>
            </button>
          ) : (
            <EmptyNote>No reports are available to your role.</EmptyNote>
          )}
        </Card>
      </div>
    </div>
  );
}
