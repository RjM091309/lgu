import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Download,
  FilePlus2,
  FolderUp,
  LogIn,
  LogOut,
  Megaphone,
  PenLine,
  PencilLine,
  Route,
  Trash2,
  Undo2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { ACTIVITY_ACTIONS, ACTIVITY_MODULES, logActivity, useActivityLog, type ActivityAction } from '@/lib/activity-log';
import { saveCsv } from '@/lib/files';
import { todayInManila } from '@/lib/session-files';
import { cn } from '@/lib/utils';

const ACTION_STYLE: Record<ActivityAction, { icon: LucideIcon; tone: string }> = {
  Created: { icon: FilePlus2, tone: 'border-blue-200 bg-blue-50 text-blue-800' },
  Updated: { icon: PencilLine, tone: 'border-slate-200 bg-slate-50 text-slate-700' },
  Routed: { icon: Route, tone: 'border-indigo-200 bg-indigo-50 text-indigo-800' },
  Approved: { icon: CheckCircle2, tone: 'border-green-200 bg-green-50 text-green-800' },
  Returned: { icon: Undo2, tone: 'border-amber-200 bg-amber-50 text-amber-800' },
  Deleted: { icon: Trash2, tone: 'border-red-200 bg-red-50 text-red-800' },
  Signed: { icon: PenLine, tone: 'border-teal-200 bg-teal-50 text-teal-800' },
  Uploaded: { icon: FolderUp, tone: 'border-sky-200 bg-sky-50 text-sky-800' },
  Published: { icon: Megaphone, tone: 'border-violet-200 bg-violet-50 text-violet-800' },
  Exported: { icon: Download, tone: 'border-slate-200 bg-slate-50 text-slate-700' },
  'Signed in': { icon: LogIn, tone: 'border-slate-200 bg-white text-slate-700' },
  'Signed out': { icon: LogOut, tone: 'border-slate-200 bg-white text-slate-700' },
};

// Bold record numbers inside summaries so they scan quickly.
const RECORD_NO = /(APP-\d{4}-\d{3}|(?:Mun\. Ord\.|Prop\. Ord\.|SB Res\.) No\. [\dP-]+\d)/;
const highlightRecords = (text: string) =>
  text.split(RECORD_NO).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="font-semibold">
        {part}
      </span>
    ) : (
      part
    )
  );

const formatDate = (timestamp: string) =>
  new Date(`${timestamp.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

const formatTime = (timestamp: string) => {
  const [hour, minute] = timestamp.slice(11, 16).split(':').map(Number);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
};

const dayLabel = (timestamp: string, today: string) => {
  const days = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${timestamp.slice(0, 10)}T00:00:00`).getTime()) / 86_400_000);
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : null;
};

const allOption = (label: string): SelectOption => ({ value: 'All', label });

