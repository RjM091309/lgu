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
import { type Bill, mockBills } from '@/lib/mock-data';
import { Search, Plus, FileDown, FileText, MoreHorizontal, Trash2 } from 'lucide-react';
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
}

/** Shared table badge shell: same height, padding, and pill shape so ROUTE/CATEGORY/STAGE align. */
const trackingTableBadgeBase =
  'h-6 min-h-6 inline-flex items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-0 text-[11px] font-medium leading-none';

function stageBadgeClassName(status: LifecycleStatus) {
  return cn(
    trackingTableBadgeBase,
    'uppercase tracking-wide',
    status === 'Enacted' || status === 'Passed'
      ? 'border-[#c8e6c9] bg-[#e8f5e9] text-[#2e7d32]'
      : status === 'Disapproved'
        ? 'border-[#ffcdd2] bg-[#ffebee] text-[#c62828]'
        : status === 'Committee'
          ? 'border-[#ffe0b2] bg-[#fff3e0] text-[#ef6c00]'
          : 'border-[#bbdefb] bg-[#e3f2fd] text-[#1565c0]'
  );
}

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
  const directionOptions: SelectOption[] = [
    { value: 'Incoming', label: 'Incoming' },
    { value: 'Outgoing', label: 'Outgoing' },
  ];
  const routeOptions: SelectOption[] = routeCycle.map((route) => ({ value: route, label: route }));

  const filteredRecords = useMemo(() => {
    return records.filter((bill) => {
      const matchesKeyword =
        keyword.trim().length === 0 ||
        bill.title.toLowerCase().includes(keyword.toLowerCase()) ||
        bill.number.toLowerCase().includes(keyword.toLowerCase()) ||
        bill.author.toLowerCase().includes(keyword.toLowerCase()) ||
        bill.route.toLowerCase().includes(keyword.toLowerCase());
      const matchesStatus = statusFilter === 'All' || bill.lifecycleStatus === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [records, keyword, statusFilter]);

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
    toast('Stage updated', `${target.number} moved to ${progressionFlow[targetIndex + 1]}.`);
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
        return { ...bill, status: nextStatus as Bill['status'], lifecycleStatus: nextStatus, history: [nextHistory, ...bill.history] };
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
  };

  const onKeywordChange = (value: string) => {
    setKeyword(value);
    setCurrentPage(1);
  };

  const onStatusFilterChange = (value: LifecycleStatus | 'All') => {
    setStatusFilter(value);
    setCurrentPage(1);
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
      toast('Nothing to export', 'No records match the current search and stage filter.', 'error');
      return;
    }

    const headers = ['Record No', 'Title', 'Direction', 'Route', 'Author', 'Category', 'Stage', 'Tracking Date'];
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = filteredRecords.map((bill) =>
      [
        bill.number,
        bill.title,
        bill.direction,
        bill.route,
        bill.author,
        bill.category,
        bill.lifecycleStatus,
        bill.trackingDate,
      ].map((cell) => escapeCsv(String(cell))).join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `legislative-tracking-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast('Tracking list exported', `${filteredRecords.length} record(s) saved as CSV.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Legislative Tracking System</h1>
          <p className="text-sm text-text-muted">
            Capture incoming/outgoing docs, route to workflow, manage lifecycle history, and link full text/committee reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        <div className="px-4 py-3 border-b border-border flex items-center gap-4 bg-[#fafafa]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Search by title, number, or author..."
              className="pl-9 bg-white border-border h-9 text-sm"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
            />
          </div>
          <div className="ml-auto w-[180px]">
            <Select
              options={[
                { value: 'All', label: 'All Stages' },
                ...stageOptions,
              ]}
              value={
                statusFilter === 'All'
                  ? { value: 'All', label: 'All Stages' }
                  : stageOptions.find((opt) => opt.value === statusFilter) ?? null
              }
              onChange={(option) => onStatusFilterChange((option?.value as Bill['status'] | 'All') ?? 'All')}
              placeholder="Filter stage"
            />
          </div>
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
          <Table className="table-fixed w-full">
            <TableHeader className="bg-[#fafafa]">
              <TableRow className="border-border">
                <TableHead className="w-[215px] px-4 text-[12px] font-semibold text-text-muted">RECORD NO.</TableHead>
                <TableHead className="px-4 text-[12px] font-semibold text-text-muted">TITLE</TableHead>
                <TableHead className="w-[110px] px-4 text-[12px] font-semibold text-text-muted">DIRECTION</TableHead>
                <TableHead className="w-[160px] px-4 text-[12px] font-semibold text-text-muted">ROUTE</TableHead>
                <TableHead className="w-[210px] px-4 text-[12px] font-semibold text-text-muted">AUTHOR</TableHead>
                <TableHead className="w-[140px] px-4 text-[12px] font-semibold text-text-muted">CATEGORY</TableHead>
                <TableHead className="w-[150px] px-4 text-[12px] font-semibold text-text-muted">STAGE</TableHead>
                <TableHead className="text-right px-4 text-[12px] font-semibold text-text-muted w-[72px]">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRecords.map((bill) => (
                <TableRow key={bill.id} className="hover:bg-muted/5 border-border transition-colors">
                  <TableCell className="px-4 py-2 font-mono text-[12px] text-text-muted whitespace-nowrap">{bill.number}</TableCell>
                  <TableCell className="px-4 py-2">
                    <div className="font-medium text-[13px] leading-snug line-clamp-2 whitespace-normal" title={bill.title}>{bill.title}</div>
                    <div className="text-[11px] text-text-muted">Tracked: {bill.trackingDate}</div>
                  </TableCell>
                  <TableCell className="px-4 py-2 text-[13px]">{bill.direction}</TableCell>
                  <TableCell className="px-4 py-2">
                    <Badge
                      variant="outline"
                      className={cn(trackingTableBadgeBase, 'border-border bg-white font-normal text-text-muted')}
                    >
                      {bill.route}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-2 text-[13px]">
                    <div className="line-clamp-2 whitespace-normal leading-snug" title={bill.author}>{bill.author}</div>
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <Badge
                      variant="outline"
                      className={cn(trackingTableBadgeBase, 'border-border bg-white font-normal text-text-muted')}
                    >
                      {bill.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <Badge variant="outline" className={stageBadgeClassName(bill.lifecycleStatus)}>
                      {bill.lifecycleStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-4 py-2">
                    <div className="flex justify-end">
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
                  <TableCell colSpan={8} className="text-center text-sm text-text-muted py-8">
                    No matching legislative records.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTable>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col rounded-lg border border-border bg-white shadow-sm">
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

        <div className="flex flex-col rounded-lg border border-border bg-white shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-base font-bold text-primary">Governance Monitoring</h3>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <div className="sticky top-0 grid grid-cols-12 gap-2 bg-[#fafafa] px-4 py-2 text-[11px] font-semibold uppercase text-text-muted">
              <div className="col-span-4">Measure</div>
              <div className="col-span-3">Duplicate Risk</div>
              <div className="col-span-3 text-right">Budget</div>
              <div className="col-span-2 text-right">Impl. Date</div>
            </div>
            {records.slice(0, 6).map((record, index) => (
              <div key={`gov-${record.id}`} className="grid grid-cols-12 items-center gap-2 border-t border-border px-4 py-2 text-[12px]">
                <div className="col-span-4 truncate font-mono text-text-muted" title={record.number}>{record.number}</div>
                <div className={cn('col-span-3', index === 0 ? 'font-medium text-[#ef6c00]' : 'text-text-muted')}>
                  {index === 0 ? 'Similar subject found' : 'None detected'}
                </div>
                <div className="col-span-3 text-right tabular-nums">PHP {((index + 1) * 350000).toLocaleString('en-PH')}</div>
                <div className="col-span-2 text-right tabular-nums">{record.trackingDate}</div>
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
            <Input
              value={newRecord.author}
              onChange={(e) => setNewRecord((prev) => ({ ...prev, author: e.target.value }))}
              placeholder="Author name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                moveToNextStage(actionMenu.bill.id);
                setActionMenu(null);
              }}
              disabled={
                actionMenu.bill.lifecycleStatus === 'Enacted' || actionMenu.bill.lifecycleStatus === 'Disapproved'
              }
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
              disabled={actionMenu.bill.lifecycleStatus === 'Disapproved'}
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
          </div>,
          document.body
        )}
    </div>
  );
}
