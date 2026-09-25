import { useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Download, FileText, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { CountUp } from '@/components/dashboard/charts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockCommitteeHearings, mockYearlyActivity } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

type YearRow = (typeof mockYearlyActivity)[number];

const CURRENT_YEAR = '2026';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
// Sequential single-hue ramp for the heatmap, light (few) to dark (many).
const HEAT = ['#f3f4f7', '#dbe7f8', '#b3cdf1', '#7eaae6', '#3f82d8', '#1d5bb0'];

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const approvalRate = (row: YearRow) => pct(row.approved, row.filed);
const sessionRate = (row: YearRow) => pct(row.sessionsHeld, row.sessionsPlanned);
const yearLabel = (year: string) => (year === CURRENT_YEAR ? `${year} YTD` : year);

/* ----------------------------------------------------------------- Pieces */

function Section({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-xl border border-border bg-white shadow-sm', className)}>
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-text-main">{title}</h2>
          {subtitle ? <p className="text-xs text-text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Delta({ value, unit = '', lowerIsBetter = false }: { value: number | null; unit?: string; lowerIsBetter?: boolean }) {
  if (value === null) return null;
  const good = value === 0 ? null : (value > 0) !== lowerIsBetter;
  const Icon = value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
        good === null ? 'bg-white/10 text-white/80' : good ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200'
      )}
    >
      <Icon className="h-3 w-3" />
      {value > 0 ? '+' : ''}
      {value}
      {unit}
    </span>
  );
}

function Sparkline({ values, highlight }: { values: number[]; highlight: number }) {
  const width = 84;
  const height = 26;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => 4 + (i / Math.max(1, values.length - 1)) * (width - 8);
  const y = (v: number) => (max === min ? height / 2 : 4 + (1 - (v - min) / (max - min)) * (height - 8));
  return (
    <svg width={width} height={height} className="mx-auto block" aria-hidden>
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#2a78d6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === highlight ? 4 : 2} fill={i === highlight ? '#2a78d6' : '#ffffff'} stroke="#2a78d6" strokeWidth={i === highlight ? 2 : 1.5} />
      ))}
    </svg>
  );
}

