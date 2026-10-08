import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type Bill, mockBills, mockMembers, mockPublications } from '@/lib/mock-data';
import { Ban, BadgeCheck, Search, Plus, FileDown, FileText, ListChecks, MoreHorizontal, Printer, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DataTable } from '@/components/ui/DataTable';
import { Select, type SelectOption } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CalendarDatePicker } from '@/components/ui/CalendarDatePicker';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { gridTableCardsRef, gridTableClassName, gridTableHeaderClassName, gridTableRowClassName } from '@/components/ui/table';
import { LEGISLATIVE_STAGES, StageProgress, StatusBadge, stageProgress } from '@/components/ui/status-badge';
import { logActivity } from '@/lib/activity-log';
import { escapeHtml, openPrintWindow, saveCsv } from '@/lib/files';
import { todayInManila } from '@/lib/session-files';
import { EFFECTIVITY_DAYS, POSTING_DEADLINE_DAYS, PUBLICATION_TONE, addDays, publicationStatus, type PublicationStatus } from '@/lib/publication';

type LifecycleStatus = Bill['status'] | 'Disapproved';
type WorkflowRoute = 'Agenda' | 'Committee Referral' | 'Hearing' | 'Report Workflow';
type Direction = 'Incoming' | 'Outgoing';

interface StatusHistoryEntry {
  status: LifecycleStatus;
  date: string;
  note: string;
}

interface AttachmentRef {
  id: string;
  type: 'Full Text' | 'Committee Report';
  name: string;
}

interface TrackingRecord extends Bill {
  direction: Direction;
  trackingDate: string;
  route: WorkflowRoute;
  lifecycleStatus: LifecycleStatus;
  attachments: AttachmentRef[];
  history: StatusHistoryEntry[];
  /** Set when the record is moved to Enacted here; sample records take the date from their posting record. */
  enactedOn?: string;
}

/**
 * The list is split by where a measure stands: still moving through the Sanggunian, enacted (a permanent
 * record, followed through posting and effectivity), or stopped by a veto or disapproval.
 */
type TrackingTab = 'process' | 'enacted' | 'closed';
const CLOSED_STATUSES: LifecycleStatus[] = ['Vetoed', 'Disapproved'];
const tabOf = (status: LifecycleStatus): TrackingTab => (status === 'Enacted' ? 'enacted' : CLOSED_STATUSES.includes(status) ? 'closed' : 'process');

type Classification = NonNullable<Bill['classification']>;
const classificationOf = (bill: Bill): Classification => bill.classification ?? (/\bRes\b/i.test(bill.number) ? 'Resolution' : 'Ordinance');

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
interface EnactedDetails {
  type: Classification;
  enactedOn: string;
  /** Posting stage of an ordinance; null for resolutions and for ordinances without a posting record. */
  publication: PublicationStatus | null;
  note: string;
}

/** Shared table badge shell: same height, padding, and pill shape so ROUTE/CATEGORY/STAGE align. */
const trackingTableBadgeBase =
  'h-6 min-h-6 inline-flex items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-0 text-[11px] font-medium leading-none';

const defaultDate = new Date().toISOString().slice(0, 10);

