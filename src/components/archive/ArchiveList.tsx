import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Archive, Search, Filter, FileDown, FolderOpen } from 'lucide-react';

export function ArchiveList() {
  const archives = [
    { id: '2023', label: 'Legislative Year 2023', count: 142, lastUpdated: 'Dec 20, 2023' },
    { id: '2022', label: 'Legislative Year 2022', count: 128, lastUpdated: 'Dec 18, 2022' },
    { id: '2021', label: 'Legislative Year 2021', count: 156, lastUpdated: 'Dec 22, 2021' },
    { id: '2020', label: 'Legislative Year 2020', count: 98, lastUpdated: 'Dec 15, 2020' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Archives</h1>
          <p className="text-sm text-text-muted">Access historical legislative records and past session documents.</p>
        </div>
        <Button variant="outline" size="sm" className="border-border text-text-muted">
          <FileDown className="mr-2 h-4 w-4" />
          Export Index
        </Button>
      </div>

      <div className="bg-white p-6 rounded-lg border border-border shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input placeholder="Search archives..." className="pl-10 border-border" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {archives.map((archive) => (
          <Card key={archive.id} className="border border-border shadow-sm hover:shadow-md transition-all duration-300 group">
            <CardContent className="p-6 flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                <Archive className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-primary">{archive.label}</h3>
                <div className="flex items-center gap-4 mt-1 text-sm text-text-muted">
                  <span>{archive.count} Documents</span>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span>Updated: {archive.lastUpdated}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-text-muted hover:text-primary">
                <FolderOpen className="h-5 w-5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
