import { useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCheck, Clock, Info, Megaphone, Newspaper, Printer } from 'lucide-react';
import { mockPublications } from '@/lib/mock-data';
import { todayInManila } from '@/lib/session-files';
import { cn } from '@/lib/utils';
import { AttendanceRecordsPanel } from '@/components/reports/AttendanceRecordsPanel';
import { useAttendanceRecords } from '@/lib/attendance-records';
import { useModules } from '@/lib/modules';
import { EFFECTIVITY_DAYS, POSTING_DEADLINE_DAYS, PUBLICATION_TONE, addDays, publicationStatus } from '@/lib/publication';

// Posting rules (deadline, effectivity) live in src/lib/publication.ts.
const POSTING_PLACES = 3;

const toDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const shortDate = (iso: string) => new Date(toDay(iso)).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });


function Callout({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-[13px] leading-relaxed',
        tone === 'info' ? 'border-blue-200 bg-blue-50/60 text-blue-950' : 'border-amber-200 bg-amber-50 text-amber-950'
      )}
    >
      {tone === 'info' ? <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />}
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------ Publication */

function PublicationPanel() {
  const today = todayInManila();
  const records = useMemo(
    () =>
      mockPublications.map((record) => ({
        ...record,
        deadline: addDays(record.approvedOn, POSTING_DEADLINE_DAYS),
        effectiveOn: record.postedOn ? addDays(record.postedOn, EFFECTIVITY_DAYS) : null,
        status: publicationStatus(record, today),
      })),
    [today]
  );

  // Timeline spans from a few days before the earliest approval to a week past the latest effectivity.
  const start = addDays(records.reduce((min, r) => (r.approvedOn < min ? r.approvedOn : min), records[0].approvedOn), -4);
  const lastDate = records.reduce((max, r) => {
    const end = r.effectiveOn ?? addDays(today, EFFECTIVITY_DAYS);
    return end > max ? end : max;
  }, today);
  const end = addDays(lastDate, 7);
  const span = toDay(end) - toDay(start);
  const pos = (iso: string) => `${((toDay(iso) - toDay(start)) / span) * 100}%`;
  const width = (from: string, to: string) => `${(Math.max(0, toDay(to) - toDay(from)) / span) * 100}%`;
  const weeks: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 7)) weeks.push(d);

  const counts = (['Effective', 'Awaiting effectivity', 'For posting', 'Posting overdue'] as const).map((status) => ({
    status,
    count: records.filter((record) => record.status === status).length,
  }));
  const overdue = records.filter((record) => record.status === 'Posting overdue');
  const newspaperPending = records.filter((record) => record.penalClause && !record.newspaperOn);

  return (
    <div className="space-y-6">
      <Callout>
        Approved ordinances are posted within <b>{POSTING_DEADLINE_DAYS} days</b> at the Municipal Hall bulletin board and at least two other conspicuous places, and take
        effect <b>{EFFECTIVITY_DAYS} days after posting</b>. Ordinances with penal sanctions also need their gist published in a newspaper of general circulation.
      </Callout>

      {overdue.length > 0 || newspaperPending.length > 0 ? (
        <Callout tone="warning">
          {overdue.length > 0 ? (
            <>
              <b>{overdue.map((record) => record.number).join(', ')}</b> passed {overdue.length === 1 ? 'its' : 'their'} posting deadline.{' '}
            </>
          ) : null}
          {newspaperPending.length > 0 ? (
            <>
              Newspaper publication is still pending for <b>{newspaperPending.map((record) => record.number).join(', ')}</b>.
            </>
          ) : null}
        </Callout>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {counts.map(({ status, count }) => (
          <span key={status} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold', PUBLICATION_TONE[status])}>
            <span className="text-sm tabular-nums">{count}</span>
            {status}
          </span>
        ))}
      </div>

      {/* Posting timeline */}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <header className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-main">Posting &amp; Effectivity Timeline</h2>
            <p className="text-xs text-text-muted">From approval to posting to effectivity, for each ordinance</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-sm border border-amber-300 bg-amber-100" /> Posting window
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-sm bg-[#2a78d6]" /> Posting to effectivity
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-0.5 bg-red-500" /> Today
            </span>
          </div>
        </header>

        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            {/* Axis */}
            <div className="grid grid-cols-[340px_1fr_190px] border-b border-border bg-muted/40 text-[11px] font-bold uppercase text-text-main">
              <div className="px-5 py-2">Ordinance</div>
              <div className="relative">
                {weeks.map((week) => (
                  <span key={week} className="absolute top-2 -translate-x-1/2 whitespace-nowrap font-medium normal-case text-text-muted" style={{ left: pos(week) }}>
                    {shortDate(week)}
                  </span>
                ))}
              </div>
              <div className="px-4 py-2 text-center">Compliance</div>
            </div>

            {records.map((record) => (
              <div key={record.number} className="grid grid-cols-[340px_1fr_190px] items-center border-b border-border last:border-b-0">
                <div className="min-w-0 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-text-main">{record.number}</span>
                    <span className={cn('whitespace-nowrap rounded-full border px-2 py-px text-[10px] font-semibold', PUBLICATION_TONE[record.status])}>{record.status}</span>
                  </div>
                  <div className="truncate text-xs text-text-muted" title={record.title}>
                    {record.title}
                  </div>
                </div>

                <div className="relative h-full min-h-[64px]">
                  {weeks.map((week) => (
                    <span key={week} className="absolute inset-y-0 w-px bg-[#f0f1f4]" style={{ left: pos(week) }} aria-hidden />
                  ))}
                  {/* Posting window: approval to the posting deadline. */}
                  <span
                    className="absolute top-1/2 h-4 -translate-y-1/2 rounded border border-amber-300 bg-amber-100"
                    style={{ left: pos(record.approvedOn), width: width(record.approvedOn, record.deadline) }}
                    title={`Approved ${shortDate(record.approvedOn)} · post by ${shortDate(record.deadline)}`}
                  />
                  {record.postedOn && record.effectiveOn ? (
                    <span
                      className="absolute top-1/2 h-4 -translate-y-1/2 rounded bg-[#2a78d6]"
                      style={{ left: pos(record.postedOn), width: width(record.postedOn, record.effectiveOn) }}
                      title={`Posted ${shortDate(record.postedOn)} · effective ${shortDate(record.effectiveOn)}`}
                    />
                  ) : null}
                  {record.effectiveOn ? (
                    <span className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-1.5 text-[10px] font-semibold text-text-main" style={{ left: pos(record.effectiveOn) }}>
                      Effective {shortDate(record.effectiveOn)}
                    </span>
                  ) : (
                    <span
                      className={cn('absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-1.5 text-[10px] font-semibold', record.status === 'Posting overdue' ? 'text-red-700' : 'text-amber-800')}
                      style={{ left: pos(record.deadline) }}
                    >
                      {record.status === 'Posting overdue' ? `Overdue since ${shortDate(record.deadline)}` : `Post by ${shortDate(record.deadline)}`}
                    </span>
                  )}
                  <span className="absolute inset-y-0 w-0.5 bg-red-500" style={{ left: pos(today) }} aria-hidden />
                </div>

                <div className="space-y-1 px-4 py-3 text-[11px]">
                  <div className={cn('flex items-center gap-1.5', record.placesPosted >= POSTING_PLACES ? 'text-green-700' : 'text-amber-700')}>
                    <Megaphone className="h-3.5 w-3.5" />
                    Posted in {record.placesPosted}/{POSTING_PLACES} places
                  </div>
                  {record.penalClause ? (
                    <div className={cn('flex items-center gap-1.5', record.newspaperOn ? 'text-green-700' : 'text-red-700')}>
                      <Newspaper className="h-3.5 w-3.5" />
                      {record.newspaperOn ? `Newspaper, ${shortDate(record.newspaperOn)}` : 'Newspaper pending'}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-text-muted">
                      <Newspaper className="h-3.5 w-3.5" />
                      No penal clause
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------- View */

export function AttendancePublicationView({
  reports,
  onDownload,
}: {
  reports: { title: string; type: string; date: string }[];
  onDownload: (report: { title: string; type: string; date: string }) => void;
}) {
  const [chosen, setTab] = useState<'attendance' | 'publication'>('attendance');
  const attendanceCount = useAttendanceRecords().length;
  // Publication and posting is part of the Legislative Reports module.
  const withPublication = useModules().includes('reports');
  const tab = withPublication ? chosen : 'attendance';
  const tabs = [
    { id: 'attendance' as const, label: 'Attendance Records', icon: ClipboardCheck, count: attendanceCount, unit: 'records' },
    ...(withPublication ? [{ id: 'publication' as const, label: 'Publication & Posting', icon: Clock, count: mockPublications.length, unit: 'ordinances' }] : []),
  ];
  // Attendance records are opened and downloaded in the library itself; publication keeps its printable reports.
  const tabReports = tab === 'publication' ? reports.filter((report) => report.type === 'Publication') : [];

  return (
    <div className="space-y-6">
      {/* A lone tab says nothing the page title does not. */}
      {tabs.length > 1 ? (
      <div className="flex flex-col gap-3 border-b border-border xl:flex-row xl:items-end xl:justify-between">
        <div className="flex gap-1" role="tablist" aria-label="Report sections">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                '-mb-px inline-flex min-w-0 flex-1 items-center justify-center gap-2 border-b-2 px-2 py-2.5 text-center text-sm font-semibold transition-colors sm:flex-none sm:px-4',
                tab === item.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
              <span className={cn('rounded-full px-1.5 py-px text-[10px] tabular-nums', tab === item.id ? 'bg-primary text-white' : 'bg-muted text-text-muted')}>
                {item.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-2">
          {tabReports.map((report) => (
            <button
              key={report.title}
              type="button"
              onClick={() => onDownload(report)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-text-main transition-colors hover:border-primary hover:text-primary"
              title={`${report.title} · ${report.date}`}
            >
              <Printer className="h-3.5 w-3.5" />
              {report.title}
            </button>
          ))}
        </div>
      </div>

      ) : null}

      {tab === 'attendance' ? <AttendanceRecordsPanel /> : <PublicationPanel />}
    </div>
  );
}
