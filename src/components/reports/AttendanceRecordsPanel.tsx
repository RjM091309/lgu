import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ClipboardList, Download, FileText, Minus, Plus, Printer, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { PdfPages } from '@/components/reports/PdfPages';
import { quorumMet, useAttendanceRecords, type AttendanceRecord } from '@/lib/attendance-records';
import { downloadUrl, printPdfUrl } from '@/lib/files';
import { formatLongDate } from '@/lib/sessions';
import { logActivity } from '@/lib/activity-log';
import { cn } from '@/lib/utils';

// The attendance records library: every record in a list (newest first, by month) beside the one being read, as
// in an inbox. On a phone the list fills the screen and a record opens over it, with a way back.

type Filter = 'all' | 'met' | 'not-met';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'met', label: 'Quorum' },
  { id: 'not-met', label: 'No quorum' },
];
const ZOOMS = [1, 1.25, 1.5, 2];

const monthOf = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function QuorumBadge({ record, size = 'sm' }: { record: AttendanceRecord; size?: 'sm' | 'md' }) {
  const met = quorumMet(record);
  if (met === null) return null;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-semibold',
        size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]',
        met ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      )}
    >
      {met ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
      {met ? 'Quorum' : 'No quorum'}
    </span>
  );
}

const originText = (record: AttendanceRecord) =>
  record.origin === 'e-session' ? `Held online (E-Session) · saved by ${record.savedBy}` : record.origin === 'upload' ? `Uploaded to Session Files by ${record.savedBy}` : 'Held in the Session Hall';