export function LegislativeTrackingList() {
  const [records, setRecords] = useState<TrackingRecord[]>(
    mockBills.map((bill, index) => ({
      ...bill,
      direction: index % 2 === 0 ? 'Incoming' : 'Outgoing',
      trackingDate: bill.dateFiled,
      route: ['Agenda', 'Committee Referral', 'Hearing', 'Report Workflow'][index % 4] as WorkflowRoute,
      lifecycleStatus: bill.status,
      attachments: [
        {
          id: `${bill.id}-full`,
          type: 'Full Text',
          name: `${bill.number}-full-text.pdf`,
        },
        {
          id: `${bill.id}-committee`,
          type: 'Committee Report',
          name: `${bill.number}-committee-report.pdf`,
        },
      ],
      history: [
        {
          status: bill.status,
          date: bill.dateFiled,
          note: `Recorded at ${bill.status} stage`,
        },
      ],
    }))
  );
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<LifecycleStatus | 'All'>('All');
  const [tab, setTab] = useState<TrackingTab>('process');
  const [typeFilter, setTypeFilter] = useState<Classification | 'All'>('All');
  const [repositoryKeyword, setRepositoryKeyword] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionMenu, setActionMenu] = useState<{
    bill: TrackingRecord;
    top: number;
    left: number;
  } | null>(null);
  const [newRecord, setNewRecord] = useState({
    number: '',
    title: '',
    author: '',
    category: 'General',
    status: 'Draft' as Bill['status'],
    direction: 'Incoming' as Direction,
    route: 'Agenda' as WorkflowRoute,
    trackingDate: defaultDate,
    fullTextRef: '',
    committeeReportRef: '',
  });
  const [createWarning, setCreateWarning] = useState('');
  const pageSize = 10;

  const stageFlow: LifecycleStatus[] = [
    'Draft',
    'First Reading',
    'Committee',
    'Second Reading',
    'Third Reading',
    'Passed',
    'Enacted',
    'Disapproved',
  ];
  const progressionFlow: LifecycleStatus[] = [
    'Draft',
    'First Reading',
    'Committee',
    'Second Reading',
    'Third Reading',
    'Passed',
    'Enacted',
  ];
  const routeCycle: WorkflowRoute[] = ['Agenda', 'Committee Referral', 'Hearing', 'Report Workflow'];

  const stageOptions: SelectOption[] = progressionFlow.map((stage) => ({
    value: stage,
    label: stage,
  }));
  // The stage filter only applies to measures still in process.
  const processStageOptions = stageOptions.filter((option) => tabOf(option.value as LifecycleStatus) === 'process');
  const typeOptions: SelectOption[] = [
    { value: 'All', label: 'All Types' },
    { value: 'Ordinance', label: 'Ordinances' },
    { value: 'Resolution', label: 'Resolutions' },
  ];
  // Authors are SB members, listed by position.
  const authorOptions: SelectOption[] = mockMembers.map((member) => ({ value: member.name, label: `${member.name} · ${member.role}` }));
  const directionOptions: SelectOption[] = [
    { value: 'Incoming', label: 'Incoming' },
    { value: 'Outgoing', label: 'Outgoing' },
  ];
  const routeOptions: SelectOption[] = routeCycle.map((route) => ({ value: route, label: route }));

  // The search applies to every tab, so each tab's count shows where the matches are.
  const keywordMatches = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return records.filter(
      (bill) =>
        q.length === 0 ||
        bill.title.toLowerCase().includes(q) ||
        bill.number.toLowerCase().includes(q) ||
        bill.author.toLowerCase().includes(q) ||
        (bill.coAuthor ?? '').toLowerCase().includes(q) ||
        (bill.committee ?? '').toLowerCase().includes(q) ||
        bill.route.toLowerCase().includes(q)
    );
  }, [records, keyword]);

  const tabCounts: Record<TrackingTab, number> = {
    process: keywordMatches.filter((bill) => tabOf(bill.lifecycleStatus) === 'process').length,
    enacted: keywordMatches.filter((bill) => tabOf(bill.lifecycleStatus) === 'enacted').length,
    closed: keywordMatches.filter((bill) => tabOf(bill.lifecycleStatus) === 'closed').length,
  };

  const filteredRecords = useMemo(
    () =>
      keywordMatches.filter(
        (bill) =>
          tabOf(bill.lifecycleStatus) === tab &&
          (tab !== 'process' || statusFilter === 'All' || bill.lifecycleStatus === statusFilter) &&
          (tab !== 'enacted' || typeFilter === 'All' || classificationOf(bill) === typeFilter)
      ),
    [keywordMatches, tab, statusFilter, typeFilter]
  );

  const today = todayInManila();
  const enactedDetails = (bill: TrackingRecord): EnactedDetails => {
    const type = classificationOf(bill);
    // A measure enacted here starts its own posting clock; sample records use their posting record.
    const posting = bill.enactedOn ? undefined : mockPublications.find((entry) => entry.number === bill.number);
    const enactedOn = bill.enactedOn ?? posting?.approvedOn ?? bill.history.find((entry) => entry.status === 'Enacted')?.date ?? bill.dateFiled;
    // Resolutions take effect on approval; only ordinances are posted.
    if (type === 'Resolution') return { type, enactedOn, publication: null, note: 'Effective upon approval' };
    const record = posting ?? (bill.enactedOn ? { approvedOn: bill.enactedOn, postedOn: null } : null);
    if (!record) return { type, enactedOn, publication: null, note: 'No posting record' };
    const publication = publicationStatus(record, today);
    const deadline = addDays(record.approvedOn, POSTING_DEADLINE_DAYS);
    const note = record.postedOn
      ? `Posted ${shortDate(record.postedOn)} · effective ${shortDate(addDays(record.postedOn, EFFECTIVITY_DAYS))}`
      : publication === 'Posting overdue'
        ? `Overdue since ${shortDate(deadline)}`
        : `Post by ${shortDate(deadline)}`;
    return { type, enactedOn, publication, note };
  };

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage]);

  const selectedRecord = records.find((item) => item.id === selectedRecordId) ?? null;

  useEffect(() => {
    if (!actionMenu) return;

    const close = () => setActionMenu(null);

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-legislative-action-menu]') || target.closest('[data-legislative-action-trigger]')) {
        return;
      }
      close();
    };

    const handleScroll = () => close();

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [actionMenu]);

  const openActionMenuFromEvent = (bill: TrackingRecord, trigger: HTMLButtonElement) => {
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 212;
    let top = rect.bottom + 4;
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - 4);
    }
    let left = rect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    setActionMenu((prev) =>
      prev?.bill.id === bill.id ? null : { bill, top, left }
    );
  };

  const moveToNextStage = async (id: string) => {
    const target = records.find((bill) => bill.id === id);
    const targetIndex = target ? progressionFlow.indexOf(target.lifecycleStatus) : -1;
    if (!target || targetIndex < 0 || targetIndex === progressionFlow.length - 1) {
      toast('Stage not updated', target ? `${target.number} is already ${target.lifecycleStatus}.` : 'This record could not be found.', 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Move to the next stage?',
      description: `${target.number} will move from ${target.lifecycleStatus} to ${progressionFlow[targetIndex + 1]}. This is added to its status history.`,
      confirmLabel: 'Move stage',
    });
    if (!confirmed) return;
    const becomesEnacted = progressionFlow[targetIndex + 1] === 'Enacted';
    toast(
      becomesEnacted ? 'Measure enacted' : 'Stage updated',
      becomesEnacted
        ? `${target.number} is now enacted and has moved to the Enacted tab for posting.`
        : `${target.number} moved to ${progressionFlow[targetIndex + 1]}.`
    );
    logActivity({ module: 'Legislative Tracking', action: 'Updated', summary: `Moved ${target.number} to ${progressionFlow[targetIndex + 1]}`, detail: target.title });
    setRecords((prev) =>
      prev.map((bill) => {
        if (bill.id !== id) return bill;
        const currentIndex = progressionFlow.indexOf(bill.lifecycleStatus);
        if (currentIndex < 0 || currentIndex === progressionFlow.length - 1) return bill;
        const nextStatus = progressionFlow[currentIndex + 1];
        const nextHistory: StatusHistoryEntry = {
          status: nextStatus,
          date: defaultDate,
          note: `Stage advanced from ${bill.lifecycleStatus} to ${nextStatus}`,
        };
        return {
          ...bill,
          status: nextStatus as Bill['status'],
          lifecycleStatus: nextStatus,
          history: [nextHistory, ...bill.history],
          ...(nextStatus === 'Enacted' ? { enactedOn: defaultDate } : {}),
        };
      })
    );
  };

  const markDisapproved = async (id: string) => {
    const target = records.find((bill) => bill.id === id);
    if (!target || target.lifecycleStatus === 'Disapproved') {
      toast('Record not updated', target ? `${target.number} is already disapproved.` : 'This record could not be found.', 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Disapprove this record?',
      description: `${target.number} will be marked as disapproved and can no longer move to the next stage.`,
      confirmLabel: 'Disapprove',
      tone: 'destructive',
    });
    if (!confirmed) return;
    toast('Record disapproved', `${target.number} was marked as disapproved.`);
    logActivity({ module: 'Legislative Tracking', action: 'Returned', summary: `Marked ${target.number} as disapproved`, detail: target.title });
    setRecords((prev) =>
      prev.map((bill) => {
        if (bill.id !== id) return bill;
        const nextHistory: StatusHistoryEntry = {
          status: 'Disapproved',
          date: defaultDate,
          note: 'Marked as disapproved by committee/council action.',
        };
        return { ...bill, lifecycleStatus: 'Disapproved', history: [nextHistory, ...bill.history] };
      })
    );
  };

  const cycleRoute = async (id: string) => {
    const target = records.find((bill) => bill.id === id);
    if (!target) {
      toast('Route not updated', 'This record could not be found.', 'error');
      return;
    }
    const nextRoute = routeCycle[(routeCycle.indexOf(target.route) + 1) % routeCycle.length];
    const confirmed = await confirmAction({
      title: 'Route this record?',
      description: `${target.number} will be routed from ${target.route} to ${nextRoute}.`,
      confirmLabel: 'Route record',
    });
    if (!confirmed) return;
    toast('Record routed', `${target.number} routed to ${nextRoute}.`);
    logActivity({ module: 'Legislative Tracking', action: 'Routed', summary: `Routed ${target.number} to ${nextRoute}`, detail: target.title });
    setRecords((prev) =>
      prev.map((bill) => {
        if (bill.id !== id) return bill;
        const currentIndex = routeCycle.indexOf(bill.route);
        const nextRoute = routeCycle[(currentIndex + 1) % routeCycle.length];
        const nextHistory: StatusHistoryEntry = {
          status: bill.lifecycleStatus,
          date: defaultDate,
          note: `Routed to ${nextRoute}`,
        };
        return { ...bill, route: nextRoute, history: [nextHistory, ...bill.history] };
      })
    );
  };

  const deleteRecord = async (id: string) => {
    const target = records.find((bill) => bill.id === id);
    if (!target) {
      toast('Record not deleted', 'This record could not be found.', 'error');
      return;
    }
    if (target.lifecycleStatus === 'Enacted') {
      toast('Record not deleted', `${target.number} is already enacted. Enacted measures are permanent records and cannot be deleted.`, 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Delete this legislative record?',
      description: `${target.number} — "${target.title}" and its status history will be removed from the tracking list. This cannot be undone.`,
      confirmLabel: 'Delete record',
      tone: 'destructive',
    });
    if (!confirmed) return;
    const remaining = records.filter((bill) => bill.id !== id);
    setRecords(remaining);
    setCurrentPage((page) => Math.min(page, Math.max(1, Math.ceil((filteredRecords.length - 1) / pageSize))));
    if (selectedRecordId === id) setSelectedRecordId(null);
    toast('Record deleted', `${target.number} was removed from the tracking list.`);
    logActivity({ module: 'Legislative Tracking', action: 'Deleted', summary: `Deleted ${target.number}`, detail: target.title });
  };

  const createRecord = async () => {
    const missing = [
      !newRecord.number.trim() && 'Record No.',
      !newRecord.title.trim() && 'Title',
      !newRecord.author.trim() && 'Author',
    ].filter(Boolean);
    if (missing.length > 0) {
      const message = `Please fill in ${missing.join(', ')}.`;
      setCreateWarning(message);
      toast('Record not saved', message, 'error');
      return;
    }
    const duplicate = records.find(
      (record) =>
        record.number.trim().toLowerCase() === newRecord.number.trim().toLowerCase() ||
        record.title.trim().toLowerCase() === newRecord.title.trim().toLowerCase()
    );
    if (duplicate) {
      setCreateWarning(`Possible duplicate with ${duplicate.number}: "${duplicate.title}"`);
      toast('Record not saved', `It looks like a duplicate of ${duplicate.number}.`, 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Save this legislative record?',
      description: `${newRecord.number.trim()} — "${newRecord.title.trim()}" will be added to the tracking list as ${newRecord.status}.`,
      confirmLabel: 'Save record',
    });
    if (!confirmed) return;
    const newId = `${Math.max(0, ...records.map((record) => Number(record.id) || 0)) + 1}`;
    const attachments: AttachmentRef[] = [];
    if (newRecord.fullTextRef.trim()) {
      attachments.push({
        id: `${newId}-full`,
        type: 'Full Text',
        name: newRecord.fullTextRef.trim(),
      });
    }
    if (newRecord.committeeReportRef.trim()) {
      attachments.push({
        id: `${newId}-committee`,
        type: 'Committee Report',
        name: newRecord.committeeReportRef.trim(),
      });
    }
    setRecords((prev) => [
      {
        id: newId,
        number: newRecord.number.trim(),
        title: newRecord.title.trim(),
        author: newRecord.author.trim(),
        category: newRecord.category,
        status: newRecord.status,
        dateFiled: newRecord.trackingDate,
        description: 'Legislative record created from the new record form.',
        direction: newRecord.direction,
        trackingDate: newRecord.trackingDate,
        route: newRecord.route,
        lifecycleStatus: newRecord.status,
        attachments,
        history: [
          {
            status: newRecord.status,
            date: newRecord.trackingDate,
            note: `${newRecord.direction} document captured and routed to ${newRecord.route}`,
          },
        ],
      },
      ...prev,
    ]);
    setNewRecord({
      number: '',
      title: '',
      author: '',
      category: 'General',
      status: 'Draft',
      direction: 'Incoming',
      route: 'Agenda',
      trackingDate: defaultDate,
      fullTextRef: '',
      committeeReportRef: '',
    });
    setIsCreateOpen(false);
    setCreateWarning('');
    setCurrentPage(1);
    toast('Record saved', `${newRecord.number.trim()} was added to the tracking list.`);
    logActivity({ module: 'Legislative Tracking', action: 'Created', summary: `Saved ${newRecord.number.trim()}`, detail: newRecord.title.trim() });
  };

  const onKeywordChange = (value: string) => {
    setKeyword(value);
    setCurrentPage(1);
  };

  const onStatusFilterChange = (value: LifecycleStatus | 'All') => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const changeTab = (next: TrackingTab) => {
    setTab(next);
    setStatusFilter('All');
    setTypeFilter('All');
    setCurrentPage(1);
  };

  const printEnactedRecord = (bill: TrackingRecord) => {
    const details = enactedDetails(bill);
    const history = bill.history
      .map((entry) => `<tr><td>${escapeHtml(entry.date)}</td><td>${escapeHtml(entry.status)}</td><td>${escapeHtml(entry.note)}</td></tr>`)
      .join('');
    const ok = openPrintWindow(
      `${bill.number} - Enacted`,
      `<div class="card">
         <div class="title">${escapeHtml(bill.number)}</div>
         <div class="rows">
           <div><b>Title</b>: ${escapeHtml(bill.title)}</div>
           <div><b>Type</b>: ${details.type}</div>
           <div><b>Author</b>: ${escapeHtml(bill.author)}${bill.coAuthor ? ` · Co-author: ${escapeHtml(bill.coAuthor)}` : ''}</div>
           ${bill.committee ? `<div><b>Committee</b>: ${escapeHtml(bill.committee)}</div>` : ''}
           <div><b>Enacted</b>: ${longDate(details.enactedOn)}</div>
           <div><b>Publication</b>: ${details.publication ?? '—'} (${escapeHtml(details.note)})</div>
         </div>
         <table><thead><tr><th>Date</th><th>Stage</th><th>Note</th></tr></thead><tbody>${history}</tbody></table>
       </div>`
    );
    if (!ok) toast('Record not opened', 'Your browser blocked the print window. Allow pop-ups for this site and try again.', 'error');
    else logActivity({ module: 'Legislative Tracking', action: 'Exported', summary: `Printed the record of ${bill.number}`, detail: bill.title });
  };

  const repositoryEntries = useMemo(() => {
    const q = repositoryKeyword.trim().toLowerCase();
    return records
      .flatMap((record) =>
        record.attachments.map((attachment) => ({
          recordNo: record.number,
          title: record.title,
          route: record.route,
          ...attachment,
        }))
      )
      .filter(
        (entry) =>
          !q ||
          entry.name.toLowerCase().includes(q) ||
          entry.title.toLowerCase().includes(q) ||
          entry.recordNo.toLowerCase().includes(q) ||
          entry.type.toLowerCase().includes(q)
      );
  }, [records, repositoryKeyword]);

  const exportTrackingList = () => {
    if (filteredRecords.length === 0) {
      toast('Nothing to export', 'No records match the current tab, search, and filter.', 'error');
      return;
    }

    const enacted = tab === 'enacted';
    const headers = enacted
      ? ['Record No', 'Title', 'Type', 'Author', 'Category', 'Enacted', 'Publication', 'Publication Note']
      : ['Record No', 'Title', 'Direction', 'Route', 'Author', 'Category', 'Stage', 'Progress', 'Tracking Date'];
    const rows = filteredRecords.map((bill) => {
      if (enacted) {
        const details = enactedDetails(bill);
        return [bill.number, bill.title, details.type, bill.author, bill.category, details.enactedOn, details.publication ?? '', details.note];
      }
      return [
        bill.number,
        bill.title,
        bill.direction,
        bill.route,
        bill.author,
        bill.category,
        bill.lifecycleStatus,
        (() => {
          const step = LEGISLATIVE_STAGES.findIndex((stage) => stage.status === bill.lifecycleStatus);
          return step < 0 ? '' : `${stageProgress(step)}%`;
        })(),
        bill.trackingDate,
      ];
    });

    const fileTag = { process: 'in-process', enacted: 'enacted', closed: 'vetoed-disapproved' }[tab];
    if (!saveCsv(`legislative-${fileTag}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)) {
      toast('Export failed', 'The browser blocked the download. Please try again.', 'error');
      return;
    }
    toast('Tracking list exported', `${filteredRecords.length} record(s) saved as CSV.`);
    logActivity({ module: 'Legislative Tracking', action: 'Exported', summary: 'Exported the tracking list', detail: `${filteredRecords.length} record(s) saved as CSV.` });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Legislative Tracking System</h1>
          <p className="text-sm text-text-muted">
            Capture incoming/outgoing docs, route to workflow, manage lifecycle history, and link full text/committee reports.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            size="sm"
            className="border-border text-text-muted"
            onClick={exportTrackingList}
            disabled={filteredRecords.length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export Tracking List
          </Button>
          <Button size="sm" className="bg-primary hover:bg-primary-light" onClick={() => { setCreateWarning(''); setIsCreateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            New Legislative Record
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="flex gap-1 overflow-x-auto border-b border-border px-2" role="tablist" aria-label="Legislative records by status">
          {(
            [
              { id: 'process', label: 'In Process', icon: ListChecks },
              { id: 'enacted', label: 'Enacted', icon: BadgeCheck },
              { id: 'closed', label: 'Vetoed / Disapproved', icon: Ban },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => changeTab(item.id)}
              className={cn(
                '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors sm:px-4',
                tab === item.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
              <span className={cn('rounded-full px-1.5 py-px text-[10px] tabular-nums', tab === item.id ? 'bg-primary text-white' : 'bg-muted text-text-muted')}>
                {tabCounts[item.id]}
              </span>
            </button>
          ))}
        </div>
        <div className="px-4 py-3 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 bg-[#fafafa]">
          <div className="relative w-full sm:flex-1 sm:max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Search by title, number, or author..."
              className="pl-9 bg-white border-border h-9 text-sm"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
            />
          </div>
          {tab === 'process' ? (
            <div className="w-full sm:ml-auto sm:w-[180px]">
              <Select
                options={[{ value: 'All', label: 'All Stages' }, ...processStageOptions]}
                value={statusFilter === 'All' ? { value: 'All', label: 'All Stages' } : processStageOptions.find((opt) => opt.value === statusFilter) ?? null}
                onChange={(option) => onStatusFilterChange((option?.value as Bill['status'] | 'All') ?? 'All')}
                placeholder="Filter stage"
              />
            </div>
          ) : tab === 'enacted' ? (
            <div className="w-full sm:ml-auto sm:w-[180px]">
              <Select
                options={typeOptions}
                value={typeOptions.find((opt) => opt.value === typeFilter) ?? typeOptions[0]}
                onChange={(option) => {
                  setTypeFilter((option?.value as Classification | 'All') ?? 'All');
                  setCurrentPage(1);
                }}
                placeholder="Filter type"
              />
            </div>
          ) : null}
        </div>
        
        <DataTable
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredRecords.length}
          currentCount={paginatedRecords.length}
          onPreviousPage={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          onNextPage={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
        >
          {tab === 'enacted' ? (
          <Table className="table-fixed w-full min-w-[1320px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[215px]">RECORD NO.</TableHead>
                <TableHead>TITLE</TableHead>
                <TableHead className="w-[120px]">TYPE</TableHead>
                <TableHead className="w-[240px]">AUTHOR</TableHead>
                <TableHead className="w-[140px]">CATEGORY</TableHead>
                <TableHead className="w-[130px]">ENACTED</TableHead>
                <TableHead className="w-[220px]">PUBLICATION</TableHead>
                <TableHead className="w-[72px]" data-action>ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRecords.map((bill) => {
                const details = enactedDetails(bill);
                return (
                  <TableRow key={bill.id}>
                    <TableCell className="whitespace-nowrap">{bill.number}</TableCell>
                    <TableCell>
                      <div className="font-medium text-[13px] leading-snug line-clamp-2 whitespace-normal" title={bill.title}>{bill.title}</div>
                      <div className="text-[11px] text-text-muted">Filed: {bill.dateFiled}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          trackingTableBadgeBase,
                          details.type === 'Ordinance' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-violet-200 bg-violet-50 text-violet-800'
                        )}
                      >
                        {details.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="mx-auto flex max-w-[240px] items-center gap-2.5 text-left">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary" aria-hidden>
                          {mockMembers.find((member) => member.name === bill.author)?.abbr ?? bill.author.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 leading-snug">
                          <div className="font-medium text-text-main">{bill.author}</div>
                          {bill.committee ? (
                            <div className="truncate text-[11px] text-text-muted" title={bill.committee}>
                              {bill.committee.replace('Committee on ', 'Comm. on ')}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(trackingTableBadgeBase, 'border-border bg-white font-normal text-text-muted')}>
                        {bill.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{longDate(details.enactedOn)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-center gap-1">
                        <Badge
                          variant="outline"
                          className={cn(trackingTableBadgeBase, details.publication ? PUBLICATION_TONE[details.publication] : 'border-border bg-white font-normal text-text-muted')}
                        >
                          {details.publication ?? (details.type === 'Resolution' ? 'Not required' : 'Not tracked')}
                        </Badge>
                        <span className="text-[11px] text-text-muted">{details.note}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          data-legislative-action-trigger
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 border-0 text-text-muted hover:bg-muted hover:text-text-main"
                          onClick={(e) => openActionMenuFromEvent(bill, e.currentTarget)}
                          aria-label="Open actions menu"
                          aria-expanded={actionMenu?.bill.id === bill.id}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paginatedRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-text-muted py-8">
                    {keyword.trim() || typeFilter !== 'All' ? 'No enacted measures match the search.' : 'No enacted measures yet. A measure appears here once it moves past Passed.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          ) : (
          <Table className="table-fixed w-full min-w-[1440px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[215px]">RECORD NO.</TableHead>
                <TableHead>TITLE</TableHead>
                <TableHead className="w-[110px]">DIRECTION</TableHead>
                <TableHead className="w-[160px]">ROUTE</TableHead>
                <TableHead className="w-[240px]">AUTHOR</TableHead>
                <TableHead className="w-[140px]">CATEGORY</TableHead>
                <TableHead className="w-[140px]">STAGE</TableHead>
                <TableHead className="w-[130px]">PROGRESS</TableHead>
                <TableHead className="w-[72px]" data-action>ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRecords.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="whitespace-nowrap">{bill.number}</TableCell>
                  <TableCell>
                    <div className="font-medium text-[13px] leading-snug line-clamp-2 whitespace-normal" title={bill.title}>{bill.title}</div>
                    <div className="text-[11px] text-text-muted">Tracked: {bill.trackingDate}</div>
                  </TableCell>
                  <TableCell>{bill.direction}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(trackingTableBadgeBase, 'border-border bg-white font-normal text-text-muted')}
                    >
                      {bill.route}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="mx-auto flex max-w-[240px] items-center gap-2.5 text-left">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary" aria-hidden>
                        {mockMembers.find((member) => member.name === bill.author)?.abbr ?? bill.author.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 leading-snug">
                        <div className="font-medium text-text-main">{bill.author}</div>
                        {bill.coAuthor ? (
                          <div className="truncate text-[11px] text-text-muted" title={`Co-author: ${bill.coAuthor}`}>
                            Co-author: {mockMembers.find((member) => member.name === bill.coAuthor)?.abbr ?? bill.coAuthor}
                          </div>
                        ) : null}
                        {bill.committee ? (
                          <div className="truncate text-[11px] text-text-muted" title={bill.committee}>
                            {bill.committee.replace('Committee on ', 'Comm. on ')}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(trackingTableBadgeBase, 'border-border bg-white font-normal text-text-muted')}
                    >
                      {bill.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={bill.lifecycleStatus} showProgress={false} />
                  </TableCell>
                  <TableCell>
                    <StageProgress status={bill.lifecycleStatus} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        data-legislative-action-trigger
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 border-0 text-text-muted hover:bg-muted hover:text-text-main"
                        onClick={(e) => openActionMenuFromEvent(bill, e.currentTarget)}
                        aria-label="Open actions menu"
                        aria-expanded={actionMenu?.bill.id === bill.id}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-text-muted py-8">
                    {tab === 'closed' && !keyword.trim() ? 'No vetoed or disapproved measures.' : 'No matching legislative records.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </DataTable>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col rounded-lg border border-border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h3 className="text-base font-bold text-primary">Searchable Document Repository</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-text-muted" />
              <Input
                placeholder="Search full text / committee reports"
                aria-label="Search document repository"
                className="h-8 pl-8 text-sm"
                value={repositoryKeyword}
                onChange={(e) => setRepositoryKeyword(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-72 divide-y divide-border overflow-y-auto">
            {repositoryEntries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-2">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold" title={entry.name}>{entry.name}</div>
                  <div className="truncate text-[11px] text-text-muted" title={entry.title}>
                    {entry.recordNo} · {entry.route}
                  </div>
                </div>
                <Badge variant="outline" className={cn(trackingTableBadgeBase, 'border-border bg-white font-normal text-text-muted')}>
                  {entry.type}
                </Badge>
              </div>
            ))}
            {repositoryEntries.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-text-muted">No matching documents.</p>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-base font-bold text-primary">Governance Monitoring</h3>
          </div>
          <div ref={gridTableCardsRef} className="grid-table max-h-72 overflow-auto">
            <div className={cn('sticky top-0', gridTableHeaderClassName)}>
              <div className="col-span-4">Measure</div>
              <div className="col-span-3">Duplicate Risk</div>
              <div className="col-span-3">Budget</div>
              <div className="col-span-2">Impl. Date</div>
            </div>
            {records.slice(0, 6).map((record, index) => (
              <div key={`gov-${record.id}`} className={gridTableRowClassName}>
                <div className="col-span-4 truncate" title={record.number}>{record.number}</div>
                <div className={cn('col-span-3', index === 0 ? 'font-medium text-orange-700' : 'text-text-muted')}>
                  {index === 0 ? 'Similar subject found' : 'None detected'}
                </div>
                <div className="col-span-3 tabular-nums">PHP {((index + 1) * 350000).toLocaleString('en-PH')}</div>
                <div className="col-span-2 tabular-nums">{record.trackingDate}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog
        open={selectedRecordId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRecordId(null);
        }}
      >
        <DialogContent className="max-h-[85vh] flex flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <div className="border-b border-border px-6 py-5">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-primary">Traceable Status History</DialogTitle>
              {selectedRecord ? (
                <DialogDescription className="text-sm text-text-muted">
                  <span className="font-semibold text-text-main">{selectedRecord.number}</span>
                  {' — '}
                  {selectedRecord.title}
                </DialogDescription>
              ) : (
                <DialogDescription>Lifecycle history for the selected record.</DialogDescription>
              )}
            </DialogHeader>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {selectedRecord ? (
              <div className="space-y-2">
                {selectedRecord.history.map((entry, idx) => (
                  <div key={`${entry.status}-${idx}`} className="border border-border rounded-md p-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
                      <span className="font-semibold text-text-main">{entry.status}</span>
                      <span className="shrink-0">{entry.date}</span>
                    </div>
                    <p className="text-sm mt-1">{entry.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">This record could not be loaded.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border bg-[#fafafa] px-6 py-3">
            <Button variant="outline" size="sm" onClick={() => setSelectedRecordId(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          closeOnOverlayClick={false}
          className="flex flex-col gap-0 p-0 sm:max-w-2xl max-sm:overflow-y-auto sm:overflow-visible"
        >
          <div className="border-b border-border px-6 py-5">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-primary">New Legislative Record</DialogTitle>
              <DialogDescription>Capture a new incoming or outgoing legislative record.</DialogDescription>
            </DialogHeader>
          </div>
        <div className="space-y-4 px-6 py-5">
          {createWarning ? (
            <div className="rounded border border-[#ffe0b2] bg-[#fff3e0] px-3 py-2 text-xs text-[#8a4b08]">
              {createWarning}
            </div>
          ) : null}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-muted">Record No.</label>
            <Input
              value={newRecord.number}
              onChange={(e) => setNewRecord((prev) => ({ ...prev, number: e.target.value }))}
              placeholder="e.g. SB-118"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-muted">Title</label>
            <Input
              value={newRecord.title}
              onChange={(e) => setNewRecord((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Legislative title"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-muted">Author</label>
            <Select
              options={authorOptions}
              value={authorOptions.find((opt) => opt.value === newRecord.author) ?? null}
              onChange={(option) => setNewRecord((prev) => ({ ...prev, author: option?.value ?? '' }))}
              placeholder="Select the sponsoring SB member"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-muted">Direction</label>
              <Select
                options={directionOptions}
                value={directionOptions.find((opt) => opt.value === newRecord.direction) ?? null}
                onChange={(option) =>
                  setNewRecord((prev) => ({
                    ...prev,
                    direction: (option?.value ?? 'Incoming') as Direction,
                  }))
                }
                placeholder="Direction"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-muted">Category</label>
              <Input
                value={newRecord.category}
                onChange={(e) => setNewRecord((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="Category"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-muted">Tracking Date</label>
              <CalendarDatePicker
                value={newRecord.trackingDate}
                onChange={(date) => setNewRecord((prev) => ({ ...prev, trackingDate: date }))}
                placeholder="Select tracking date"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-muted">Workflow Route</label>
              <Select
                options={routeOptions}
                value={routeOptions.find((opt) => opt.value === newRecord.route) ?? null}
                onChange={(option) =>
                  setNewRecord((prev) => ({
                    ...prev,
                    route: (option?.value ?? 'Agenda') as WorkflowRoute,
                  }))
                }
                placeholder="Route"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-muted">Initial Stage</label>
              <Select
                options={stageOptions}
                value={stageOptions.find((opt) => opt.value === newRecord.status) ?? null}
                onChange={(option) =>
                  setNewRecord((prev) => ({
                    ...prev,
                    status: (option?.value ?? 'Draft') as Bill['status'],
                  }))
                }
                placeholder="Select stage"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-muted">Full Text Reference</label>
              <Input
                value={newRecord.fullTextRef}
                onChange={(e) => setNewRecord((prev) => ({ ...prev, fullTextRef: e.target.value }))}
                placeholder="e.g. SB-118-full-text.pdf"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-muted">Committee Report Reference</label>
            <Input
              value={newRecord.committeeReportRef}
              onChange={(e) => setNewRecord((prev) => ({ ...prev, committeeReportRef: e.target.value }))}
              placeholder="e.g. SB-118-committee-report.pdf"
            />
          </div>
        </div>
          <div className="flex justify-end gap-2 rounded-b-lg border-t border-border bg-[#fafafa] px-6 py-3">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createRecord}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {actionMenu &&
        createPortal(
          <div
            data-legislative-action-menu
            role="menu"
            className="fixed z-[300] w-44 rounded-lg bg-white py-1 shadow-lg"
            style={{ top: actionMenu.top, left: actionMenu.left }}
          >
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
              onClick={() => {
                setSelectedRecordId(actionMenu.bill.id);
                setActionMenu(null);
              }}
            >
              View Flow
            </button>
            {actionMenu.bill.lifecycleStatus === 'Enacted' ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center px-3 py-2 text-left text-xs hover:bg-muted"
                onClick={() => {
                  printEnactedRecord(actionMenu.bill);
                  setActionMenu(null);
                }}
              >
                <Printer className="mr-2 h-3.5 w-3.5" />
                Print record
              </button>
            ) : (
            <>
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                moveToNextStage(actionMenu.bill.id);
                setActionMenu(null);
              }}
              disabled={tabOf(actionMenu.bill.lifecycleStatus) === 'closed'}
            >
              Next Stage
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
              onClick={() => {
                cycleRoute(actionMenu.bill.id);
                setActionMenu(null);
              }}
            >
              Route
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-xs text-[#b91c1c] hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                markDisapproved(actionMenu.bill.id);
                setActionMenu(null);
              }}
              disabled={tabOf(actionMenu.bill.lifecycleStatus) === 'closed'}
            >
              Disapprove
            </button>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center px-3 py-2 text-left text-xs text-[#b91c1c] hover:bg-[#fef2f2]"
              onClick={() => {
                deleteRecord(actionMenu.bill.id);
                setActionMenu(null);
              }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </button>
            </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
