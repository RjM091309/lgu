import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CalendarPlus,
  Clock,
  CheckCircle2,
  FilePlus2,
  FileText,
  FolderUp,
  Layers,
  Gavel,
  MapPin,
  Minus,
  Printer,
  Table2,
  LineChart,
  UserCog,
} from 'lucide-react';
import { mockBills, mockMonthlyActivity, mockSessions, type Bill } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { openPrintWindow } from '@/lib/files';
import { addSessionToCalendar, buildAgenda, formatLongDate, printAgenda } from '@/lib/sessions';
import { AreaSparkline, BarList, CountUp, DonutChart, PHASE_COLORS, PipelineChart, SegmentMeter, SERIES_COLORS, TrendChart } from '@/components/dashboard/charts';

interface OverviewProps {
  onNavigate: (tab: string) => void;
}

const PHASES = ['Filing', 'Deliberation', 'Approval'];
const PIPELINE: { status: Bill['status']; phase: number }[] = [
  { status: 'Draft', phase: 0 },
  { status: 'First Reading', phase: 0 },
  { status: 'Committee', phase: 1 },
  { status: 'Second Reading', phase: 1 },
  { status: 'Third Reading', phase: 1 },
  { status: 'Passed', phase: 2 },
  { status: 'Enacted', phase: 2 },
];
const FINAL_STATUSES: Bill['status'][] = ['Passed', 'Enacted', 'Vetoed'];

const RECENT_ACTIVITY = [
  { time: '09:37 AM', user: 'sb.committee', text: 'Returned APP-2026-016 as incomplete', tab: 'manage-transactions' },
  { time: '09:22 AM', user: 'sb.records', text: 'Uploaded minutes of the 37th Regular Session', tab: 'esig-session-files' },
  { time: '09:14 AM', user: 'sb.admin', text: 'Approved routing of Mun. Ord. No. 2026-007', tab: 'manage-legislation' },
  { time: 'Yesterday', user: 'sb.admin', text: 'Prepared the order of business for the 38th Regular Session', tab: 'manage-transactions' },
];

export function statusBadgeClassName(status: string) {
  return cn(
    'inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold',
    ['Enacted', 'Passed'].includes(status)
      ? 'border-green-200 bg-green-50 text-green-800'
      : status === 'Vetoed'
        ? 'border-red-200 bg-red-50 text-red-800'
        : status === 'Draft'
          ? 'border-slate-200 bg-slate-50 text-slate-700'
          : 'border-amber-200 bg-amber-50 text-amber-800'
  );
}