export function AttendanceRecordsPanel() {
  const records = useAttendanceRecords();
  const wide = useMediaQuery('(min-width: 1024px)');
  const touch = useMediaQuery('(pointer: coarse)');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // On a phone: the record opened over the list.
  const [reading, setReading] = useState(false);
  const [zoom, setZoom] = useState(1);

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return records.filter((record) => {
      const met = quorumMet(record);
      if (filter === 'met' && met !== true) return false;
      if (filter === 'not-met' && met !== false) return false;
      const haystack = `${record.title} ${record.type} ${formatLongDate(record.date)} ${monthOf(record.date)}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [records, query, filter]);

  const months = useMemo(() => {
    const groups: { month: string; list: AttendanceRecord[] }[] = [];
    for (const record of shown) {
      const month = monthOf(record.date);
      if (groups.at(-1)?.month === month) groups.at(-1)!.list.push(record);
      else groups.push({ month, list: [record] });
    }
    return groups;
  }, [shown]);

  // Side by side, a record is always open: the chosen one, else the newest shown.
  const selected = records.find((record) => record.id === selectedId) ?? (wide ? shown[0] : undefined) ?? null;
  const viewing = wide ? selected : reading ? selected : null;

  const [file, setFile] = useState<{ id: string; blob: Blob; url: string } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const viewingId = viewing?.id ?? null;
  useEffect(() => {
    if (!viewing) return;
    let cancelled = false;
    let url: string | null = null;
    setFile(null);
    setLoadFailed(false);
    setZoom(1);
    viewing
      .load()
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setFile({ id: viewing.id, blob, url });
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // Reloaded when another record is opened, not when the list around it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingId]);

  const viewerRef = useRef<HTMLElement>(null);
  const open = (record: AttendanceRecord) => {
    setSelectedId(record.id);
    setReading(true);
  };
  // On a phone the record replaces the list, which may have been scrolled far down: start at its top.
  useEffect(() => {
    if (!wide && reading) viewerRef.current?.scrollIntoView({ block: 'start' });
  }, [wide, reading]);

  const download = () => {
    if (!viewing || !file) return;
    if (!downloadUrl(file.url, viewing.fileName)) return toast('Download failed', 'The browser could not save the file. Try again.', 'error');
    logActivity({ module: 'Reports', action: 'Exported', summary: `Downloaded the attendance record of the ${viewing.title}`, detail: `${formatLongDate(viewing.date)} · ${viewing.fileName}` });
  };

  const print = () => {
    if (!viewing || !file) return;
    if (!printPdfUrl(file.url)) toast('Not printed', 'The browser could not open the print dialog. Download the record and print it from there.', 'error');
  };

  if (!records.length) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white px-6 py-16 text-center">
        <ClipboardList className="h-10 w-10 text-text-muted" />
        <h2 className="mt-3 text-base font-semibold text-text-main">No attendance records yet</h2>
        <p className="mt-1 max-w-md text-sm text-text-muted">
          When an e-session ends, its attendance record is saved here automatically. Attendance sheets uploaded to Session Files under Attendance Record show here too.
        </p>
      </div>
    );
  }

  const list = (
    <section aria-label="Attendance records" className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)]">
      <div className="space-y-2 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sessions, dates…" className="pl-9" aria-label="Search attendance records" />
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Show">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={filter === entry.id}
              onClick={() => setFilter(entry.id)}
              className={cn('rounded-md px-2 py-1.5 text-xs font-semibold transition-colors', filter === entry.id ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text-main')}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {months.length ? (
          months.map(({ month, list: entries }) => (
            <div key={month}>
              <p className="sticky top-0 z-[1] border-b border-border bg-muted/90 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted backdrop-blur">{month}</p>
              <ul>
                {entries.map((record) => {
                  const active = viewing?.id === record.id;
                  return (
                    <li key={record.id}>
                      <button
                        type="button"
                        onClick={() => open(record)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors',
                          active ? 'bg-primary/[0.08] shadow-[inset_3px_0_0] shadow-primary' : 'hover:bg-muted/60'
                        )}
                      >
                        <span className="w-12 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-text-muted">{shortDate(record.date)}</span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-sm font-semibold', active ? 'text-primary' : 'text-text-main')}>{record.title}</span>
                          <span className="block truncate text-xs text-text-muted">
                            {record.present !== null ? `${record.present} of ${record.total} members` : 'Uploaded file'}
                            {record.origin === 'e-session' ? ' · E-Session' : ''}
                          </span>
                        </span>
                        <QuorumBadge record={record} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        ) : (
          <p className="px-4 py-10 text-center text-sm text-text-muted">No records match. Try another search or show all.</p>
        )}
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-text-muted">
        {shown.length} of {records.length} records
      </p>
    </section>
  );

  const viewer = viewing ? (
    <section ref={viewerRef} aria-label={`Attendance record: ${viewing.title}`} className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="flex min-w-0 items-start gap-2">
          {!wide ? (
            <Button variant="ghost" size="icon" className="-ml-2 shrink-0" onClick={() => setReading(false)} aria-label="Back to the list">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-primary">{viewing.title}</h2>
              <QuorumBadge record={viewing} size="md" />
            </div>
            <p className="text-sm text-text-muted">
              {formatLongDate(viewing.date)} · {viewing.type === 'Committee Hearing' || viewing.type === 'Meeting' || viewing.type === 'Session' ? viewing.type : `${viewing.type} session`}
              {viewing.present !== null ? ` · ${viewing.present} of ${viewing.total} members present, ${viewing.quorum} needed` : ''}
            </p>
            <p className="text-xs text-text-muted">{originText(viewing)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {touch ? null : (
            <Button variant="outline" onClick={print} disabled={!file}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          )}
          <Button onClick={download} disabled={!file}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </div>
      <div className="relative min-h-[60vh] flex-1 overflow-auto bg-muted/60 p-3 sm:p-5">
        {loadFailed ? (
          <p className="py-16 text-center text-sm text-text-muted">This record could not be opened. The LIMS server may be unreachable; try again in a moment.</p>
        ) : file && file.id === viewing.id ? (
          <PdfPages blob={file.blob} zoom={zoom} title={viewing.title} />
        ) : (
          <p className="py-16 text-center text-sm text-text-muted">Opening the record…</p>
        )}
        {file ? (
          <div className="sticky bottom-0 mt-3 flex justify-end">
            <div className="flex items-center gap-1 rounded-full border border-border bg-white p-1 shadow-md">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])} disabled={zoom === ZOOMS[0]} aria-label="Zoom out">
                <Minus className="h-4 w-4" />
              </Button>
              <button type="button" onClick={() => setZoom(1)} className="min-w-14 px-1 text-xs font-semibold tabular-nums text-text-main" title="Fit to width">
                {zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`}
              </button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])} disabled={zoom === ZOOMS.at(-1)} aria-label="Zoom in">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  ) : wide ? (
    <section className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-16 text-center">
      <FileText className="h-10 w-10 text-text-muted" />
      <p className="mt-3 text-sm text-text-muted">Choose a record to read it here.</p>
    </section>
  ) : null;

  if (!wide) return viewing ? viewer : list;
  return <div className="grid items-start gap-6 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">{list}{viewer}</div>;
}