/** Bullet chart: measured bar against a target tick, with an on-track status. */
function Bullet({
  label,
  value,
  display,
  target,
  targetLabel,
  max,
  lowerIsBetter = false,
  note,
}: {
  label: string;
  value: number;
  display: string;
  target: number;
  targetLabel: string;
  max: number;
  lowerIsBetter?: boolean;
  note: string;
}) {
  const onTrack = lowerIsBetter ? value <= target : value >= target;
  return (
    <li className="px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-text-main">{label}</div>
          <div className="text-[11px] text-text-muted">{note}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-lg font-semibold tabular-nums text-text-main">{display}</span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              onTrack ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'
            )}
          >
            {onTrack ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {onTrack ? 'On track' : 'Below target'}
          </span>
        </div>
      </div>
      <div className="relative mt-3 h-2.5 rounded-full bg-[#eef0f4]">
        <div className="h-full rounded-full bg-[#2a78d6] transition-[width] duration-500" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
        <span className="absolute -top-1 h-[18px] w-0.5 rounded bg-text-main" style={{ left: `calc(${(target / max) * 100}% - 1px)` }} aria-hidden />
      </div>
      <div className="relative mt-1 h-3.5 text-[10px] text-text-muted">
        {/* Keep the label inside the track when the target sits at the far end. */}
        <span
          className={cn('absolute whitespace-nowrap', target / max > 0.9 ? '-translate-x-full' : '-translate-x-1/2')}
          style={{ left: `${(target / max) * 100}%` }}
        >
          {targetLabel}
        </span>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------- View */

export function StatisticsView({
  reports,
  onDownload,
}: {
  reports: { title: string; type: string; date: string }[];
  onDownload: (report: { title: string; type: string; date: string }) => void;
}) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const index = mockYearlyActivity.findIndex((row) => row.year === year);
  const current = mockYearlyActivity[index];
  const previous = index > 0 ? mockYearlyActivity[index - 1] : null;
  const isYtd = year === CURRENT_YEAR;
  // Counts for a partial year can't be compared with a full year; rates can.
  const countDelta = (key: 'filed' | 'approved') => (previous && !isYtd ? current[key] - previous[key] : null);

  const scorecard = [
    { label: 'Measures filed', value: current.filed, suffix: '', delta: countDelta('filed'), note: isYtd ? 'January–September' : 'Full year' },
    { label: 'Measures approved', value: current.approved, suffix: '', delta: countDelta('approved'), note: isYtd ? 'January–September' : 'Full year' },
    { label: 'Approval rate', value: approvalRate(current), suffix: '%', delta: previous ? approvalRate(current) - approvalRate(previous) : null, unit: ' pts' },
    { label: 'Sessions held', value: current.sessionsHeld, suffix: ` / ${current.sessionsPlanned}`, delta: null, note: `${sessionRate(current)}% of scheduled sessions` },
    { label: 'Avg. days to approval', value: current.avgDaysToApprove, suffix: ' days', delta: previous ? current.avgDaysToApprove - previous.avgDaysToApprove : null, unit: 'd', lowerIsBetter: true },
  ];

  const yoyRows: { label: string; values: number[]; format: (v: number) => string }[] = [
    { label: 'Measures filed', values: mockYearlyActivity.map((row) => row.filed), format: String },
    { label: 'Measures approved', values: mockYearlyActivity.map((row) => row.approved), format: String },
    { label: 'Approval rate', values: mockYearlyActivity.map(approvalRate), format: (v) => `${v}%` },
    { label: 'Sessions held', values: mockYearlyActivity.map((row) => row.sessionsHeld), format: String },
    { label: 'Quorum rate', values: mockYearlyActivity.map((row) => row.quorumRate), format: (v) => `${v}%` },
    { label: 'Published on time', values: mockYearlyActivity.map((row) => row.publishedOnTime), format: (v) => `${v}%` },
    { label: 'Avg. days to approval', values: mockYearlyActivity.map((row) => row.avgDaysToApprove), format: (v) => `${v}` },
  ];

  const first = mockYearlyActivity[0];
  const bestQuorum = Math.max(...mockYearlyActivity.map((row) => row.quorumRate));
  const latest = mockYearlyActivity[mockYearlyActivity.length - 1];
  // Compare with the prior year; the earliest year has none, so it is compared with the latest instead.
  const findings: { text: string; good: boolean }[] = [
    previous
      ? {
          text: `Average days to approval ${current.avgDaysToApprove <= previous.avgDaysToApprove ? 'fell' : 'rose'} from ${previous.avgDaysToApprove} days in ${previous.year} to ${current.avgDaysToApprove} days in ${yearLabel(year)}.`,
          good: current.avgDaysToApprove <= previous.avgDaysToApprove,
        }
      : {
          text: `Average days to approval was ${current.avgDaysToApprove} days in ${year}; it has since fallen to ${latest.avgDaysToApprove} days (${yearLabel(latest.year)}).`,
          good: current.avgDaysToApprove <= 60,
        },
    {
      text: `Approval rate is ${approvalRate(current)}% in ${yearLabel(year)}, ${approvalRate(current) >= 75 ? 'meeting' : `${75 - approvalRate(current)} points short of`} the 75% target.`,
      good: approvalRate(current) >= 75,
    },
    {
      text:
        current.quorumRate === bestQuorum
          ? `Quorum rate of ${current.quorumRate}% is the highest from ${first.year} to ${latest.year}.`
          : `Quorum rate of ${current.quorumRate}% is below the ${bestQuorum}% high reached from ${first.year} to ${latest.year}.`,
      good: current.quorumRate === bestQuorum,
    },
    previous
      ? {
          text: `${current.publishedOnTime}% of ordinances were posted on time, ${current.publishedOnTime >= previous.publishedOnTime ? 'up' : 'down'} from ${previous.publishedOnTime}% in ${previous.year}.`,
          good: current.publishedOnTime >= previous.publishedOnTime,
        }
      : {
          text: `${current.publishedOnTime}% of ordinances were posted on time in ${year}, ${current.publishedOnTime >= 90 ? 'meeting' : 'below'} the 90% target.`,
          good: current.publishedOnTime >= 90,
        },
  ];

  const maxHearings = Math.max(...mockCommitteeHearings.flatMap((row) => row.monthly));
  const heatColor = (value: number) => HEAT[Math.round((value / Math.max(1, maxHearings)) * (HEAT.length - 1))];
  const hearingTotals = mockCommitteeHearings.map((row) => row.monthly.reduce((sum, v) => sum + v, 0));
  const maxTotal = Math.max(1, ...hearingTotals);

  return (
    <div className="space-y-6">
      {/* Scorecard banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a237e] via-[#16207a] to-[#0d1452] text-white shadow-[0_18px_40px_-18px_rgba(13,20,82,0.7)]">
        <span className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.06]" aria-hidden />
        <span className="pointer-events-none absolute -bottom-32 right-40 h-64 w-64 rounded-full bg-[#d4a72c]/10" aria-hidden />
        <div className="relative flex flex-col gap-4 px-6 pt-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8c766]">Performance Scorecard</p>
            <h2 className="mt-1 text-xl font-semibold">
              Fiscal Year {year}
              {isYtd ? <span className="ml-2 text-sm font-normal text-white/70">January–September, year to date</span> : null}
            </h2>
          </div>
          <div className="inline-flex rounded-lg bg-white/10 p-1" role="group" aria-label="Reporting year">
            {mockYearlyActivity.map((row) => (
              <button
                key={row.year}
                type="button"
                onClick={() => setYear(row.year)}
                aria-pressed={row.year === year}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  row.year === year ? 'bg-white text-primary shadow-sm' : 'text-white/75 hover:bg-white/10 hover:text-white'
                )}
              >
                {yearLabel(row.year)}
              </button>
            ))}
          </div>
        </div>
        <dl className="relative mt-6 grid grid-cols-2 gap-y-6 border-t border-white/15 px-6 py-6 md:grid-cols-3 xl:grid-cols-5 xl:divide-x xl:divide-white/15">
          {scorecard.map((item) => (
            <div key={item.label} className="xl:px-5 xl:first:pl-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/65">{item.label}</dt>
              <dd className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-semibold leading-none">
                  <CountUp key={`${year}-${item.label}`} value={item.value} />
                </span>
                {item.suffix ? <span className="text-base font-medium text-white/70">{item.suffix}</span> : null}
              </dd>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/65">
                <Delta value={item.delta} unit={item.unit} lowerIsBetter={item.lowerIsBetter} />
                {item.delta !== null && previous ? <span>vs {previous.year}</span> : null}
                {item.note ? <span>{item.note}</span> : null}
              </div>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Targets */}
        <Section className="xl:col-span-2" title="Performance vs Target" subtitle={`Key indicators for ${yearLabel(year)}; the dark tick marks each target`}>
          <ul className="divide-y divide-border">
            <Bullet label="Approval rate" note="Measures approved ÷ filed" value={approvalRate(current)} display={`${approvalRate(current)}%`} target={75} targetLabel="Target 75%" max={100} />
            <Bullet label="Sessions held" note="Held ÷ scheduled sessions" value={sessionRate(current)} display={`${sessionRate(current)}%`} target={100} targetLabel="Target 100%" max={100} />
            <Bullet label="Quorum rate" note="Sessions opened with a quorum" value={current.quorumRate} display={`${current.quorumRate}%`} target={95} targetLabel="Target 95%" max={100} />
            <Bullet label="Published on time" note="Ordinances posted within the required period" value={current.publishedOnTime} display={`${current.publishedOnTime}%`} target={90} targetLabel="Target 90%" max={100} />
            <Bullet
              label="Days to approval"
              note="Average from filing to approval; lower is better"
              value={current.avgDaysToApprove}
              display={`${current.avgDaysToApprove} days`}
              target={60}
              targetLabel="Max 60 days"
              max={120}
              lowerIsBetter
            />
          </ul>
        </Section>

        {/* Year over year */}
        <Section className="xl:col-span-3" title="Year-over-Year Comparison" subtitle="Select a year to highlight it; the trend shows 2023 to 2026">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicator</TableHead>
                  {mockYearlyActivity.map((row) => (
                    <TableHead key={row.year} className={cn(row.year === year && 'bg-primary/[0.07] text-primary')}>
                      <button type="button" onClick={() => setYear(row.year)} className="uppercase hover:underline">
                        {yearLabel(row.year)}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yoyRows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="whitespace-nowrap font-medium text-text-main">{row.label}</TableCell>
                    {row.values.map((value, i) => (
                      <TableCell
                        key={mockYearlyActivity[i].year}
                        className={cn('tabular-nums', mockYearlyActivity[i].year === year ? 'bg-primary/[0.05] font-semibold text-primary' : 'text-text-main')}
                      >
                        {row.format(value)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Sparkline values={row.values} highlight={index} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t border-border px-5 py-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Key findings</h3>
            <ul className="mt-2 space-y-2">
              {findings.map((finding) => (
                <li key={finding.text} className="flex items-start gap-2.5 text-[13px] leading-snug text-text-main">
                  <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full', finding.good ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
                    {finding.good ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  </span>
                  <span>{finding.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </div>

      {/* Committee heatmap */}
      <Section
        title="Committee Hearings"
        subtitle="Hearings held by each committee per month, January–September 2026"
        action={
          <div className="hidden items-center gap-1.5 text-[11px] text-text-muted sm:flex" aria-hidden>
            Fewer
            {HEAT.map((color) => (
              <span key={color} className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
            ))}
            More
          </div>
        }
      >
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[720px] border-separate border-spacing-1 text-center text-xs">
            <thead>
              <tr>
                <th className="w-64 px-2 text-left text-[11px] font-bold uppercase text-text-main">Committee</th>
                {MONTHS.map((month) => (
                  <th key={month} className="text-[11px] font-bold uppercase text-text-main">
                    {month}
                  </th>
                ))}
                <th className="w-32 text-[11px] font-bold uppercase text-text-main">Total</th>
              </tr>
            </thead>
            <tbody>
              {mockCommitteeHearings.map((row, rowIndex) => (
                <tr key={row.committee}>
                  <td className="truncate px-2 text-left text-[13px] font-medium text-text-main" title={row.committee}>
                    {row.committee}
                  </td>
                  {row.monthly.map((value, i) => (
                    <td key={MONTHS[i]} className="p-0">
                      <div
                        className={cn('flex h-9 items-center justify-center rounded-md font-semibold tabular-nums', value >= 4 ? 'text-white' : value === 0 ? 'text-text-muted' : 'text-text-main')}
                        style={{ backgroundColor: heatColor(value) }}
                        title={`${row.committee}, ${MONTHS[i]} 2026: ${value} hearing${value === 1 ? '' : 's'}`}
                      >
                        {value}
                      </div>
                    </td>
                  ))}
                  <td className="px-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-right text-[13px] font-semibold tabular-nums text-text-main">{hearingTotals[rowIndex]}</span>
                      <span className="h-1.5 flex-1 rounded-r-[4px] bg-[#f3f4f7]">
                        <span className="block h-1.5 rounded-r-[4px] bg-[#1d5bb0]" style={{ width: `${(hearingTotals[rowIndex] / maxTotal) * 100}%` }} />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Report library */}
      <Section title="Report Library" subtitle="Printable statistical and performance reports; save as PDF from the print dialog">
        <ul className="divide-y divide-border">
          {reports.map((report, i) => (
            <li key={report.title} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
              <span className="w-8 text-xs font-semibold tabular-nums text-text-muted">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-text-main">{report.title}</div>
                <div className="text-[11px] text-text-muted">Period: {report.date}</div>
              </div>
              <span
                className={cn(
                  'w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  report.type === 'Performance' ? 'border-violet-200 bg-violet-50 text-violet-800' : 'border-blue-200 bg-blue-50 text-blue-800'
                )}
              >
                {report.type}
              </span>
              <button
                type="button"
                onClick={() => onDownload(report)}
                className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-text-main transition-colors hover:border-primary hover:text-primary"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