export function ActivityLog() {
  const entries = useActivityLog();
  const today = todayInManila();
  const [keyword, setKeyword] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const userOptions = useMemo(
    () => [allOption('All users'), ...Array.from(new Set(entries.map((entry) => entry.user))).sort().map((user) => ({ value: user, label: user }))],
    [entries]
  );
  const moduleOptions = [allOption('All modules'), ...ACTIVITY_MODULES.map((module) => ({ value: module, label: module }))];
  const actionOptions = [allOption('All actions'), ...ACTIVITY_ACTIONS.map((action) => ({ value: action, label: action }))];

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return entries.filter(
      (entry) =>
        (userFilter === 'All' || entry.user === userFilter) &&
        (moduleFilter === 'All' || entry.module === moduleFilter) &&
        (actionFilter === 'All' || entry.action === actionFilter) &&
        (query === '' || `${entry.summary} ${entry.detail ?? ''} ${entry.user} ${entry.module}`.toLowerCase().includes(query))
    );
  }, [entries, keyword, userFilter, moduleFilter, actionFilter]);

  // Back to the first page whenever the filters change the result set.
  useEffect(() => setCurrentPage(1), [keyword, userFilter, moduleFilter, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = keyword !== '' || userFilter !== 'All' || moduleFilter !== 'All' || actionFilter !== 'All';

  const summary = useMemo(() => {
    const moduleCounts = entries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.module] = (acc[entry.module] ?? 0) + 1;
      return acc;
    }, {});
    const topModule = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      today: entries.filter((entry) => entry.timestamp.startsWith(today)).length,
      total: entries.length,
      users: new Set(entries.map((entry) => entry.user)).size,
      topModule: topModule ? topModule[0] : '—',
    };
  }, [entries, today]);

  const clearFilters = () => {
    setKeyword('');
    setUserFilter('All');
    setModuleFilter('All');
    setActionFilter('All');
  };

  const exportLog = () => {
    if (filtered.length === 0) {
      toast('Nothing to export', 'No activity matches the current filters.', 'error');
      return;
    }
    const saved = saveCsv(
      'sb-capas-activity-log.csv',
      ['Date', 'Time', 'User', 'Module', 'Action', 'Summary', 'Details'],
      filtered.map((entry) => [formatDate(entry.timestamp), formatTime(entry.timestamp), entry.user, entry.module, entry.action, entry.summary, entry.detail ?? ''])
    );
    if (!saved) {
      toast('Export failed', 'The CSV file could not be created. Please try again.', 'error');
      return;
    }
    toast('Activity log exported', `${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'} saved as CSV.`);
    logActivity({ module: 'Administration', action: 'Exported', summary: 'Exported the activity log', detail: `${filtered.length} entries saved as CSV.` });
  };

  const tiles = [
    { label: 'Actions today', value: summary.today, icon: Activity },
    { label: 'Total recorded', value: summary.total, icon: PencilLine },
    { label: 'Active users', value: summary.users, icon: Users },
    { label: 'Most active module', value: summary.topModule, icon: Route },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Activity Log</h1>
          <p className="text-sm text-text-muted">Every action taken by users across the system, newest first.</p>
        </div>
        <Button variant="outline" onClick={exportLog}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <tile.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className={cn('truncate font-semibold leading-tight text-text-main', typeof tile.value === 'number' ? 'text-2xl' : 'text-base')}>{tile.value}</div>
              <div className="text-xs text-text-muted">{tile.label}</div>
            </div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="space-y-3 border-b border-border p-4 md:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input placeholder="Search activity, record no., user" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <Select options={userOptions} value={userOptions.find((option) => option.value === userFilter) ?? null} onChange={(option) => setUserFilter(option?.value ?? 'All')} />
            <Select options={moduleOptions} value={moduleOptions.find((option) => option.value === moduleFilter) ?? null} onChange={(option) => setModuleFilter(option?.value ?? 'All')} />
            <Select options={actionOptions} value={actionOptions.find((option) => option.value === actionFilter) ?? null} onChange={(option) => setActionFilter(option?.value ?? 'All')} />
          </div>
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>
              <span className="font-semibold text-text-main">{filtered.length}</span> of {entries.length} entries
            </span>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="font-semibold text-primary hover:underline">
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        <DataTable
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filtered.length}
          currentCount={paginated.length}
          onPreviousPage={() => setCurrentPage(Math.max(1, page - 1))}
          onNextPage={() => setCurrentPage(Math.min(totalPages, page + 1))}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date &amp; Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((entry) => {
                const style = ACTION_STYLE[entry.action];
                const relative = dayLabel(entry.timestamp, today);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-text-main">{relative ?? formatDate(entry.timestamp)}</div>
                      <div className="text-[11px] tabular-nums text-text-muted">{formatTime(entry.timestamp)}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="rounded bg-[#f3f4f7] px-1.5 py-0.5 font-mono text-xs text-text-main">{entry.user}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-text-main">{entry.module}</TableCell>
                    <TableCell>
                      <span className={cn('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold', style.tone)}>
                        <style.icon className="h-3 w-3" />
                        {entry.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="mx-auto max-w-lg">
                        <div className="leading-snug text-text-main">{highlightRecords(entry.summary)}</div>
                        {entry.detail ? <div className="mt-0.5 text-xs text-text-muted">{entry.detail}</div> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-text-muted">
                    No activity matches the current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </DataTable>
      </section>
    </div>
  );
}