function Card({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-border bg-white p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-main">{title}</h2>
          {subtitle ? <p className="text-xs text-text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 text-xs font-semibold text-primary hover:underline">
      {children}
    </button>
  );
}

export function Overview({ onNavigate }: OverviewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [agendaSessionId, setAgendaSessionId] = useState<string | null>(null);
  const [trendAsTable, setTrendAsTable] = useState(false);
  const pageSize = 5;

  const recentBills = useMemo(() => [...mockBills].sort((a, b) => b.dateFiled.localeCompare(a.dateFiled)), []);
  const totalPages = Math.max(1, Math.ceil(recentBills.length / pageSize));
  const paginatedBills = recentBills.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const inProcess = mockBills.filter((bill) => !FINAL_STATUSES.includes(bill.status));
  const awaitingSignature = mockBills.filter((bill) => bill.status === 'Passed');
  const enacted = mockBills.filter((bill) => bill.status === 'Enacted');
  const nextSession = mockSessions[0];
  const agendaSession = mockSessions.find((session) => session.id === agendaSessionId) ?? null;

  const pipelineStages = PIPELINE.map((stage) => ({ ...stage, count: mockBills.filter((bill) => bill.status === stage.status).length }));

  const committeeLoad = useMemo(() => {
    const counts = mockBills.reduce<Record<string, number>>((acc, bill) => {
      const key = (bill.committee ?? bill.author).replace('Committee on ', '');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
  }, []);

  const months = mockMonthlyActivity.map((row) => row.month);
  const filed = mockMonthlyActivity.map((row) => row.filed);
  const approved = mockMonthlyActivity.map((row) => row.approved);
  const lastMonth = mockMonthlyActivity[mockMonthlyActivity.length - 1];
  const prevMonth = mockMonthlyActivity[mockMonthlyActivity.length - 2];

  const manilaHour = Number(new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }).format(new Date()));
  const greeting = manilaHour < 12 ? 'Good morning' : manilaHour < 18 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'full' }).format(new Date());

  const phaseCount = (phase: number) => pipelineStages.filter((stage) => stage.phase === phase).reduce((sum, stage) => sum + stage.count, 0);

  const tiles: {
    label: string;
    period: string;
    value: number;
    icon: typeof FileText;
    tab: string;
    delta?: { value: number; upIsGood: boolean | null };
    footer: React.ReactNode;
  }[] = [
    {
      label: 'Measures filed',
      period: 'September 2026',
      value: lastMonth.filed,
      icon: FileText,
      tab: 'manage-legislation',
      delta: { value: lastMonth.filed - prevMonth.filed, upIsGood: null },
      footer: <AreaSparkline values={filed} labels={months} />,
    },
    {
      label: 'Measures approved',
      period: 'September 2026',
      value: lastMonth.approved,
      icon: CheckCircle2,
      tab: 'report-statistical-performance',
      delta: { value: lastMonth.approved - prevMonth.approved, upIsGood: true },
      footer: <AreaSparkline values={approved} labels={months} />,
    },
    {
      label: 'Measures in process',
      period: 'Current records',
      value: inProcess.length,
      icon: Layers,
      tab: 'manage-legislation',
      footer: (
        <SegmentMeter
          segments={[
            { label: 'filing', value: phaseCount(0), color: PHASE_COLORS[0] },
            { label: 'deliberation', value: phaseCount(1), color: PHASE_COLORS[1] },
          ]}
        />
      ),
    },
    {
      label: 'Upcoming sessions',
      period: nextSession
        ? `Next: ${new Date(`${nextSession.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · ${nextSession.time}`
        : 'None scheduled',
      value: mockSessions.length,
      icon: CalendarDays,
      tab: 'manage-transactions',
      footer: (
        <div className="flex flex-wrap gap-1.5">
          {mockSessions.map((session) => (
            <span key={session.id} className="rounded-md border border-border bg-background px-2 py-1 text-[11px]">
              <span className="font-semibold text-text-main">
                {new Date(`${session.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
              </span>{' '}
              <span className="text-text-muted">{session.type === 'Committee Hearing' ? 'Hearing' : session.type}</span>
            </span>
          ))}
        </div>
      ),
    },
  ];

  const quickActions = [
    { label: 'New legislative record', icon: FilePlus2, tab: 'manage-legislation' },
    { label: 'Prepare session agenda', icon: Gavel, tab: 'manage-transactions' },
    { label: 'Upload session files', icon: FolderUp, tab: 'esig-session-files' },
    { label: 'Manage user accounts', icon: UserCog, tab: 'access-users' },
  ];

  const statusSegments = [
    { label: 'In process', value: inProcess.length, color: SERIES_COLORS.blue, tab: 'manage-legislation' },
    { label: 'Awaiting signature', value: awaitingSignature.length, color: SERIES_COLORS.orange, tab: 'esig-electronic-signature' },
    { label: 'Enacted', value: enacted.length, color: SERIES_COLORS.aqua, tab: 'archive' },
  ].filter((segment) => segment.value > 0);

  const printBill = (bill: Bill) =>
    openPrintWindow(
      bill.number,
      `
      <div class="card">
        <div class="rows">
          <div><b>Record No.</b>: ${bill.number}</div>
          <div><b>Classification</b>: ${bill.classification ?? 'Ordinance'}</div>
          <div><b>Status</b>: ${bill.status}</div>
          <div><b>Committee</b>: ${bill.committee ?? bill.author}</div>
          <div><b>Date filed</b>: ${bill.dateFiled}</div>
          <div><b>Action taken</b>: ${bill.actionTaken ?? ''}</div>
        </div>
        <div class="title">${bill.title}</div>
        <div class="body">${bill.description}</div>
      </div>`
    );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-text-muted">{todayLabel}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary">{greeting}, SB Secretariat Admin</h1>
          <p className="mt-1 text-sm text-text-muted">Here is the current status of legislative work at the Sangguniang Bayan ng Capas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onNavigate('report-statistical-performance')}>
            View reports
          </Button>
          <Button onClick={() => onNavigate('manage-legislation')}>
            <FilePlus2 className="mr-2 h-4 w-4" />
            New record
          </Button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const delta = tile.delta;
          const deltaTone =
            !delta || delta.value === 0 || delta.upIsGood === null
              ? 'bg-slate-100 text-slate-600'
              : (delta.value > 0) === delta.upIsGood
                ? 'bg-green-50 text-[#006300]'
                : 'bg-red-50 text-red-700';
          const DeltaIcon = !delta || delta.value === 0 ? Minus : delta.value > 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <button
              key={tile.label}
              type="button"
              onClick={() => onNavigate(tile.tab)}
              className="group flex flex-col rounded-xl border border-border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-text-main">{tile.label}</span>
                  <span className="block truncate text-[11px] text-text-muted">{tile.period}</span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <tile.icon className="h-[18px] w-[18px]" />
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2.5">
                <span className="text-[32px] font-semibold leading-none text-text-main">
                  <CountUp value={tile.value} />
                </span>
                {delta ? (
                  <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold', deltaTone)}>
                    <DeltaIcon className="h-3 w-3" />
                    {delta.value > 0 ? `+${delta.value}` : delta.value} vs {prevMonth.month}
                  </span>
                ) : null}
              </div>

              <div className="mt-auto w-full pt-4">{tile.footer}</div>
            </button>
          );
        })}
      </div>

      {/* Trend + status mix */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Monthly Legislative Activity"
          subtitle="Measures filed and approved, January–September 2026"
          action={
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-3 text-xs text-text-muted sm:flex" aria-hidden>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-3.5 rounded" style={{ backgroundColor: SERIES_COLORS.blue }} />
                  Filed
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-3.5 rounded" style={{ backgroundColor: SERIES_COLORS.orange }} />
                  Approved
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTrendAsTable((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold text-text-muted hover:border-primary hover:text-primary"
                aria-pressed={trendAsTable}
              >
                {trendAsTable ? <LineChart className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
                {trendAsTable ? 'Chart' : 'Table'}
              </button>
            </div>
          }
        >
          <TrendChart
            labels={months}
            showTable={trendAsTable}
            series={[
              { key: 'filed', label: 'Filed', color: SERIES_COLORS.blue, values: filed, area: true },
              { key: 'approved', label: 'Approved', color: SERIES_COLORS.orange, values: approved },
            ]}
          />
        </Card>

        <Card title="Measures by Status" subtitle="Share of current legislative records">
          <DonutChart
            segments={statusSegments}
            totalLabel="measures on record"
            onSelect={(label) => onNavigate(statusSegments.find((segment) => segment.label === label)?.tab ?? 'manage-legislation')}
          />
        </Card>
      </div>

      {/* Pipeline, sessions, committees */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Legislative Pipeline" subtitle="Measures at each stage" action={<LinkButton onClick={() => onNavigate('manage-legislation')}>Open tracking</LinkButton>}>
          <PipelineChart stages={pipelineStages} phases={PHASES} onSelect={() => onNavigate('manage-legislation')} />
        </Card>

        <Card title="Upcoming Sessions" action={<LinkButton onClick={() => onNavigate('manage-transactions')}>View all</LinkButton>}>
          <ul className="space-y-3">
            {mockSessions.map((session) => {
              const date = new Date(`${session.date}T00:00:00`);
              return (
                <li key={session.id} className="flex gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/30">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary text-white">
                    <span className="text-[10px] font-bold uppercase">{date.toLocaleDateString('en-PH', { month: 'short' })}</span>
                    <span className="text-xl font-bold leading-none">{date.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary">{session.type}</p>
                    <p className="truncate text-sm font-semibold">{session.title}</p>
                    <div className="mt-1 flex gap-3">
                      <button type="button" onClick={() => setAgendaSessionId(session.id)} className="text-xs font-semibold text-primary hover:underline">
                        Agenda
                      </button>
                      <button type="button" onClick={() => addSessionToCalendar(session)} className="text-xs font-semibold text-primary hover:underline">
                        Add to calendar
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Committee Workload" subtitle="Measures referred, top 5" action={<LinkButton onClick={() => onNavigate('manage-master-files')}>Committees</LinkButton>}>
          <BarList items={committeeLoad} onSelect={() => onNavigate('manage-master-files')} />
        </Card>
      </div>

      {/* Recent measures */}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-text-main">Recent Legislative Actions</h2>
            <p className="text-xs text-text-muted">Select a record to see its details</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('manage-legislation')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            View all actions
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <DataTable
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={recentBills.length}
          currentCount={paginatedBills.length}
          onPreviousPage={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          onNextPage={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
        >
          <Table>
            <TableHeader className="bg-[#fafafa]">
              <TableRow className="border-border">
                <TableHead className="px-5 text-[12px] font-semibold text-text-muted">RECORD NO.</TableHead>
                <TableHead className="px-5 text-[12px] font-semibold text-text-muted">TITLE</TableHead>
                <TableHead className="px-5 text-[12px] font-semibold text-text-muted">COMMITTEE</TableHead>
                <TableHead className="px-5 text-[12px] font-semibold text-text-muted">DATE FILED</TableHead>
                <TableHead className="px-5 text-[12px] font-semibold text-text-muted">STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedBills.map((bill) => (
                <TableRow
                  key={bill.id}
                  onClick={() => setSelectedBill(bill)}
                  className="cursor-pointer border-border transition-colors hover:bg-primary/[0.03]"
                >
                  <TableCell className="whitespace-nowrap px-5 py-3.5 font-mono text-[12px] text-text-muted">{bill.number}</TableCell>
                  <TableCell className="px-5 py-3.5 text-[13px] font-medium text-primary">{bill.title}</TableCell>
                  <TableCell className="px-5 py-3.5 text-[13px]">{bill.committee ?? bill.author}</TableCell>
                  <TableCell className="whitespace-nowrap px-5 py-3.5 text-[13px] tabular-nums">{bill.dateFiled}</TableCell>
                  <TableCell className="px-5 py-3.5">
                    <span className={statusBadgeClassName(bill.status)}>{bill.status}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTable>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent Activity" action={<LinkButton onClick={() => onNavigate('access-control-panel')}>Audit trail</LinkButton>}>
          <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-border">
            {RECENT_ACTIVITY.map((entry) => (
              <li key={entry.text}>
                <button type="button" onClick={() => onNavigate(entry.tab)} className="relative flex w-full gap-3 rounded-md p-2 text-left hover:bg-background">
                  <span className="relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-primary ring-1 ring-primary/30" />
                  <span>
                    <span className="block text-[13px] text-text-main">{entry.text}</span>
                    <span className="text-[11px] text-text-muted">
                      {entry.user} · {entry.time}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Quick Actions">
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => onNavigate(action.tab)}
                className="group flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary/[0.03]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-semibold leading-snug">{action.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Record details */}
      <Dialog open={selectedBill !== null} onOpenChange={(open) => !open && setSelectedBill(null)}>
        <DialogContent className="max-w-2xl">
          {selectedBill ? (
            <>
              <DialogHeader>
                <p className="font-mono text-xs text-text-muted">{selectedBill.number}</p>
                <DialogTitle className="pr-8 text-lg leading-snug text-primary">{selectedBill.title}</DialogTitle>
                <DialogDescription>{selectedBill.description}</DialogDescription>
              </DialogHeader>
              <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {[
                  ['Status', <span className={statusBadgeClassName(selectedBill.status)}>{selectedBill.status}</span>],
                  ['Classification', selectedBill.classification ?? 'Ordinance'],
                  ['Committee', selectedBill.committee ?? selectedBill.author],
                  ['Co-author', selectedBill.coAuthor || '—'],
                  ['Date filed', selectedBill.dateFiled],
                  ['Action taken', selectedBill.actionTaken ?? '—'],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-xs text-text-muted">{label}</dt>
                    <dd className="mt-0.5 font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button onClick={() => onNavigate('manage-legislation')}>
                  Open in Legislative Tracking
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => printBill(selectedBill)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print record
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Agenda */}
      <Dialog open={agendaSession !== null} onOpenChange={(open) => !open && setAgendaSessionId(null)}>
        <DialogContent className="max-w-2xl">
          {agendaSession ? (
            <>
              <DialogHeader>
                <p className="text-xs font-bold uppercase tracking-wider text-secondary">{agendaSession.type}</p>
                <DialogTitle className="text-xl text-primary">{agendaSession.title}</DialogTitle>
                <DialogDescription className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatLongDate(agendaSession.date)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {agendaSession.time}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {agendaSession.location}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <h3 className="mt-5 text-sm font-bold uppercase tracking-wider text-text-muted">Order of Business</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                {buildAgenda(agendaSession).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => printAgenda(agendaSession)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print agenda
                </Button>
                <Button variant="outline" onClick={() => addSessionToCalendar(agendaSession)}>
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
