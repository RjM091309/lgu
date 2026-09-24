import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { saveCsv } from '@/lib/files';
import { Archive, Search, FileDown, FolderOpen, Download } from 'lucide-react';

interface ArchiveYear {
  id: string;
  label: string;
  count: number;
  lastUpdated: string;
}

const ARCHIVES: ArchiveYear[] = [
  { id: '2025', label: 'Legislative Year 2025', count: 142, lastUpdated: 'Dec 19, 2025' },
  { id: '2024', label: 'Legislative Year 2024', count: 128, lastUpdated: 'Dec 18, 2024' },
  { id: '2023', label: 'Legislative Year 2023', count: 156, lastUpdated: 'Dec 20, 2023' },
  { id: '2022', label: 'Legislative Year 2022', count: 98, lastUpdated: 'Dec 16, 2022' },
];

// Splits a year's document count into record types so each archive can show a breakdown.
const breakdown = (archive: ArchiveYear) => {
  const ordinances = Math.round(archive.count * 0.12);
  const resolutions = Math.round(archive.count * 0.55);
  const minutes = Math.round(archive.count * 0.18);
  return [
    { type: 'Ordinances', count: ordinances },
    { type: 'Resolutions', count: resolutions },
    { type: 'Session Minutes and Journals', count: minutes },
    { type: 'Committee Reports and Other Records', count: archive.count - ordinances - resolutions - minutes },
  ];
};

export function ArchiveList() {
  const [keyword, setKeyword] = useState('');
  const [openArchive, setOpenArchive] = useState<ArchiveYear | null>(null);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return ARCHIVES;
    return ARCHIVES.filter((archive) => archive.label.toLowerCase().includes(query) || archive.id.includes(query));
  }, [keyword]);

  const exportIndex = () => {
    const saved = saveCsv(
      'sb-capas-archive-index.csv',
      ['Legislative Year', 'Record Type', 'Documents', 'Last Updated'],
      ARCHIVES.flatMap((archive) => breakdown(archive).map((row) => [archive.id, row.type, row.count, archive.lastUpdated]))
    );
    if (!saved) {
      toast('Export failed', 'The CSV file could not be created. Please try again.', 'error');
      return;
    }
    toast('Archive index exported', 'sb-capas-archive-index.csv was downloaded.');
  };

  const exportYear = (archive: ArchiveYear) => {
    const saved = saveCsv(
      `sb-capas-archive-${archive.id}.csv`,
      ['Record Type', 'Documents'],
      breakdown(archive).map((row) => [row.type, row.count])
    );
    if (!saved) {
      toast('Export failed', 'The CSV file could not be created. Please try again.', 'error');
      return;
    }
    toast(`${archive.label} index downloaded`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Archives</h1>
          <p className="text-sm text-text-muted">Access historical legislative records and past session documents.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportIndex}>
          <FileDown className="mr-2 h-4 w-4" />
          Export Index
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search archives by year..." className="pl-10" aria-label="Search archives" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {filtered.map((archive) => (
          <Card key={archive.id} className="group border border-border shadow-sm transition-all duration-300 hover:shadow-md">
            <CardContent className="p-0">
              <button type="button" onClick={() => setOpenArchive(archive)} className="flex w-full items-center gap-6 p-6 text-left">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 text-primary transition-colors group-hover:bg-primary/10">
                  <Archive className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-primary">{archive.label}</h3>
                  <div className="mt-1 flex items-center gap-4 text-sm text-text-muted">
                    <span>{archive.count} Documents</span>
                    <span className="h-1 w-1 rounded-full bg-border" />
                    <span>Updated: {archive.lastUpdated}</span>
                  </div>
                </div>
                <FolderOpen className="h-5 w-5 text-text-muted group-hover:text-primary" aria-label={`Open ${archive.label}`} />
              </button>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 ? <p className="text-sm text-text-muted">No archive matches &ldquo;{keyword}&rdquo;.</p> : null}
      </div>

      <Dialog open={openArchive !== null} onOpenChange={(open) => !open && setOpenArchive(null)}>
        <DialogContent>
          {openArchive ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl text-primary">{openArchive.label}</DialogTitle>
                <DialogDescription>
                  {openArchive.count} documents · Last updated {openArchive.lastUpdated}
                </DialogDescription>
              </DialogHeader>
              <ul className="mt-5 divide-y divide-border rounded-lg border border-border">
                {breakdown(openArchive).map((row) => (
                  <li key={row.type} className="flex justify-between px-4 py-3 text-sm">
                    <span>{row.type}</span>
                    <span className="font-semibold text-primary">{row.count}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex justify-end">
                <Button onClick={() => exportYear(openArchive)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download index
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
