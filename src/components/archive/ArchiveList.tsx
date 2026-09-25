import { useMemo, useState } from 'react';
import { Archive, Box, CheckCircle2, FileDown, FileText, Hand, Printer, ScanLine, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { openPrintWindow, saveCsv } from '@/lib/files';
import { logActivity } from '@/lib/activity-log';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------- Sample data */

interface ArchiveYear {
  year: string;
  count: number;
  closed: string;
  /** Share of the year's records already scanned. */
  digitized: number;
}

const ARCHIVES: ArchiveYear[] = [
  { year: '2025', count: 142, closed: '2025-12-19', digitized: 0.92 },
  { year: '2024', count: 128, closed: '2024-12-18', digitized: 0.81 },
  { year: '2023', count: 156, closed: '2023-12-20', digitized: 0.64 },
  { year: '2022', count: 98, closed: '2022-12-16', digitized: 0.45 },
  { year: '2021', count: 104, closed: '2021-12-17', digitized: 0.28 },
  { year: '2020', count: 87, closed: '2020-12-18', digitized: 0.12 },
];

const TYPES = ['Ordinance', 'Resolution', 'Minutes', 'Committee Report'] as const;
type RecordType = (typeof TYPES)[number];
const TYPE_LABEL: Record<RecordType, string> = { Ordinance: 'Ordinances', Resolution: 'Resolutions', Minutes: 'Minutes & Journals', 'Committee Report': 'Committee Reports' };
const TYPE_TONE: Record<RecordType, string> = {
  Ordinance: 'border-blue-200 bg-blue-50 text-blue-800',
  Resolution: 'border-violet-200 bg-violet-50 text-violet-800',
  Minutes: 'border-slate-200 bg-slate-50 text-slate-700',
  'Committee Report': 'border-amber-200 bg-amber-50 text-amber-800',
};
// Share of each year's records by type.
const TYPE_SHARE: [RecordType, number][] = [
  ['Ordinance', 0.12],
  ['Resolution', 0.55],
  ['Minutes', 0.18],
  ['Committee Report', 0.15],
];

const ORDINANCE_TITLES = [
  'An Ordinance Regulating the Operation of Tricycles-for-Hire in the Municipality of Capas',
  'An Ordinance Prescribing the Rental Rates of Stalls at the Capas Public Market',
  'An Ordinance Requiring the Segregation of Solid Waste at Source',
  'An Ordinance Regulating Sidewalk Vending along the Poblacion Area',
  'An Ordinance Regulating the Use of Videoke and Sound Systems during Night Hours',
  'An Ordinance Providing Burial Assistance to Indigent Families',
  'An Ordinance Institutionalizing the Capas Municipal Scholarship Program',
  'An Ordinance Prohibiting Smoking in Public Places',
  'An Ordinance Creating the Municipal Council for the Protection of Children',
  'An Ordinance Imposing Fees for the Use of the Capas Municipal Gymnasium',
  'An Ordinance Regulating the Slaughter of Livestock outside the Municipal Abattoir',
  'An Ordinance Adopting the Capas Comprehensive Land Use Plan',
  'An Ordinance Establishing the Capas Local Disaster Risk Reduction Fund Guidelines',
  'An Ordinance Regulating Motorcycle Mufflers and Excessive Noise',
  'An Ordinance Requiring Barangay Clearance for Business Permit Applications',
  'An Ordinance Prohibiting the Use of Plastic Bags in Dry Goods Sections',
  'An Ordinance Setting Curfew Hours for Minors',
  'An Ordinance Granting Tax Amnesty on Real Property Tax Delinquencies',
  'An Ordinance Establishing a Senior Citizens Center in the Poblacion',
  'An Ordinance Regulating the Operation of Internet Cafes near Schools',
];
// The 20 barangays of Capas, used to vary resolution titles.
const BARANGAYS = [
  'Aranguren', 'Bueno', 'Cristo Rey', 'Cubcub', 'Cutcut 1st', 'Cutcut 2nd', 'Dolores', 'Estrada', 'Lawy', 'Manga',
  'Manlapig', 'Maruglu', "O'Donnell", 'Santa Juliana', 'Santa Lucia', 'Santa Rita', 'Santo Domingo 1st', 'Santo Domingo 2nd', 'Santo Rosario', 'Talaga',
];
const RESOLUTION_TEMPLATES = [
  (b: string) => `Resolution Approving the Annual Budget of Barangay ${b}`,
  (b: string) => `Resolution Requesting the DPWH to Repair the Drainage System in Barangay ${b}`,
  (b: string) => `Resolution Endorsing the Farm-to-Market Road Project of Barangay ${b}`,
  (b: string) => `Resolution Approving the Supplemental Budget of Barangay ${b}`,
  (b: string) => `Resolution Commending the Barangay Health Workers of Barangay ${b}`,
  (b: string) => `Resolution Authorizing the Municipal Mayor to Sign a Memorandum of Agreement with Barangay ${b}`,
];
const COMMITTEES = ['Finance, Budget and Appropriations', 'Tourism, Culture and Heritage', 'Health and Social Welfare', 'Education', 'Public Works and Infrastructure', 'Agriculture', 'Transportation'];

interface ArchivedRecord {
  id: string;
  number: string;
  title: string;
  type: RecordType;
  date: string;
  box: number;
  shelf: string;
  digitized: boolean;
}

// Deterministic sample records for a year, so the listing is stable between visits.
const recordsFor = (archive: ArchiveYear): ArchivedRecord[] => {
  const shelf = String.fromCharCode(65 + (2025 - Number(archive.year)));
  const records: ArchivedRecord[] = [];
  let index = 0;
  TYPE_SHARE.forEach(([type, share], typeIndex) => {
    const total = typeIndex === TYPE_SHARE.length - 1 ? archive.count - records.length : Math.round(archive.count * share);
    for (let n = 1; n <= total; n += 1) {
      const month = Math.min(12, Math.floor(((n - 1) / total) * 12) + 1);
      // Days 1–15 keep December records before the year is closed (Dec 16 or later).
      const day = ((n * 7 + typeIndex * 3) % 15) + 1;
      const date = `${archive.year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const seq = String(n).padStart(3, '0');
      let number = '';
      let title = '';
      if (type === 'Ordinance') {
        number = `Mun. Ord. No. ${archive.year}-${seq}`;
        title = ORDINANCE_TITLES[(n + Number(archive.year)) % ORDINANCE_TITLES.length];
      } else if (type === 'Resolution') {
        number = `SB Res. No. ${archive.year}-${seq}`;
        // Each template/barangay pair is used once per year (6 × 20 combinations).
        title = RESOLUTION_TEMPLATES[n % RESOLUTION_TEMPLATES.length](BARANGAYS[(Math.floor(n / RESOLUTION_TEMPLATES.length) + Number(archive.year)) % BARANGAYS.length]);
      } else if (type === 'Minutes') {
        number = `Minutes ${archive.year}-${seq}`;
        title = n % 5 === 0 ? `Minutes of the Special Session No. ${Math.ceil(n / 5)}` : `Minutes and Journal of the ${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'} Regular Session`;
      } else {
        number = `Comm. Rpt. No. ${archive.year}-${seq}`;
        title = `Committee Report of the Committee on ${COMMITTEES[n % COMMITTEES.length]}`;
      }
      index += 1;
      // Spread scanned records evenly so the share matches the year's digitization rate.
      const digitized = Math.floor(index * archive.digitized) !== Math.floor((index - 1) * archive.digitized);
      records.push({ id: `${archive.year}-${type}-${n}`, number, title, type, date, box: Math.ceil(index / 20), shelf, digitized });
    }
  });
  return records.sort((a, b) => b.date.localeCompare(a.date));
};

const formatDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

/* ------------------------------------------------------------------- View */

export function ArchiveList() {
  const [selectedYear, setSelectedYear] = useState(ARCHIVES[0].year);
  const [typeFilter, setTypeFilter] = useState<'All' | RecordType>('All');
  const [keyword, setKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openRecord, setOpenRecord] = useState<ArchivedRecord | null>(null);
  const [requested, setRequested] = useState<string[]>([]);
  const pageSize = 10;

  const archive = ARCHIVES.find((entry) => entry.year === selectedYear) ?? ARCHIVES[0];
  const records = useMemo(() => recordsFor(archive), [archive]);
  const typeCounts = TYPES.map((type) => ({ type, count: records.filter((record) => record.type === type).length }));

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return records.filter((record) => (typeFilter === 'All' || record.type === typeFilter) && (query === '' || `${record.number} ${record.title}`.toLowerCase().includes(query)));
  }, [records, typeFilter, keyword]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totals = ARCHIVES.reduce(
    (acc, entry) => ({ count: acc.count + entry.count, digitized: acc.digitized + Math.round(entry.count * entry.digitized) }),
    { count: 0, digitized: 0 }
  );
  const overallRate = Math.round((totals.digitized / totals.count) * 100);
  const yearDigitized = records.filter((record) => record.digitized).length;

  const selectYear = (year: string) => {
    setSelectedYear(year);
    setTypeFilter('All');
    setKeyword('');
    setCurrentPage(1);
  };

  const exportIndex = () => {
    const saved = saveCsv(
      'sb-capas-archive-index.csv',
      ['Legislative Year', 'Record Type', 'Documents', 'Digitized', 'Closed'],
      ARCHIVES.flatMap((entry) => {
        const yearRecords = recordsFor(entry);
        return TYPES.map((type) => {
          const ofType = yearRecords.filter((record) => record.type === type);
          return [entry.year, TYPE_LABEL[type], ofType.length, ofType.filter((record) => record.digitized).length, entry.closed];
        });
      })
    );
    if (!saved) {
      toast('Export failed', 'The CSV file could not be created. Please try again.', 'error');
      return;
    }
    toast('Archive index exported', 'sb-capas-archive-index.csv was downloaded.');
    logActivity({ module: 'Archives', action: 'Exported', summary: 'Exported the archive index', detail: 'sb-capas-archive-index.csv was downloaded.' });
  };

  const exportYear = () => {
    const saved = saveCsv(
      `sb-capas-archive-${archive.year}.csv`,
      ['Record No.', 'Title', 'Type', 'Date', 'Location', 'Digitized'],
      filtered.map((record) => [record.number, record.title, record.type, record.date, `Shelf ${record.shelf}, Box ${record.box}`, record.digitized ? 'Yes' : 'No'])
    );
    if (!saved) {
      toast('Export failed', 'The CSV file could not be created. Please try again.', 'error');
      return;
    }
    toast(`Archive ${archive.year} list downloaded`, `${filtered.length} record(s) saved as CSV.`);
    logActivity({ module: 'Archives', action: 'Exported', summary: `Exported the ${archive.year} archive list`, detail: `${filtered.length} record(s).` });
  };

  const printRecord = (record: ArchivedRecord) => {
    const ok = openPrintWindow(
      record.number,
      `<div class="title">${record.title}</div>
       <div class="rows">
         <div><b>Record No.</b>: ${record.number}</div>
         <div><b>Type</b>: ${record.type}</div>
         <div><b>Date</b>: ${formatDate(record.date)}</div>
         <div><b>Archive location</b>: Shelf ${record.shelf}, Box ${record.box}</div>
         <div><b>Legislative year</b>: ${archive.year}</div>
       </div>`
    );
    if (!ok) toast('Record not opened', 'Your browser blocked the print window. Allow pop-ups for this site and try again.', 'error');
  };

  const requestRetrieval = async (record: ArchivedRecord) => {
    const confirmed = await confirmAction({
      title: 'Request the paper copy?',
      description: `Records staff will retrieve ${record.number} from Shelf ${record.shelf}, Box ${record.box} and scan it for the digital archive.`,
      confirmLabel: 'Request retrieval',
    });
    if (!confirmed) return;
    setRequested((prev) => [...prev, record.id]);
    toast('Retrieval requested', `${record.number} · Shelf ${record.shelf}, Box ${record.box}.`);
    logActivity({ module: 'Archives', action: 'Created', summary: `Requested retrieval of ${record.number}`, detail: `Shelf ${record.shelf}, Box ${record.box}, for scanning.` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Archives</h1>
          <p className="text-sm text-text-muted">Closed legislative years, where each record is stored, and how much has been scanned.</p>
        </div>
        <Button variant="outline" onClick={exportIndex}>
          <FileDown className="mr-2 h-4 w-4" />
          Export Index
        </Button>
      </div>

      {/* Digitization overview */}
      <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ScanLine className="h-6 w-6" />
            </span>
            <div>
              <div className="text-sm font-semibold text-text-main">Records digitization</div>
              <div className="text-xs text-text-muted">
                <b className="text-text-main">{totals.digitized.toLocaleString()}</b> of {totals.count.toLocaleString()} archived records scanned across {ARCHIVES.length} legislative years
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2 lg:order-last">
            <span className="text-3xl font-semibold tabular-nums text-text-main">{overallRate}%</span>
            <span className="text-xs text-text-muted">digitized</span>
          </div>
        </div>
        {/* Stacked by year, oldest first, so the gap to close is visible. */}
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-[#eef0f4]">
          {[...ARCHIVES].reverse().map((entry) => (
            <span
              key={entry.year}
              className="h-full border-r-2 border-white last:border-r-0"
              style={{ width: `${(entry.count / totals.count) * 100}%`, background: `linear-gradient(to right, #2a78d6 ${entry.digitized * 100}%, transparent ${entry.digitized * 100}%)` }}
              title={`${entry.year}: ${Math.round(entry.digitized * 100)}% scanned`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex text-[10px] text-text-muted">
          {[...ARCHIVES].reverse().map((entry) => (
            <span key={entry.year} className="text-center" style={{ width: `${(entry.count / totals.count) * 100}%` }}>
              {entry.year}
            </span>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_1fr]">
        {/* Year shelf */}
        <nav aria-label="Legislative years" className="flex gap-3 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
          {ARCHIVES.map((entry) => {
            const active = entry.year === selectedYear;
            const rate = Math.round(entry.digitized * 100);
            return (
              <button
                key={entry.year}
                type="button"
                onClick={() => selectYear(entry.year)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'relative flex min-w-[200px] items-center gap-3 overflow-hidden rounded-xl border py-3 pl-5 pr-4 text-left transition-all',
                  active ? 'border-primary bg-primary text-white shadow-md' : 'border-border bg-white hover:border-primary/40 hover:shadow-sm'
                )}
              >
                {/* Binder spine */}
                <span className={cn('absolute inset-y-0 left-0 w-2', active ? 'bg-[#d4a72c]' : 'bg-primary/15')} aria-hidden />
                <Archive className={cn('h-5 w-5 shrink-0', active ? 'text-white/80' : 'text-primary')} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-bold leading-none">{entry.year}</span>
                    <span className={cn('text-[11px] tabular-nums', active ? 'text-white/75' : 'text-text-muted')}>{entry.count} records</span>
                  </span>
                  <span className={cn('mt-2 block h-1.5 overflow-hidden rounded-full', active ? 'bg-white/20' : 'bg-[#eef0f4]')}>
                    <span className={cn('block h-full rounded-full', active ? 'bg-white' : 'bg-[#2a78d6]')} style={{ width: `${rate}%` }} />
                  </span>
                  <span className={cn('mt-1 block text-[10px]', active ? 'text-white/75' : 'text-text-muted')}>{rate}% scanned</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Year contents */}
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <header className="border-b border-border px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-main">Legislative Year {archive.year}</h2>
                <p className="text-xs text-text-muted">
                  {archive.count} records · closed {formatDate(archive.closed)} · Shelf {records[0]?.shelf} · {Math.max(...records.map((record) => record.box))} boxes ·{' '}
                  {yearDigitized} scanned
                </p>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <Input
                    value={keyword}
                    onChange={(e) => {
                      setKeyword(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder={`Search ${archive.year} records`}
                    className="w-56 pl-9"
                  />
                </div>
                <Button variant="outline" onClick={exportYear}>
                  <FileDown className="mr-1.5 h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Record type">
              {(['All', ...TYPES] as const).map((type) => {
                const count = type === 'All' ? records.length : typeCounts.find((entry) => entry.type === type)?.count ?? 0;
                const active = typeFilter === type;
                return (
                  <button
                    key={type}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setTypeFilter(type);
                      setCurrentPage(1);
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                      active ? 'border-primary bg-primary/[0.06] text-primary' : 'border-border text-text-muted hover:text-text-main'
                    )}
                  >
                    {type === 'All' ? 'All records' : TYPE_LABEL[type]}
                    <span className={cn('rounded px-1 text-[10px] tabular-nums', active ? 'bg-primary text-white' : 'bg-muted')}>{count}</span>
                  </button>
                );
              })}
            </div>
          </header>

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
                  <TableHead>Record</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Copy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((record) => (
                  <TableRow key={record.id} onClick={() => setOpenRecord(record)} className="cursor-pointer hover:bg-primary/[0.03]">
                    <TableCell>
                      <div className="mx-auto max-w-md">
                        <div className="font-medium text-text-main">{record.number}</div>
                        <div className="truncate text-xs text-text-muted" title={record.title}>
                          {record.title}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold', TYPE_TONE[record.type])}>{record.type}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-text-main">{formatDate(record.date)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-text-main">
                        <Box className="h-3.5 w-3.5 text-text-muted" />
                        {record.shelf}-{String(record.box).padStart(2, '0')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {record.digitized ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Scanned
                        </span>
                      ) : requested.includes(record.id) ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-700">
                          <Hand className="h-3.5 w-3.5" />
                          Requested
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-text-muted">
                          <FileText className="h-3.5 w-3.5" />
                          Paper only
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-text-muted">
                      No {archive.year} records match the current filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </DataTable>
        </section>
      </div>

      <Dialog open={openRecord !== null} onOpenChange={(open) => !open && setOpenRecord(null)}>
        <DialogContent>
          {openRecord ? (
            <>
              <DialogHeader>
                <span className={cn('w-fit rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', TYPE_TONE[openRecord.type])}>{openRecord.type}</span>
                <DialogTitle className="text-lg leading-snug text-primary">{openRecord.title}</DialogTitle>
                <DialogDescription>{openRecord.number}</DialogDescription>
              </DialogHeader>
              <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
                {[
                  ['Date', formatDate(openRecord.date)],
                  ['Legislative year', archive.year],
                  ['Shelf', openRecord.shelf],
                  ['Box', String(openRecord.box)],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white px-4 py-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
                    <dd className="mt-0.5 font-medium text-text-main">{value}</dd>
                  </div>
                ))}
              </dl>
              <div
                className={cn(
                  'mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px]',
                  openRecord.digitized ? 'bg-green-50 text-green-800' : requested.includes(openRecord.id) ? 'bg-amber-50 text-amber-800' : 'bg-muted text-text-main'
                )}
              >
                {openRecord.digitized ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                {openRecord.digitized
                  ? 'A scanned copy is in the digital archive.'
                  : requested.includes(openRecord.id)
                    ? 'Retrieval requested; the records staff will scan it.'
                    : 'Only the paper copy exists. Request retrieval to have it scanned.'}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                {openRecord.digitized ? (
                  <Button onClick={() => printRecord(openRecord)}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print record sheet
                  </Button>
                ) : (
                  <Button onClick={() => requestRetrieval(openRecord)} disabled={requested.includes(openRecord.id)}>
                    <Hand className="mr-2 h-4 w-4" />
                    {requested.includes(openRecord.id) ? 'Retrieval requested' : 'Request retrieval'}
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
