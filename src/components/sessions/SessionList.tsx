import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Bell, CalendarPlus, CheckCircle2, Clock, FileText, Inbox, Mail, MapPin, Plus, Printer, Send, Trash2, Undo2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { mockSessions, type Session } from '@/lib/mock-data';
import { addSessionToCalendar, buildAgenda, formatLongDate, printAgenda } from '@/lib/sessions';
import { todayInManila } from '@/lib/session-files';
import { cn } from '@/lib/utils';
import { logActivity } from '@/lib/activity-log';

const STATUS_FLOW = ['In Routing', 'For Committee', 'For Agenda Build', 'Ready to Transmit', 'Completed'] as const;
type Stage = (typeof STATUS_FLOW)[number];

const STAGE_STYLE: Record<Stage, { dot: string; column: string }> = {
  'In Routing': { dot: 'bg-slate-400', column: 'bg-slate-50' },
  'For Committee': { dot: 'bg-violet-500', column: 'bg-violet-50/50' },
  'For Agenda Build': { dot: 'bg-blue-500', column: 'bg-blue-50/50' },
  'Ready to Transmit': { dot: 'bg-amber-500', column: 'bg-amber-50/50' },
  Completed: { dot: 'bg-green-500', column: 'bg-green-50/50' },
};

const TYPES = ['Incoming letter', 'Committee report', 'Agenda', 'Transmittal', 'Position paper', 'Endorsement'] as const;
type TransactionType = (typeof TYPES)[number];

interface Transaction {
  id: string;
  item: string;
  type: TransactionType;
  origin: string;
  received: string;
  due: string;
  status: Stage;
}

