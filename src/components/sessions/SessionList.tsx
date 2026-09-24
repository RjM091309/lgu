import { useState } from 'react';
import type { FormEvent } from 'react';
import { CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { mockSessions, type Session } from '@/lib/mock-data';
import { addSessionToCalendar, buildAgenda, formatLongDate, printAgenda } from '@/lib/sessions';
import { Calendar as CalendarIcon, CalendarPlus, Clock, MapPin, Users2, Video, FileText, Printer, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_FLOW = ['In Routing', 'For Committee', 'For Agenda Build', 'Ready to Transmit', 'Completed'];

export function SessionList() {
  const [routingQueue, setRoutingQueue] = useState([
    { id: 'TR-001', item: 'Incoming document receiving and routing workflow', status: 'In Routing' },
    { id: 'TR-002', item: 'Committee referrals and report issuance', status: 'For Committee' },
    { id: 'TR-003', item: 'Automated agenda preparation with E-Session support', status: 'For Agenda Build' },
    { id: 'TR-004', item: 'Transmittal letter generation and monitoring', status: 'Ready to Transmit' },
  ]);
  const assessmentQueue = [
    { refNo: 'APP-2026-011', applicant: 'Barangay Cristo Rey', compliance: '8/10', evaluation: 'For Revision' },
    { refNo: 'APP-2026-014', applicant: 'MDRRMO Capas', compliance: '10/10', evaluation: 'Ready for Approval' },
    { refNo: 'APP-2026-016', applicant: 'Capas Tricycle Operators and Drivers Association', compliance: '6/10', evaluation: 'Incomplete Requirements' },
  ];
  const [approvalQueue, setApprovalQueue] = useState([
    { docNo: 'Mun. Ord. No. 2026-007', title: 'Supplemental Appropriation for Barangay Disaster Preparedness Equipment', stage: 'For Mayor Review' },
    { docNo: 'SB Res. No. 2026-041', title: 'Resolution Endorsing the Sta. Lucia–New Clark City Access Road', stage: 'For Issuance' },
  ]);
  const notificationMatrix = [
    { event: 'Approval', channel: 'System + Email', recipients: 'Author, Secretariat, Concerned Office' },
    { event: 'Disapproval', channel: 'System + Email', recipients: 'Author, Committee Chair' },
    { event: 'Returned/Incomplete', channel: 'System', recipients: 'Originating Office' },
    { event: 'Publication/Posting', channel: 'System + Email', recipients: 'Public Subscribers, PIO' },
  ];

  const [createOpen, setCreateOpen] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newStatus, setNewStatus] = useState(STATUS_FLOW[0]);
  const [createError, setCreateError] = useState('');
  const [agendaSession, setAgendaSession] = useState<Session | null>(null);

  const advanceQueue = async (id: string) => {
    const target = routingQueue.find((entry) => entry.id === id);
    const targetIdx = target ? STATUS_FLOW.indexOf(target.status) : -1;
    if (!target || targetIdx < 0 || targetIdx === STATUS_FLOW.length - 1) {
      toast('Status not updated', target ? `${target.id} is already ${target.status}.` : 'This transaction could not be found.', 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Advance this transaction?',
      description: `${target.id} will move from ${target.status} to ${STATUS_FLOW[targetIdx + 1]}.`,
      confirmLabel: 'Advance',
    });
    if (!confirmed) return;
    toast('Status updated', `${target.id} moved to ${STATUS_FLOW[targetIdx + 1]}.`);
    setRoutingQueue((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) return entry;
        const idx = STATUS_FLOW.indexOf(entry.status);
        if (idx < 0 || idx === STATUS_FLOW.length - 1) return entry;
        return { ...entry, status: STATUS_FLOW[idx + 1] };
      })
    );
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newItem.trim()) {
      setCreateError('Please describe the transaction.');
      toast('Transaction not created', 'Please describe the transaction.', 'error');
      return;
    }
    if (routingQueue.some((entry) => entry.item.toLowerCase() === newItem.trim().toLowerCase() && entry.status !== 'Completed')) {
      setCreateError('This transaction is already in the routing queue.');
      toast('Transaction not created', 'This transaction is already in the routing queue.', 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Create this transaction?',
      description: `"${newItem.trim()}" will be added to the routing queue as ${newStatus}.`,
      confirmLabel: 'Create transaction',
    });
    if (!confirmed) return;
    const id = `TR-${String(Math.max(0, ...routingQueue.map((entry) => Number(entry.id.replace(/\D/g, '')) || 0)) + 1).padStart(3, '0')}`;
    setRoutingQueue((prev) => [...prev, { id, item: newItem.trim(), status: newStatus }]);
    setCreateOpen(false);
    setNewItem('');
    setNewStatus(STATUS_FLOW[0]);
    setCreateError('');
    toast('Transaction created', `${id} was added to the routing queue.`);
  };

  const deleteTransaction = async (id: string) => {
    const target = routingQueue.find((entry) => entry.id === id);
    if (!target) {
      toast('Transaction not deleted', 'This transaction could not be found.', 'error');
      return;
    }
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
  };

  const decide = async (docNo: string, decision: 'approve' | 'return') => {
    const target = approvalQueue.find((item) => item.docNo === docNo);
    if (!target || target.stage.startsWith('Approved') || target.stage.startsWith('Returned')) {
      toast(decision === 'approve' ? 'Document not approved' : 'Document not returned', target ? `${docNo} already has a decision.` : `${docNo} could not be found.`, 'error');
      return;
    }
    const confirmed = await confirmAction(
      decision === 'approve'
        ? {
            title: 'Approve this document?',
            description: `${docNo} will be marked as approved and issued. This decision cannot be changed here.`,
            confirmLabel: 'Approve',
          }
        : {
            title: 'Return this document?',
            description: `${docNo} will be sent back to the originating office. This decision cannot be changed here.`,
            confirmLabel: 'Return document',
            tone: 'destructive',
          }
    );
    if (!confirmed) return;
    setApprovalQueue((prev) =>
      prev.map((item) =>
        item.docNo === docNo ? { ...item, stage: decision === 'approve' ? 'Approved – Issued' : 'Returned to Originating Office' } : item
      )
    );
    toast(
      decision === 'approve' ? 'Document approved' : 'Document returned',
      decision === 'approve' ? `${docNo} was approved and issued.` : `${docNo} was returned to the originating office.`
    );
  };

  const panelClass = 'flex flex-col rounded-lg border border-border bg-white shadow-sm';
  const panelHeaderClass = 'flex items-center justify-between gap-2 border-b border-border px-4 py-2.5';
  const panelTitleClass = 'text-sm font-bold text-primary';
  const countClass = 'text-xs font-normal text-text-muted';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Transaction Operations</h1>
          <p className="text-sm text-text-muted">Processing queue for routing, agenda preparation, committee action, and transmittals.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          Create Transaction
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={panelClass}>
          <div className={panelHeaderClass}>
            <h3 className={panelTitleClass}>
              Routing Queue <span className={countClass}>({routingQueue.length})</span>
            </h3>
          </div>
          <div className="max-h-64 divide-y divide-border overflow-y-auto">
            {routingQueue.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-2">
                <span className="w-14 shrink-0 font-mono text-[11px] text-text-muted">{entry.id}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium" title={entry.item}>{entry.item}</span>
                <Badge variant="outline" className="shrink-0 whitespace-nowrap text-[10px] uppercase">{entry.status}</Badge>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => advanceQueue(entry.id)} disabled={entry.status === 'Completed'}>
                    Advance
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-[#c62828] hover:bg-[#ffebee]"
                    onClick={() => deleteTransaction(entry.id)}
                    aria-label={`Delete ${entry.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {routingQueue.length === 0 && <p className="px-4 py-6 text-center text-sm text-text-muted">No transactions in the queue.</p>}
          </div>
        </div>

        <div className={panelClass}>
          <div className={panelHeaderClass}>
            <h3 className={panelTitleClass}>
              Approval and Issuance Queue <span className={countClass}>({approvalQueue.length})</span>
            </h3>
          </div>
          <div className="max-h-64 divide-y divide-border overflow-y-auto">
            {approvalQueue.map((item) => {
              const decided = item.stage.startsWith('Approved') || item.stage.startsWith('Returned');
              return (
                <div key={item.docNo} className="flex items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium" title={`${item.docNo} - ${item.title}`}>
                      <span className="font-mono text-[11px] text-text-muted">{item.docNo}</span> · {item.title}
                    </div>
                    <div className="text-[11px] text-text-muted">Stage: {item.stage}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" className="h-7 px-2 text-[10px]" disabled={decided} onClick={() => decide(item.docNo, 'approve')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" disabled={decided} onClick={() => decide(item.docNo, 'return')}>
                      Return
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={panelClass}>
          <div className={panelHeaderClass}>
            <h3 className={panelTitleClass}>
              Assessment and Evaluation Queue <span className={countClass}>({assessmentQueue.length})</span>
            </h3>
          </div>
          <div className="divide-y divide-border">
            {assessmentQueue.map((item) => (
              <div key={item.refNo} className="flex items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium" title={`${item.refNo} - ${item.applicant}`}>
                    <span className="font-mono text-[11px] text-text-muted">{item.refNo}</span> · {item.applicant}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    Compliance {item.compliance} · {item.evaluation}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 px-2 text-[10px]"
                  onClick={() => toast('Evaluation notice sent', `${item.applicant} was notified: ${item.evaluation}.`, 'info')}
                >
                  Notify
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className={panelClass}>
          <div className={panelHeaderClass}>
            <h3 className={panelTitleClass}>Notifications and Alerts Matrix</h3>
          </div>
          <div className="grid grid-cols-12 gap-2 bg-[#fafafa] px-4 py-1.5 text-[11px] font-semibold uppercase text-text-muted">
            <div className="col-span-3">Event</div>
            <div className="col-span-3">Channel</div>
            <div className="col-span-6">Recipients</div>
          </div>
          <div className="divide-y divide-border">
            {notificationMatrix.map((item) => (
              <div key={item.event} className="grid grid-cols-12 gap-2 px-4 py-2 text-[12px]">
                <div className="col-span-3 font-medium">{item.event}</div>
                <div className="col-span-3 text-text-muted">{item.channel}</div>
                <div className="col-span-6 text-text-muted">{item.recipients}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={panelClass}>
        <div className={panelHeaderClass}>
          <h3 className={panelTitleClass}>
            Session Schedule <span className={countClass}>({mockSessions.length})</span>
          </h3>
        </div>
        <div className="divide-y divide-border">
          {mockSessions.map((session) => {
            const date = new Date(`${session.date}T00:00:00`);
            return (
              <div key={session.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-md bg-primary/5 py-1 text-primary">
                    <span className="text-[10px] font-bold uppercase">{date.toLocaleDateString('en-PH', { month: 'short' })}</span>
                    <span className="text-lg font-black leading-none">{date.getDate()}</span>
                    <span className="text-[9px] text-text-muted">{date.getFullYear()}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-none text-[10px] font-bold uppercase',
                          session.type === 'Regular' ? 'bg-success/10 text-success' : session.type === 'Special' ? 'bg-red-50 text-red-700' : 'bg-primary/10 text-primary'
                        )}
                      >
                        {session.type}
                      </Badge>
                      <span className="font-mono text-[10px] text-text-muted">REF: {session.id.toUpperCase()}</span>
                    </div>
                    <CardTitle className="mt-0.5 truncate text-sm font-bold text-primary" title={session.title}>
                      {session.title}
                    </CardTitle>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {session.time}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {session.location}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users2 className="h-3 w-3" />
                        Open to Public
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setAgendaSession(session)}>
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Agenda
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => addSessionToCalendar(session)}>
                    <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                    Calendar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    onClick={() =>
                      toast('Stream not live yet', `The live stream opens on ${formatLongDate(session.date)} at ${session.time}.`, 'info')
                    }
                  >
                    <Video className="mr-1.5 h-3.5 w-3.5" />
                    Stream
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">Create Transaction</DialogTitle>
            <DialogDescription>Add a document or task to the routing queue.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="mt-5 space-y-3">
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="e.g. Transmittal of Mun. Ord. No. 2026-005 to the SP" aria-label="Transaction" />
            <label className="block text-xs font-semibold text-text-muted">
              Starting status
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-normal text-text-main"
              >
                {STATUS_FLOW.slice(0, -1).map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            {createError ? <p className="text-xs text-red-700">{createError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
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
