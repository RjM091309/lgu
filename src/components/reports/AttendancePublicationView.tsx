import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ClipboardCheck, Clock, Info, Megaphone, Newspaper, Printer, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockAttendanceMarks, mockAttendanceSessions, mockMembers, mockPublications, type AttendanceMark, type PublicationRecord } from '@/lib/mock-data';
import { todayInManila } from '@/lib/session-files';
import { cn } from '@/lib/utils';

// Quorum is a majority of all members of the Sanggunian.
const QUORUM = Math.floor(mockMembers.length / 2) + 1;
// Posting rules applied by the tracker: post within 5 days of approval; effective 10 days after posting.
const POSTING_DEADLINE_DAYS = 5;
const EFFECTIVITY_DAYS = 10;
const POSTING_PLACES = 3;

const DAY = 86_400_000;
const toDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const addDays = (iso: string, days: number) => new Date(toDay(iso) + days * DAY).toISOString().slice(0, 10);
const shortDate = (iso: string) => new Date(toDay(iso)).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });

type PublicationStatus = 'Effective' | 'Awaiting effectivity' | 'For posting' | 'Posting overdue';

const PUBLICATION_TONE: Record<PublicationStatus, string> = {
  Effective: 'border-green-200 bg-green-50 text-green-800',
  'Awaiting effectivity': 'border-blue-200 bg-blue-50 text-blue-800',
  'For posting': 'border-amber-200 bg-amber-50 text-amber-800',
  'Posting overdue': 'border-red-200 bg-red-50 text-red-800',
};

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

function Mark({ mark }: { mark: AttendanceMark }) {
  if (mark === 'P') return <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-white" aria-label="Present"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>;
  if (mark === 'L') return <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-50 text-[10px] font-bold text-amber-700" aria-label="Late">L</span>;
  return <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 border-red-300 text-red-500" aria-label="Absent"><X className="h-3.5 w-3.5" strokeWidth={3} /></span>;
}

/* ------------------------------------------------------------- Attendance */