const DAY = 86_400_000;
const toDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const addDays = (iso: string, days: number) => new Date(toDay(iso) + days * DAY).toISOString().slice(0, 10);
const shortDate = (iso: string) => new Date(toDay(iso)).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function SessionList() {
  const today = todayInManila();
  const [routingQueue, setRoutingQueue] = useState<Transaction[]>([
    { id: 'TR-001', item: 'Letter-request of Barangay Cristo Rey for road concreting funds', type: 'Incoming letter', origin: 'Barangay Cristo Rey', received: '2026-09-23', due: '2026-09-30', status: 'In Routing' },
    { id: 'TR-005', item: 'Endorsement of the municipal disaster preparedness plan', type: 'Endorsement', origin: 'MDRRMO Capas', received: '2026-09-24', due: '2026-10-01', status: 'In Routing' },
    { id: 'TR-002', item: 'Committee report on the Tricycle Franchising Ordinance', type: 'Committee report', origin: 'Committee on Transportation', received: '2026-09-18', due: '2026-09-28', status: 'For Committee' },
    { id: 'TR-008', item: 'Position paper on the proposed public market stall rates', type: 'Position paper', origin: 'Capas Market Vendors Association', received: '2026-09-15', due: '2026-09-22', status: 'For Committee' },
    { id: 'TR-003', item: 'Order of business for the 38th Regular Session', type: 'Agenda', origin: 'SB Secretariat', received: '2026-09-22', due: '2026-10-02', status: 'For Agenda Build' },
    { id: 'TR-004', item: 'Transmittal of Mun. Ord. No. 2026-007 to the Office of the Mayor', type: 'Transmittal', origin: 'SB Secretariat', received: '2026-09-22', due: '2026-09-25', status: 'Ready to Transmit' },
    { id: 'TR-006', item: 'Transmittal of SB Res. No. 2026-038 to the Provincial Agriculture Office', type: 'Transmittal', origin: 'SB Secretariat', received: '2026-09-10', due: '2026-09-15', status: 'Completed' },
  ]);
  const [assessmentQueue, setAssessmentQueue] = useState([
    { refNo: 'APP-2026-011', applicant: 'Barangay Cristo Rey', subject: 'Supplemental budget review', met: 8, total: 10, evaluation: 'For Revision', notified: false },
    { refNo: 'APP-2026-014', applicant: 'MDRRMO Capas', subject: 'Disaster preparedness plan', met: 10, total: 10, evaluation: 'Ready for Approval', notified: false },
    { refNo: 'APP-2026-016', applicant: 'Capas Tricycle Operators and Drivers Association', subject: 'Franchise renewal', met: 6, total: 10, evaluation: 'Incomplete Requirements', notified: true },
  ]);
  const [approvalQueue, setApprovalQueue] = useState([
    { docNo: 'Mun. Ord. No. 2026-007', title: 'Supplemental Appropriation for Barangay Disaster Preparedness Equipment', stage: 'For Mayor Review', received: '2026-09-22' },
    { docNo: 'SB Res. No. 2026-041', title: 'Resolution Endorsing the Sta. Lucia–New Clark City Access Road', stage: 'For Issuance', received: '2026-09-21' },
  ]);
  const notificationMatrix = [
    { event: 'Approval', system: true, email: true, recipients: ['Author', 'Secretariat', 'Concerned office'] },
    { event: 'Disapproval', system: true, email: true, recipients: ['Author', 'Committee chair'] },
    { event: 'Returned / incomplete', system: true, email: false, recipients: ['Originating office'] },
    { event: 'Publication / posting', system: true, email: true, recipients: ['Public subscribers', 'PIO'] },
  ];

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<{ item: string; type: TransactionType; origin: string; status: Stage; days: number }>({ item: '', type: 'Incoming letter', origin: '', status: 'In Routing', days: 7 });
  const [createError, setCreateError] = useState('');
  const [agendaSession, setAgendaSession] = useState<Session | null>(null);

  const dueChip = (entry: Transaction) => {
    if (entry.status === 'Completed') return { label: `Done · ${shortDate(entry.due)}`, tone: 'bg-green-50 text-green-700' };
    const days = Math.round((toDay(entry.due) - toDay(today)) / DAY);
    if (days < 0) return { label: `Overdue ${-days}d`, tone: 'bg-red-50 text-red-700' };
    if (days === 0) return { label: 'Due today', tone: 'bg-amber-50 text-amber-800' };
    return { label: `Due in ${days}d`, tone: 'bg-slate-100 text-slate-600' };
  };

  const open = routingQueue.filter((entry) => entry.status !== 'Completed');
  const overdue = open.filter((entry) => entry.due < today);
  const dueToday = open.filter((entry) => entry.due === today);

  const advanceQueue = async (id: string) => {
    const target = routingQueue.find((entry) => entry.id === id);
    const targetIdx = target ? STATUS_FLOW.indexOf(target.status) : -1;
    if (!target || targetIdx < 0 || targetIdx === STATUS_FLOW.length - 1) {
      toast('Status not updated', target ? `${target.id} is already ${target.status}.` : 'This transaction could not be found.', 'error');
      return;
    }
    const next = STATUS_FLOW[targetIdx + 1];
    const confirmed = await confirmAction({ title: 'Advance this transaction?', description: `${target.id} will move from ${target.status} to ${next}.`, confirmLabel: 'Advance' });
    if (!confirmed) return;
    setRoutingQueue((prev) => prev.map((entry) => (entry.id === id ? { ...entry, status: next } : entry)));
    toast('Status updated', `${target.id} moved to ${next}.`);
    logActivity({ module: 'Transactions', action: 'Updated', summary: `Moved ${target.id} to ${next}`, detail: target.item });
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const item = form.item.trim();
    if (!item) {
      setCreateError('Please describe the transaction.');
      return;
    }
    if (routingQueue.some((entry) => entry.item.toLowerCase() === item.toLowerCase() && entry.status !== 'Completed')) {
      setCreateError('This transaction is already in the routing queue.');
      return;
    }
    const confirmed = await confirmAction({ title: 'Create this transaction?', description: `"${item}" will be added to the board as ${form.status}.`, confirmLabel: 'Create transaction' });
    if (!confirmed) return;
    const id = `TR-${String(Math.max(0, ...routingQueue.map((entry) => Number(entry.id.replace(/\D/g, '')) || 0)) + 1).padStart(3, '0')}`;
    setRoutingQueue((prev) => [...prev, { id, item, type: form.type, origin: form.origin.trim() || 'SB Secretariat', received: today, due: addDays(today, form.days), status: form.status }]);
    setCreateOpen(false);
    toast('Transaction created', `${id} was added to the routing queue.`);
    logActivity({ module: 'Transactions', action: 'Created', summary: `Created transaction ${id}`, detail: item });
  };

  const deleteTransaction = async (id: string) => {
    const target = routingQueue.find((entry) => entry.id === id);
    if (!target) return;
    if (target.status === 'Completed') {
      toast('Transaction not deleted', `${target.id} is already completed and is kept as part of the routing record.`, 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Delete this transaction?',
      description: `${target.id} — "${target.item}" will be removed from the routing queue. This cannot be undone.`,
      confirmLabel: 'Delete transaction',
      tone: 'destructive',
    });
    if (!confirmed) return;
    setRoutingQueue((prev) => prev.filter((entry) => entry.id !== id));
    toast('Transaction deleted', `${target.id} was removed from the routing queue.`);
    logActivity({ module: 'Transactions', action: 'Deleted', summary: `Deleted transaction ${target.id}`, detail: target.item });
  };

  const decide = async (docNo: string, decision: 'approve' | 'return') => {
    const target = approvalQueue.find((item) => item.docNo === docNo);
    if (!target || target.stage.startsWith('Approved') || target.stage.startsWith('Returned')) {
      toast(decision === 'approve' ? 'Document not approved' : 'Document not returned', target ? `${docNo} already has a decision.` : `${docNo} could not be found.`, 'error');
      return;
    }
    const confirmed = await confirmAction(
      decision === 'approve'
        ? { title: 'Approve this document?', description: `${docNo} will be marked as approved and issued. This decision cannot be changed here.`, confirmLabel: 'Approve' }
        : { title: 'Return this document?', description: `${docNo} will be sent back to the originating office. This decision cannot be changed here.`, confirmLabel: 'Return document', tone: 'destructive' }
    );
    if (!confirmed) return;
    setApprovalQueue((prev) => prev.map((item) => (item.docNo === docNo ? { ...item, stage: decision === 'approve' ? 'Approved – Issued' : 'Returned to Originating Office' } : item)));
    toast(decision === 'approve' ? 'Document approved' : 'Document returned', decision === 'approve' ? `${docNo} was approved and issued.` : `${docNo} was returned to the originating office.`);
    logActivity({
      module: 'Transactions',
      action: decision === 'approve' ? 'Approved' : 'Returned',
      summary: decision === 'approve' ? `Approved and issued ${docNo}` : `Returned ${docNo} to the originating office`,
      detail: target.title,
    });
  };

  const notifyApplicant = (refNo: string) => {
    const target = assessmentQueue.find((item) => item.refNo === refNo);
    if (!target) return;
    setAssessmentQueue((prev) => prev.map((item) => (item.refNo === refNo ? { ...item, notified: true } : item)));
    toast('Evaluation notice sent', `${target.applicant} was notified: ${target.evaluation}.`, 'info');
    logActivity({ module: 'Transactions', action: 'Updated', summary: `Sent the evaluation notice for ${refNo}`, detail: `${target.applicant} · ${target.evaluation}` });
  };

  // Mini calendar for the month of the next session.
  const calendarMonth = (mockSessions[0]?.date ?? today).slice(0, 7);
  const [calYear, calMonth] = calendarMonth.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(calYear, calMonth - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(calYear, calMonth, 0)).getUTCDate();
  const sessionsByDay = new Map(mockSessions.filter((session) => session.date.startsWith(calendarMonth)).map((session) => [Number(session.date.slice(8, 10)), session]));
  const monthLabel = new Date(Date.UTC(calYear, calMonth - 1, 1)).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const sessionTone = (type: Session['type']) => (type === 'Regular' ? 'bg-primary text-white' : type === 'Special' ? 'bg-orange-500 text-white' : 'bg-violet-600 text-white');

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Transaction Operations</h1>
          <p className="text-sm text-text-muted">Documents moving through the Secretariat, from receiving to transmittal.</p>
        </div>
        <Button
          onClick={() => {
            setForm({ item: '', type: 'Incoming letter', origin: '', status: 'In Routing', days: 7 });
            setCreateError('');
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Transaction
        </Button>
      </div>

      {/* Routing board */}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <header className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-main">Routing Board</h2>
            <p className="text-xs text-text-muted">Move each document to the next stage as it is processed</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-muted px-2.5 py-1 text-text-main">{open.length} open</span>
            <span className={cn('rounded-full px-2.5 py-1', dueToday.length ? 'bg-amber-50 text-amber-800' : 'bg-muted text-text-muted')}>{dueToday.length} due today</span>
            <span className={cn('rounded-full px-2.5 py-1', overdue.length ? 'bg-red-50 text-red-700' : 'bg-muted text-text-muted')}>{overdue.length} overdue</span>
          </div>
        </header>
        <div className="overflow-x-auto p-4">
          <div className="grid min-w-[1100px] grid-cols-5 gap-3">
            {STATUS_FLOW.map((stage, stageIndex) => {
              const cards = routingQueue.filter((entry) => entry.status === stage);
              return (
                <div key={stage} className={cn('flex flex-col rounded-lg p-2.5', STAGE_STYLE[stage].column)}>
                  <div className="mb-2.5 flex items-center justify-between px-1">
                    <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-text-main">
                      <span className={cn('h-2 w-2 rounded-full', STAGE_STYLE[stage].dot)} />
                      {stage}
                    </span>
                    <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold tabular-nums text-text-muted shadow-sm">{cards.length}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    {cards.map((entry) => {
                      const due = dueChip(entry);
                      const next = STATUS_FLOW[stageIndex + 1];
                      return (
                        <article key={entry.id} className={cn('rounded-lg border bg-white p-3 shadow-sm', entry.status !== 'Completed' && entry.due < today ? 'border-red-200' : 'border-border')}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] text-text-muted">{entry.id}</span>
                            <span className={cn('rounded-full px-1.5 py-px text-[10px] font-semibold', due.tone)}>{due.label}</span>
                          </div>
                          <p className="mt-1.5 line-clamp-3 text-[12px] font-semibold leading-snug text-text-main" title={entry.item}>
                            {entry.item}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-text-muted">
                            <span className="rounded bg-muted px-1.5 py-px font-medium text-text-main">{entry.type}</span>
                            <span className="truncate" title={entry.origin}>
                              from {entry.origin}
                            </span>
                          </div>
                          {next ? (
                            <div className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2">
                              <button
                                type="button"
                                onClick={() => advanceQueue(entry.id)}
                                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-primary/[0.06] px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                              >
                                <span className="truncate">{next}</span>
                                <ArrowRight className="h-3 w-3 shrink-0" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteTransaction(entry.id)}
                                className="rounded-md p-1 text-text-muted transition-colors hover:bg-red-50 hover:text-red-700"
                                aria-label={`Delete ${entry.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                    {cards.length === 0 ? <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11px] text-text-muted">Nothing here</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Approval tray */}
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm xl:col-span-2">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-text-main">Approval &amp; Issuance</h2>
              <p className="text-xs text-text-muted">Documents waiting for a decision</p>
            </div>
            <Inbox className="h-5 w-5 text-text-muted" />
          </header>
          <ul className="space-y-3 p-4">
            {approvalQueue.map((item) => {
              const decided = item.stage.startsWith('Approved') || item.stage.startsWith('Returned');
              const approved = item.stage.startsWith('Approved');
              return (
                <li key={item.docNo} className={cn('rounded-lg border p-3.5', decided ? (approved ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40') : 'border-border')}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-text-main">{item.docNo}</div>
                      <div className="text-xs leading-snug text-text-muted">{item.title}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        decided ? (approved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800') : 'bg-amber-50 text-amber-800'
                      )}
                    >
                      {decided ? approved ? <CheckCircle2 className="h-3 w-3" /> : <Undo2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {item.stage}
                    </span>
                    {!decided ? (
                      <span className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-8" onClick={() => decide(item.docNo, 'return')}>
                          Return
                        </Button>
                        <Button size="sm" className="h-8" onClick={() => decide(item.docNo, 'approve')}>
                          Approve
                        </Button>
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-muted">Received {shortDate(item.received)}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Evaluation */}
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm xl:col-span-3">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-text-main">Assessment &amp; Evaluation</h2>
            <p className="text-xs text-text-muted">Applications checked against their documentary requirements</p>
          </header>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application</TableHead>
                  <TableHead>Requirements</TableHead>
                  <TableHead>Evaluation</TableHead>
                  <TableHead>Notice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessmentQueue.map((item) => {
                  const complete = item.met === item.total;
                  return (
                    <TableRow key={item.refNo}>
                      <TableCell>
                        <div className="font-mono text-[11px] text-text-muted">{item.refNo}</div>
                        <div className="font-medium text-text-main">{item.applicant}</div>
                        <div className="text-[11px] text-text-muted">{item.subject}</div>
                      </TableCell>
                      <TableCell>
                        <div className="mx-auto w-32">
                          <div className="flex gap-0.5">
                            {Array.from({ length: item.total }, (_, i) => (
                              <span key={i} className={cn('h-2 flex-1 rounded-sm', i < item.met ? (complete ? 'bg-green-500' : 'bg-[#2a78d6]') : 'bg-[#e5e7eb]')} />
                            ))}
                          </div>
                          <div className="mt-1 text-[11px] tabular-nums text-text-muted">
                            {item.met} of {item.total} met
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold',
                            complete ? 'border-green-200 bg-green-50 text-green-800' : item.met >= 8 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-800'
                          )}
                        >
                          {item.evaluation}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.notified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Sent
                          </span>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8" onClick={() => notifyApplicant(item.refNo)}>
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                            Notify
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Session calendar */}
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm xl:col-span-3">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-text-main">Session Calendar</h2>
            <p className="text-xs text-text-muted">Scheduled sessions and hearings</p>
          </header>
          <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[250px_1fr]">
            <div>
              <div className="mb-2 text-center text-sm font-semibold text-text-main">{monthLabel}</div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-text-muted">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: firstWeekday }, (_, i) => (
                  <span key={`blank-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const session = sessionsByDay.get(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={!session}
                      onClick={() => session && setAgendaSession(session)}
                      title={session ? session.title : undefined}
                      className={cn(
                        'flex aspect-square items-center justify-center rounded-md text-[12px] tabular-nums',
                        session ? cn(sessionTone(session.type), 'font-semibold shadow-sm hover:opacity-90') : 'text-text-main'
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-3 text-[10px] text-text-muted">
                {(['Regular', 'Committee Hearing', 'Special'] as const).map((type) => (
                  <span key={type} className="inline-flex items-center gap-1">
                    <span className={cn('h-2.5 w-2.5 rounded-sm', sessionTone(type))} />
                    {type}
                  </span>
                ))}
              </div>
            </div>
            <ol className="space-y-3">
              {mockSessions.map((session) => (
                <li key={session.id} className="rounded-lg border border-border p-3.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('rounded px-1.5 py-px text-[10px] font-semibold', sessionTone(session.type))}>{session.type}</span>
                    <span className="text-[11px] text-text-muted">{formatLongDate(session.date)}</span>
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-text-main">{session.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {session.time}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {session.location}
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setAgendaSession(session)}>
                      <FileText className="mr-1 h-3.5 w-3.5" />
                      Agenda
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => addSessionToCalendar(session)}>
                      <CalendarPlus className="mr-1 h-3.5 w-3.5" />
                      Calendar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => toast('Stream not live yet', `The live stream opens on ${formatLongDate(session.date)} at ${session.time}.`, 'info')}
                    >
                      <Video className="mr-1 h-3.5 w-3.5" />
                      Stream
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Notification rules */}
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm xl:col-span-2">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-text-main">Notification Rules</h2>
            <p className="text-xs text-text-muted">Who is alerted when a document changes status</p>
          </header>
          <ul className="divide-y divide-border">
            {notificationMatrix.map((rule) => (
              <li key={rule.event} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-text-main">{rule.event}</span>
                  <span className="flex gap-1">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', rule.system ? 'bg-primary/10 text-primary' : 'bg-muted text-text-muted line-through')}>
                      <Bell className="h-3 w-3" />
                      System
                    </span>
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', rule.email ? 'bg-primary/10 text-primary' : 'bg-muted text-text-muted line-through')}>
                      <Mail className="h-3 w-3" />
                      Email
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {rule.recipients.map((recipient) => (
                    <span key={recipient} className="rounded border border-border bg-background px-1.5 py-px text-[11px] text-text-muted">
                      {recipient}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">New Transaction</DialogTitle>
            <DialogDescription>Log a document received by the Secretariat and place it on the routing board.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="mt-5 space-y-3">
            <Input value={form.item} onChange={(e) => setForm((prev) => ({ ...prev, item: e.target.value }))} placeholder="e.g. Transmittal of Mun. Ord. No. 2026-005 to the Sangguniang Panlalawigan" aria-label="Transaction" />
            <Input value={form.origin} onChange={(e) => setForm((prev) => ({ ...prev, origin: e.target.value }))} placeholder="From (office or sender)" aria-label="Origin" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block text-xs font-semibold text-text-muted">
                Type
                <select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as TransactionType }))} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-normal text-text-main">
                  {TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-text-muted">
                Starting stage
                <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Stage }))} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-normal text-text-main">
                  {STATUS_FLOW.slice(0, -1).map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-text-muted">
                Due in
                <select value={form.days} onChange={(e) => setForm((prev) => ({ ...prev, days: Number(e.target.value) }))} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-normal text-text-main">
                  {[3, 5, 7, 10, 15].map((days) => (
                    <option key={days} value={days}>
                      {days} days
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {createError ? <p className="text-xs text-red-700">{createError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={agendaSession !== null} onOpenChange={(open) => !open && setAgendaSession(null)}>
        <DialogContent className="max-w-2xl">
          {agendaSession ? (
            <>
              <DialogHeader>
                <p className="text-xs font-bold uppercase tracking-wider text-secondary">{agendaSession.type}</p>
                <DialogTitle className="text-xl text-primary">{agendaSession.title}</DialogTitle>
                <DialogDescription>
                  {formatLongDate(agendaSession.date)} · {agendaSession.time} · {agendaSession.location}
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
