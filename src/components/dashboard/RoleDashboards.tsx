import { useMemo } from 'react';
import {
  Archive,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileAudio,
  FileText,
  FileVideo,
  FolderOpen,
  Gavel,
  KeyRound,
  Layers,
  PenLine,
  Search,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { mockBills, mockCommitteeHearings, mockMonthlyActivity, mockSessions, mockYearlyActivity, type Bill } from '@/lib/mock-data';
import { latestVersions, useSessionFiles } from '@/lib/session-files';
import { useActivityLog } from '@/lib/activity-log';
import { ADMIN_ROLE, useAccess, useRoles, useSecuritySettings, useUsers } from '@/lib/access-store';
import { inviteesFor, rsvpOf, setRsvp, useAttendance } from '@/lib/attendance';
import { logActivity } from '@/lib/activity-log';
import { LEGISLATIVE_PHASES, LEGISLATIVE_STAGES, StatusBadge } from '@/components/ui/status-badge';
import { BarList, DonutChart, GroupedBarChart, PHASE_COLORS, PipelineChart, SERIES_COLORS, SegmentMeter } from '@/components/dashboard/charts';
import { CHECKLIST_CATEGORIES, Card, EmptyNote, LinkButton, SESSION_TYPE_TONE, StatTiles, dayMonth, formatShortDate, relativeDays, type Tile } from '@/components/dashboard/widgets';
import { cn } from '@/lib/utils';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

const FINAL_STATUSES: Bill['status'][] = ['Passed', 'Enacted', 'Vetoed'];
const PIPELINE = LEGISLATIVE_STAGES as { status: Bill['status']; phase: number }[];
const pipelineStages = PIPELINE.map((stage) => ({ ...stage, count: mockBills.filter((bill) => bill.status === stage.status).length }));
const lastMonth = mockMonthlyActivity[mockMonthlyActivity.length - 1];
const prevMonth = mockMonthlyActivity[mockMonthlyActivity.length - 2];
const months = mockMonthlyActivity.map((row) => row.month);
const totalFiled = mockMonthlyActivity.reduce((sum, row) => sum + row.filed, 0);
const totalApproved = mockMonthlyActivity.reduce((sum, row) => sum + row.approved, 0);
const approvalRate = totalFiled > 0 ? Math.round((totalApproved / totalFiled) * 100) : 0;
const thisYear = mockYearlyActivity[mockYearlyActivity.length - 1];

const byNewest = (a: Bill, b: Bill) => b.dateFiled.localeCompare(a.dateFiled);

/** A compact list of measures, each opening Legislative Tracking when the role can. */
function MeasureList({ bills, onOpen, empty }: { bills: Bill[]; onOpen?: () => void; empty: string }) {
  if (bills.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {bills.map((bill) => (
        <li key={bill.id}>
          <button
            type="button"
            onClick={onOpen}
            disabled={!onOpen}
            className={cn('flex w-full items-start gap-3 px-3.5 py-3 text-left', onOpen ? 'hover:bg-primary/[0.03]' : 'cursor-default')}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-primary">{bill.number}</p>
              <p className="line-clamp-2 text-sm font-medium leading-snug text-text-main" title={bill.title}>
                {bill.title}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-text-muted">
                {(bill.committee ?? '').replace('Committee on ', 'Comm. on ')} · filed {formatShortDate(bill.dateFiled)}
              </p>
            </div>
            <StatusBadge status={bill.status} className="shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Upcoming sessions the signed-in account is invited to, with a one-click response. */
export function MyInvitations({ onNavigate }: DashboardProps) {
  const { user, can } = useAccess();
  const users = useUsers();
  const attendance = useAttendance();
  const mine = mockSessions.filter((session) => inviteesFor(session, users).some((invitee) => invitee.userId === user.id));

  const respond = (sessionId: string, title: string, status: 'attending' | 'declined') => {
    const inviteeId = `user:${user.id}`;
    const current = rsvpOf(attendance, sessionId, inviteeId)?.status;
    setRsvp(sessionId, inviteeId, current === status ? null : { status, respondedAt: new Date().toISOString().slice(0, 16), recordedBy: user.name });
    if (current !== status) logActivity({ module: 'E-Session', action: 'Updated', summary: `Marked ${user.name} ${status === 'attending' ? 'attending' : 'not attending'} for ${title}` });
  };

  return (
    <Card
      title="My Session Invitations"
      subtitle="Sessions you are expected to attend"
      action={can('esig-calendar-sessions') ? <LinkButton onClick={() => onNavigate('esig-calendar-sessions')}>Calendar</LinkButton> : null}
    >
      {mine.length === 0 ? (
        <EmptyNote>You are not invited to any upcoming session.</EmptyNote>
      ) : (
        <ul className="space-y-2.5">
          {mine.map((session) => {
            const status = rsvpOf(attendance, session.id, `user:${user.id}`)?.status;
            return (
              <li key={session.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.06] text-primary">
                  <span className="text-[10px] font-semibold uppercase">{new Date(`${session.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short' })}</span>
                  <span className="text-lg font-bold leading-none">{Number(session.date.slice(8))}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', SESSION_TYPE_TONE[session.type])}>{session.type}</span>
                  <p className="mt-1 truncate text-sm font-semibold text-text-main" title={session.title}>
                    {session.title}
                  </p>
                  <p className="text-[11px] text-text-muted">{session.time}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => respond(session.id, session.title, 'attending')}
                    aria-pressed={status === 'attending'}
                    title="I will attend"
                    aria-label={`I will attend ${session.title}`}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                      status === 'attending' ? 'border-green-600 bg-green-600 text-white' : 'border-border text-text-muted hover:border-green-600 hover:text-green-700'
                    )}
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    onClick={() => respond(session.id, session.title, 'declined')}
                    aria-pressed={status === 'declined'}
                    title="I can't attend"
                    aria-label={`I can't attend ${session.title}`}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                      status === 'declined' ? 'border-red-600 bg-red-600 text-white' : 'border-border text-text-muted hover:border-red-600 hover:text-red-700'
                    )}
                  >
                    <X className="h-4 w-4" strokeWidth={3} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** The signed-in account's own recent actions. */
export function MyActivity({ onNavigate }: DashboardProps) {
  const { user } = useAccess();
  const entries = useActivityLog()
    .filter((entry) => entry.user === user.username)
    .slice(0, 6);
  return (
    <Card title="My Recent Activity" subtitle="What you did in LIMS lately" action={<LinkButton onClick={() => onNavigate('activity-log')}>Activity log</LinkButton>}>
      {entries.length === 0 ? (
        <EmptyNote>No activity yet.</EmptyNote>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" aria-hidden />
              <div className="min-w-0">
                <p className="text-text-main">{entry.summary}</p>
                <p className="text-[11px] text-text-muted">
                  {entry.module} · {relativeDays(entry.timestamp.slice(0, 10))}, {entry.timestamp.slice(11)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Administrator-only row: accounts, roles, security, and everyone's latest activity. */
export function AdminPanel({ onNavigate }: DashboardProps) {
  const users = useUsers();
  const roles = useRoles();
  const settings = useSecuritySettings();
  const activity = useActivityLog().slice(0, 6);
  const active = users.filter((user) => user.status === 'Active').length;
  const withMfa = users.filter((user) => user.mfa).length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <Card title="Accounts & Roles" subtitle="Who can sign in to LIMS" action={<LinkButton onClick={() => onNavigate('access-users')}>Users</LinkButton>}>
        <dl className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border text-center">
          {[
            { label: 'Active', value: active },
            { label: 'Inactive', value: users.length - active },
            { label: 'With MFA', value: `${withMfa}/${users.length}` },
          ].map((item) => (
            <div key={item.label} className="px-2 py-3">
              <dd className="text-xl font-semibold text-text-main">{item.value}</dd>
              <dt className="text-[11px] text-text-muted">{item.label}</dt>
            </div>
          ))}
        </dl>
        <ul className="mt-4 space-y-2">
          {roles.map((role) => {
            const count = users.filter((user) => user.role === role.name).length;
            return (
              <li key={role.name} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-text-main">{role.name}</span>
                <span className="text-xs text-text-muted">
                  {count} account{count === 1 ? '' : 's'}
                </span>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => onNavigate('access-roles')} className="mt-4 text-xs font-semibold text-primary hover:underline">
          Roles &amp; Permissions
        </button>
      </Card>

      <Card title="Security" subtitle="Current sign-in and backup settings" action={<LinkButton onClick={() => onNavigate('access-control-panel')}>Control panel</LinkButton>}>
        <ul className="space-y-3 text-sm">
          {[
            { icon: KeyRound, label: 'MFA required for administrators', value: settings.requireMfaForAdmins ? 'On' : 'Off', ok: settings.requireMfaForAdmins },
            { icon: ShieldCheck, label: 'Session timeout', value: `${settings.sessionTimeout} minutes`, ok: true },
            { icon: ShieldCheck, label: 'Lock after failed sign-ins', value: `${settings.lockoutAttempts} attempts`, ok: true },
            { icon: Archive, label: 'Daily backup', value: settings.dailyBackup ? `Last ${settings.lastBackup.replace('T', ' ')}` : 'Off', ok: settings.dailyBackup },
          ].map((item) => (
            <li key={item.label} className="flex items-center gap-3">
              <item.icon className={cn('h-4 w-4 shrink-0', item.ok ? 'text-green-700' : 'text-amber-700')} />
              <span className="min-w-0 flex-1 text-text-main">{item.label}</span>
              <span className={cn('shrink-0 text-xs font-semibold', item.ok ? 'text-text-muted' : 'text-amber-700')}>{item.value}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Latest Activity" subtitle="Across all accounts" action={<LinkButton onClick={() => onNavigate('activity-log')}>Activity log</LinkButton>} className="lg:col-span-2 xl:col-span-1">
        <ul className="space-y-3">
          {activity.map((entry) => (
            <li key={entry.id} className="flex gap-3 text-sm">
              <span className="mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">{entry.user.slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0">
                <p className="text-text-main">{entry.summary}</p>
                <p className="text-[11px] text-text-muted">
                  @{entry.user} · {relativeDays(entry.timestamp.slice(0, 10))}, {entry.timestamp.slice(11)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** Session folders: which checklist items are still missing for each scheduled session. */
function SessionChecklistCard({ onNavigate, title = 'Session Files Checklist', subtitle = 'Documents and recordings still needed per session' }: DashboardProps & { title?: string; subtitle?: string }) {
  const { can } = useAccess();
  const files = useSessionFiles();
  const rows = mockSessions.map((session) => {
    const missing = CHECKLIST_CATEGORIES.filter((category) => !files.some((file) => file.sessionId === session.id && file.category === category && (file.blob || file.src)));
    return { session, missing, done: CHECKLIST_CATEGORIES.length - missing.length };
  });
  return (
    <Card title={title} subtitle={subtitle} action={can('esig-session-files') ? <LinkButton onClick={() => onNavigate('esig-session-files')}>Session files</LinkButton> : null}>
      <ul className="space-y-3">
        {rows.map(({ session, missing, done }) => (
          <li key={session.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-main" title={session.title}>
                  {session.title}
                </p>
                <p className="text-[11px] text-text-muted">
                  {dayMonth(session.date)} · {session.type}
                </p>
              </div>
              <span className={cn('shrink-0 text-xs font-semibold tabular-nums', missing.length === 0 ? 'text-green-700' : 'text-text-main')}>
                {done}/{CHECKLIST_CATEGORIES.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', missing.length === 0 ? 'bg-green-600' : 'bg-primary')} style={{ width: `${(done / CHECKLIST_CATEGORIES.length) * 100}%` }} />
            </div>
            {missing.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="text-[11px] text-text-muted">Missing:</span>
                {missing.map((category) => (
                  <span key={category} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    {category}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] font-medium text-green-700">Complete</p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PipelineCard({ onNavigate }: DashboardProps) {
  const { can } = useAccess();
  return (
    <Card title="Legislative Pipeline" subtitle="Measures at each stage" action={can('manage-legislation') ? <LinkButton onClick={() => onNavigate('manage-legislation')}>Open tracking</LinkButton> : null}>
      <PipelineChart stages={pipelineStages} phases={LEGISLATIVE_PHASES} onSelect={() => can('manage-legislation') && onNavigate('manage-legislation')} />
    </Card>
  );
}

// ---------------------------------------------------------------- Records Officer

export function RecordsDashboard({ onNavigate }: DashboardProps) {
  const { can } = useAccess();
  const files = useSessionFiles();
  const newFilings = mockBills.filter((bill) => bill.status === 'Draft' || bill.status === 'First Reading');
  const awaitingSignature = mockBills.filter((bill) => bill.status === 'Passed');
  const completeSessions = mockSessions.filter((session) =>
    CHECKLIST_CATEGORIES.every((category) => files.some((file) => file.sessionId === session.id && file.category === category && (file.blob || file.src)))
  ).length;
  const next = mockSessions[0];

  const tiles: Tile[] = [
    { label: 'New filings', period: 'Draft and first reading', value: newFilings.length, icon: FileText, tab: 'manage-legislation' },
    { label: 'Awaiting signature', period: 'Passed, for e-signature', value: awaitingSignature.length, icon: PenLine, tab: 'esig-electronic-signature' },
    {
      label: 'Session folders complete',
      period: `Out of ${mockSessions.length} scheduled sessions`,
      value: completeSessions,
      icon: FolderOpen,
      tab: 'esig-session-files',
      footer: <SegmentMeter segments={[{ label: 'complete', value: completeSessions, color: PHASE_COLORS[2] }, { label: 'incomplete', value: mockSessions.length - completeSessions, color: '#d1d5db' }]} />,
    },
    { label: 'Upcoming sessions', period: next ? `Next: ${dayMonth(next.date)} · ${next.time}` : 'None scheduled', value: mockSessions.length, icon: CalendarDays, tab: 'esig-calendar-sessions' },
  ];

  return (
    <div className="space-y-6">
      <StatTiles tiles={tiles} can={can} onNavigate={onNavigate} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card
          title="Records to Process"
          subtitle="Newest filings and measures waiting for signature"
          className="xl:col-span-2"
          action={can('manage-legislation') ? <LinkButton onClick={() => onNavigate('manage-legislation')}>Open tracking</LinkButton> : null}
        >
          <MeasureList bills={[...newFilings, ...awaitingSignature].sort(byNewest)} onOpen={can('manage-legislation') ? () => onNavigate('manage-legislation') : undefined} empty="Nothing waiting." />
        </Card>
        <SessionChecklistCard onNavigate={onNavigate} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <PipelineCard onNavigate={onNavigate} />
        <MyInvitations onNavigate={onNavigate} />
        <MyActivity onNavigate={onNavigate} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Committee Staff

export function CommitteeDashboard({ onNavigate }: DashboardProps) {
  const { can } = useAccess();
  const inCommittee = mockBills.filter((bill) => bill.status === 'Committee');
  const deliberation = mockBills.filter((bill) => bill.status === 'Second Reading' || bill.status === 'Third Reading');
  const hearings = mockSessions.filter((session) => session.type === 'Committee Hearing');
  const hearingsThisMonth = mockCommitteeHearings.reduce((sum, row) => sum + row.monthly[row.monthly.length - 1], 0);
  const hearingsLastMonth = mockCommitteeHearings.reduce((sum, row) => sum + row.monthly[row.monthly.length - 2], 0);

  const workload = useMemo(() => {
    const open = mockBills.filter((bill) => !FINAL_STATUSES.includes(bill.status));
    const counts = open.reduce<Record<string, number>>((acc, bill) => {
      const key = (bill.committee ?? 'Unassigned').replace('Committee on ', '');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { items: entries.slice(0, 6).map(([label, value]) => ({ label, value })), total: open.length, groups: entries.length };
  }, []);

  const tiles: Tile[] = [
    { label: 'Referred to committee', period: 'Under committee study', value: inCommittee.length, icon: Gavel, tab: 'manage-legislation' },
    { label: 'On the floor', period: 'Second and third reading', value: deliberation.length, icon: Layers, tab: 'manage-legislation' },
    {
      label: 'Hearings held',
      period: `${lastMonth.month} 2026, all committees`,
      value: hearingsThisMonth,
      icon: Users,
      tab: 'report-statistical-performance',
      delta: { value: hearingsThisMonth - hearingsLastMonth, upIsGood: null, versus: prevMonth.month },
    },
    { label: 'Upcoming hearings', period: hearings[0] ? `Next: ${dayMonth(hearings[0].date)} · ${hearings[0].time}` : 'None scheduled', value: hearings.length, icon: CalendarDays, tab: 'esig-calendar-sessions' },
  ];

  return (
    <div className="space-y-6">
      <StatTiles tiles={tiles} can={can} onNavigate={onNavigate} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card
          title="Measures under Committee Study"
          subtitle="Referred measures and those back on the floor"
          className="xl:col-span-2"
          action={can('manage-legislation') ? <LinkButton onClick={() => onNavigate('manage-legislation')}>Open tracking</LinkButton> : null}
        >
          <MeasureList bills={[...inCommittee, ...deliberation].sort(byNewest)} onOpen={can('manage-legislation') ? () => onNavigate('manage-legislation') : undefined} empty="No measures are with the committees." />
        </Card>
        <Card
          title="Committee Workload"
          subtitle="Open measures per committee"
          action={can('manage-master-files') ? <LinkButton onClick={() => onNavigate('manage-master-files')}>Committees</LinkButton> : null}
        >
          <BarList items={workload.items} total={workload.total} groupCount={workload.groups} onSelect={() => can('manage-master-files') && onNavigate('manage-master-files')} />
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MyInvitations onNavigate={onNavigate} />
        <MyActivity onNavigate={onNavigate} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Encoder

export function EncoderDashboard({ onNavigate }: DashboardProps) {
  const { user, can } = useAccess();
  const files = useSessionFiles();
  const myUploads = files.filter((file) => file.uploadedBy === user.name && file.source === 'upload').sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const awaiting = files.filter((file) => (file.kind === 'audio' || file.kind === 'video') && !file.blob && !file.src);
  const missingCount = mockSessions.reduce(
    (sum, session) => sum + CHECKLIST_CATEGORIES.filter((category) => !files.some((file) => file.sessionId === session.id && file.category === category && (file.blob || file.src))).length,
    0
  );
  const scannedOrdinances = latestVersions(files).filter((file) => file.category === 'Enacted Ordinance').length;
  const sessionTitle = (id: string) => mockSessions.find((session) => session.id === id)?.title ?? 'Other files';

  const tiles: Tile[] = [
    { label: 'My uploads', period: 'Files you added', value: myUploads.length, icon: Upload, tab: 'esig-session-files' },
    { label: 'Items still needed', period: 'Missing from session folders', value: missingCount, icon: ClipboardCheck, tab: 'esig-session-files' },
    { label: 'Recordings to attach', period: 'Listed, no audio or video yet', value: awaiting.length, icon: FileVideo, tab: 'esig-session-files' },
    { label: 'Scanned ordinances', period: 'Enacted ordinances on file', value: scannedOrdinances, icon: FileText, tab: 'esig-session-files' },
  ];

  return (
    <div className="space-y-6">
      <StatTiles tiles={tiles} can={can} onNavigate={onNavigate} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SessionChecklistCard onNavigate={onNavigate} title="Upload Queue" subtitle="What each session folder still needs" />
        <Card
          title="My Recent Uploads"
          subtitle="Latest files you added"
          action={can('esig-session-files') ? <LinkButton onClick={() => onNavigate('esig-session-files')}>Session files</LinkButton> : null}
        >
          {myUploads.length === 0 ? (
            <EmptyNote>You have not uploaded any files yet.</EmptyNote>
          ) : (
            <ul className="space-y-2.5">
              {myUploads.slice(0, 6).map((file) => {
                const Icon = file.kind === 'audio' ? FileAudio : file.kind === 'video' ? FileVideo : FileText;
                return (
                  <li key={file.id} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-main" title={file.name}>
                        {file.name}
                      </p>
                      <p className="truncate text-[11px] text-text-muted">
                        {file.category} · {sessionTitle(file.sessionId)} · {file.uploadedAt}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Recordings to Attach" subtitle="Sessions and hearings listed without media">
          {awaiting.length === 0 ? (
            <EmptyNote>Every listed recording has its audio or video.</EmptyNote>
          ) : (
            <ul className="space-y-2.5">
              {awaiting.map((file) => (
                <li key={file.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <FileVideo className="h-4 w-4 shrink-0 text-amber-700" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-main">{file.name}</p>
                    <p className="text-[11px] text-text-muted">{sessionTitle(file.sessionId)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {can('esig-session-files') ? (
            <button
              type="button"
              onClick={() => onNavigate('esig-session-files')}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              <Upload className="h-4 w-4" />
              Upload files
            </button>
          ) : null}
          {can('archive') ? (
            <button
              type="button"
              onClick={() => onNavigate('archive')}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-main hover:bg-muted"
            >
              <Archive className="h-4 w-4" />
              Open archives
            </button>
          ) : null}
        </Card>
      </div>
      <MyActivity onNavigate={onNavigate} />
    </div>
  );
}

// ---------------------------------------------------------------- Viewer

export function ViewerDashboard({ onNavigate }: DashboardProps) {
  const { can } = useAccess();
  const inProcess = mockBills.filter((bill) => !FINAL_STATUSES.includes(bill.status)).length;
  const awaitingSignature = mockBills.filter((bill) => bill.status === 'Passed').length;
  const enacted = mockBills.filter((bill) => bill.status === 'Enacted').length;
  const recentlyApproved = mockBills.filter((bill) => bill.status === 'Passed' || bill.status === 'Enacted').sort(byNewest);

  const tiles: Tile[] = [
    { label: 'Measures filed', period: 'January–September 2026', value: totalFiled, icon: FileText, tab: 'report-statistical-performance' },
    { label: 'Measures approved', period: 'January–September 2026', value: totalApproved, icon: CheckCircle2, tab: 'report-statistical-performance' },
    { label: 'Approval rate', period: 'Approved out of filed', value: approvalRate, suffix: '%', icon: BarChart3, tab: 'report-statistical-performance' },
    { label: 'Sessions held', period: `${thisYear.sessionsHeld} of ${thisYear.sessionsPlanned} planned this year`, value: thisYear.sessionsHeld, icon: UserCheck, tab: 'report-attendance-publication' },
  ];

  const reports = [
    { tab: 'report-search-listing', title: 'Search & Listing', text: 'Find measures and export listings.', icon: Search },
    { tab: 'report-statistical-performance', title: 'Statistics & Performance', text: 'Output, approval, and turnaround figures.', icon: BarChart3 },
    { tab: 'report-attendance-publication', title: 'Attendance & Publication', text: 'Quorum, attendance, and posting compliance.', icon: ClipboardCheck },
  ].filter((report) => can(report.tab));

  return (
    <div className="space-y-6">
      <StatTiles tiles={tiles} can={can} onNavigate={onNavigate} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Monthly Legislative Activity" subtitle="Measures filed and approved, January–September 2026" className="xl:col-span-2">
          <GroupedBarChart
            labels={months}
            showTable={false}
            periodSuffix=" 2026"
            ratio={{ label: 'Approval rate', numerator: 'approved', denominator: 'filed' }}
            series={[
              { key: 'filed', label: 'Filed', color: SERIES_COLORS.blue, values: mockMonthlyActivity.map((row) => row.filed) },
              { key: 'approved', label: 'Approved', color: SERIES_COLORS.orange, values: mockMonthlyActivity.map((row) => row.approved) },
            ]}
          />
        </Card>
        <Card title="Measures by Status" subtitle="Share of current legislative records">
          <DonutChart
            segments={[
              { label: 'In process', value: inProcess, color: SERIES_COLORS.blue },
              { label: 'Awaiting signature', value: awaitingSignature, color: SERIES_COLORS.orange },
              { label: 'Enacted', value: enacted, color: SERIES_COLORS.aqua },
            ].filter((segment) => segment.value > 0)}
            totalLabel="measures on record"
          />
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Recently Approved Measures" subtitle="Passed and enacted, newest first" className="xl:col-span-2">
          <MeasureList bills={recentlyApproved} empty="No approved measures yet." />
        </Card>
        <Card title="Reports" subtitle="Read-only reports you can open">
          {reports.length === 0 ? (
            <EmptyNote>No reports are available to your role.</EmptyNote>
          ) : (
            <ul className="space-y-2.5">
              {reports.map((report) => (
                <li key={report.tab}>
                  <button
                    type="button"
                    onClick={() => onNavigate(report.tab)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.03]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <report.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-text-main">{report.title}</span>
                      <span className="block text-[11px] text-text-muted">{report.text}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Which dashboard a role gets; custom roles fall back to the general overview filtered by their pages. */
export const dashboardKindOf = (roleName: string | undefined) =>
  roleName === ADMIN_ROLE
    ? 'admin'
    : roleName === 'Records Officer'
      ? 'records'
      : roleName === 'Committee Staff'
        ? 'committee'
        : roleName === 'Encoder'
          ? 'encoder'
          : roleName === 'Viewer'
            ? 'viewer'
            : 'general';