function AttendancePanel() {
  const rows = mockMembers.map((member) => {
    const marks = (mockAttendanceMarks[member.id] ?? '').split('') as AttendanceMark[];
    const attended = marks.filter((mark) => mark !== 'A').length;
    return { member, marks, attended, rate: Math.round((attended / mockAttendanceSessions.length) * 100) };
  });
  const perSession = mockAttendanceSessions.map((_, i) => rows.filter((row) => row.marks[i] !== 'A').length);
  const quorumCount = perSession.filter((count) => count >= QUORUM).length;
  const averageRate = Math.round(rows.reduce((sum, row) => sum + row.rate, 0) / rows.length);

  return (
    <div className="space-y-6">
      <Callout>
        Quorum was reached in <b>{quorumCount} of {mockAttendanceSessions.length}</b> sessions from July to September 2026, with an average attendance of{' '}
        <b>{averageRate}%</b>. A quorum requires a majority of all members: <b>{QUORUM} of {mockMembers.length}</b>.
      </Callout>

      {/* Session timeline */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-text-main">Session Timeline</h2>
        <p className="text-xs text-text-muted">Each session with the number of members present</p>
        <div className="overflow-x-auto">
          <ol className="relative mt-5 flex min-w-[760px] justify-between px-2">
            <span className="absolute left-8 right-8 top-[15px] h-0.5 bg-border" aria-hidden />
            {mockAttendanceSessions.map((session, i) => {
              const hasQuorum = perSession[i] >= QUORUM;
              return (
                <li key={session.id} className="relative flex w-20 flex-col items-center text-center">
                  <span
                    className={cn(
                      'relative z-[1] flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-white',
                      hasQuorum ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    )}
                    title={hasQuorum ? 'Quorum reached' : 'No quorum'}
                  >
                    {hasQuorum ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}
                  </span>
                  <span className="mt-2 text-[12px] font-semibold text-text-main">{session.short}</span>
                  <span className="text-[11px] text-text-muted">{shortDate(session.date)}</span>
                  <span className={cn('mt-1 text-[11px] font-semibold tabular-nums', hasQuorum ? 'text-text-main' : 'text-red-700')}>
                    {perSession[i]}/{mockMembers.length}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Roll-call register */}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <header className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-main">Roll-Call Register</h2>
            <p className="text-xs text-text-muted">Attendance of every member per session; shaded columns had no quorum</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-text-muted">
            {(['P', 'L', 'A'] as const).map((mark) => (
              <span key={mark} className="inline-flex items-center gap-1.5">
                <span className="scale-75">
                  <Mark mark={mark} />
                </span>
                {mark === 'P' ? 'Present' : mark === 'L' ? 'Late' : 'Absent'}
              </span>
            ))}
          </div>
        </header>
        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Member</TableHead>
                {mockAttendanceSessions.map((session, i) => (
                  <TableHead key={session.id} className={cn('px-1', perSession[i] < QUORUM && 'bg-red-50 text-red-800')}>
                    <div>{session.short}</div>
                    <div className="text-[10px] font-medium normal-case text-text-muted">{shortDate(session.date)}</div>
                  </TableHead>
                ))}
                <TableHead>Attended</TableHead>
                <TableHead>Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.member.id}>
                  <TableCell className="text-left">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">{row.member.abbr}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-text-main">{row.member.name}</span>
                        <span className="block text-[11px] text-text-muted">{row.member.seat}</span>
                      </span>
                    </div>
                  </TableCell>
                  {row.marks.map((mark, i) => (
                    <TableCell key={mockAttendanceSessions[i].id} className={cn('px-1 py-2', perSession[i] < QUORUM && 'bg-red-50/60')}>
                      <Mark mark={mark} />
                    </TableCell>
                  ))}
                  <TableCell className="tabular-nums text-text-main">
                    {row.attended}/{mockAttendanceSessions.length}
                  </TableCell>
                  <TableCell>
                    <span className={cn('font-semibold tabular-nums', row.rate >= 90 ? 'text-green-700' : row.rate >= 75 ? 'text-amber-700' : 'text-red-700')}>{row.rate}%</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className="text-left">Members present</TableCell>
                {perSession.map((count, i) => (
                  <TableCell key={mockAttendanceSessions[i].id} className={cn('px-1', count < QUORUM && 'bg-red-50 text-red-800')}>
                    <div className="tabular-nums">{count}</div>
                    <div className="text-[10px] font-medium">{count >= QUORUM ? 'Quorum' : 'No quorum'}</div>
                  </TableCell>
                ))}
                <TableCell colSpan={2} className="tabular-nums">
                  Avg. {averageRate}%
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------ Publication */

function publicationStatus(record: PublicationRecord, today: string): PublicationStatus {
  if (!record.postedOn) return today > addDays(record.approvedOn, POSTING_DEADLINE_DAYS) ? 'Posting overdue' : 'For posting';
  return today >= addDays(record.postedOn, EFFECTIVITY_DAYS) ? 'Effective' : 'Awaiting effectivity';
}

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
  const [tab, setTab] = useState<'attendance' | 'publication'>('attendance');
  const tabs = [
    { id: 'attendance' as const, label: 'Attendance & Quorum', icon: ClipboardCheck, count: mockAttendanceSessions.length, unit: 'sessions' },
    { id: 'publication' as const, label: 'Publication & Posting', icon: Clock, count: mockPublications.length, unit: 'ordinances' },
  ];
  const tabReports = reports.filter((report) => (tab === 'attendance' ? report.type === 'Attendance' : report.type === 'Publication'));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border md:flex-row md:items-end md:justify-between">
        <div className="flex gap-1" role="tablist" aria-label="Report sections">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                '-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
                tab === item.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'
              )}
            >
              <item.icon className="h-4 w-4" />
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

      {tab === 'attendance' ? <AttendancePanel /> : <PublicationPanel />}
    </div>
  );
}
