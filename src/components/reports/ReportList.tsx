import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { mockBills, mockSessions } from '@/lib/mock-data';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { StatusBadge } from '@/components/ui/status-badge';
import { openPrintWindow, saveCsv } from '@/lib/files';
import { BarChart3, TrendingUp, PieChart, FileText, Download, Users } from 'lucide-react';
import { gridTableClassName, gridTableHeaderClassName, gridTableRowClassName } from '@/components/ui/table';
import { logActivity } from '@/lib/activity-log';
import { StatisticsView } from '@/components/reports/StatisticsView';
import { AttendancePublicationView } from '@/components/reports/AttendancePublicationView';

interface ReportListProps {
  activeTab: string;
}

const reportContentMap: Record<string, { title: string; description: string; items: { title: string; type: string; date: string }[] }> = {
  reports: {
    title: 'Search and Listing Reports',
    description: 'Generate and export filtered listings of resolutions, ordinances, and transactions.',
    items: [
      { title: 'Approved/Unapproved Legislation by Keyword', type: 'Listing', date: 'September 2026' },
      { title: 'Authorship and Sponsorship Report', type: 'Listing', date: 'Q3 2026' },
      { title: 'Committee Referral and Status Report', type: 'Search', date: 'FY 2026' },
      { title: 'Incoming Documents and Transmittals Listing', type: 'Search', date: 'August 2026' },
    ],
  },
  'report-search-listing': {
    title: 'Search and Listing Reports',
    description: 'Generate and export filtered listings of resolutions, ordinances, and transactions.',
    items: [
      { title: 'Approved/Unapproved Legislation by Keyword', type: 'Listing', date: 'September 2026' },
      { title: 'Authorship and Sponsorship Report', type: 'Listing', date: 'Q3 2026' },
      { title: 'Committee Referral and Status Report', type: 'Search', date: 'FY 2026' },
      { title: 'Incoming Documents and Transmittals Listing', type: 'Search', date: 'August 2026' },
    ],
  },
  'report-statistical-performance': {
    title: 'Statistical and Performance Reports',
    description: 'View yearly totals, committee productivity, and performance indicators.',
    items: [
      { title: 'Total Approved Resolutions/Ordinances per Year', type: 'Statistical', date: '2025 Annual' },
      { title: 'Committee Performance Summary', type: 'Performance', date: 'Q3 2026' },
      { title: 'Member Authorship Productivity', type: 'Performance', date: 'September 2026' },
      { title: 'Incoming Documents by Origin/Referral', type: 'Statistical', date: 'FY 2026' },
    ],
  },
  'report-attendance-publication': {
    title: 'Attendance and Publication Reports',
    description: 'Track session attendance, quorum status, and publication-related outputs.',
    items: [
      { title: 'Session Attendance with Quorum', type: 'Attendance', date: 'September 2026' },
      { title: 'Session Attendance without Quorum', type: 'Attendance', date: 'Q3 2026' },
      { title: 'Second Reading Publication by Posting', type: 'Publication', date: 'FY 2026' },
      { title: 'Ordinances with Penal Clause Publication Status', type: 'Publication', date: 'August 2026' },
    ],
  },
};

export function ReportList({ activeTab }: ReportListProps) {
  const selected = reportContentMap[activeTab] ?? reportContentMap['report-search-listing'];
  const reports = selected.items;
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateType, setGenerateType] = useState(reports[0]?.title ?? '');
  const [generatePeriod, setGeneratePeriod] = useState('Q3 2026');

  const statusOptions: SelectOption[] = useMemo(
    () => [
      { value: 'All', label: 'All Status' },
      ...Array.from(new Set(mockBills.map((bill) => bill.status))).map((status) => ({
        value: status,
        label: status,
      })),
    ],
    []
  );

  const categoryOptions: SelectOption[] = useMemo(
    () => [
      { value: 'All', label: 'All Categories' },
      ...Array.from(new Set(mockBills.map((bill) => bill.category))).map((category) => ({
        value: category,
        label: category,
      })),
    ],
    []
  );

  const filteredListing = useMemo(() => {
    return mockBills.filter((bill) => {
      const matchesKeyword =
        keyword.trim().length === 0 ||
        bill.title.toLowerCase().includes(keyword.toLowerCase()) ||
        bill.number.toLowerCase().includes(keyword.toLowerCase()) ||
        bill.author.toLowerCase().includes(keyword.toLowerCase());
      const matchesStatus = statusFilter === 'All' || bill.status === statusFilter;
      const matchesCategory = categoryFilter === 'All' || bill.category === categoryFilter;
      return matchesKeyword && matchesStatus && matchesCategory;
    });
  }, [keyword, statusFilter, categoryFilter]);

  const statsSummary = useMemo(() => {
    const approvedCount = mockBills.filter((bill) => ['Passed', 'Enacted'].includes(bill.status)).length;
    const approvalRate = Math.round((approvedCount / mockBills.length) * 100);
    const byAuthor = mockBills.reduce<Record<string, number>>((acc, bill) => {
      acc[bill.author] = (acc[bill.author] ?? 0) + 1;
      return acc;
    }, {});
    const byCategory = mockBills.reduce<Record<string, number>>((acc, bill) => {
      acc[bill.category] = (acc[bill.category] ?? 0) + 1;
      return acc;
    }, {});
    const topAuthor = Object.entries(byAuthor).sort((a, b) => b[1] - a[1])[0];
    return {
      approvalRate,
      topAuthor: topAuthor ? `${topAuthor[0]} (${topAuthor[1]})` : 'N/A',
      byAuthor,
      byCategory,
      approvedCount,
    };
  }, []);

  const attendanceRows = useMemo(
    () =>
      mockSessions.map((session, index) => {
        const present = 6 + (index % 3);
        const absent = 2 - (index % 2);
        const quorum = present >= 7;
        return {
          id: session.id,
          title: session.title,
          date: session.date,
          present,
          absent,
          quorum: quorum ? 'With Quorum' : 'Without Quorum',
        };
      }),
    []
  );

  const printReport = (title: string, type: string, period: string): boolean => {
    const generated = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
    const table =
      type === 'Attendance'
        ? `<table><thead><tr><th>Session</th><th>Date</th><th>Present</th><th>Absent</th><th>Quorum</th></tr></thead><tbody>${attendanceRows
            .map((row) => `<tr><td>${row.title}</td><td>${row.date}</td><td>${row.present}</td><td>${row.absent}</td><td>${row.quorum}</td></tr>`)
            .join('')}</tbody></table>`
        : `<table><thead><tr><th>Record No.</th><th>Title</th><th>Committee</th><th>Status</th><th>Date Filed</th></tr></thead><tbody>${mockBills
            .map((bill) => `<tr><td>${bill.number}</td><td>${bill.title}</td><td>${bill.committee ?? bill.author}</td><td>${bill.status}</td><td>${bill.dateFiled}</td></tr>`)
            .join('')}</tbody></table>`;
    return openPrintWindow(title, `<div class="title">${title}</div><div class="rows">Period: ${period} · Generated ${generated}</div>${table}`);
  };

  const handleGenerate = () => {
    const report = reports.find((item) => item.title === generateType);
    if (!report || !generatePeriod) {
      toast('Report not generated', 'Please choose a report type and period.', 'error');
      return;
    }
    if (!printReport(report.title, report.type, generatePeriod)) {
      toast('Report not generated', 'Your browser blocked the report window. Allow pop-ups for this site and try again.', 'error');
      return;
    }
    setGenerateOpen(false);
    toast('Report generated', `${report.title} (${generatePeriod}) opened for printing or saving as PDF.`);
    logActivity({ module: 'Reports', action: 'Exported', summary: `Generated the ${report.title} report`, detail: `${generatePeriod}, opened for printing.` });
  };

  const exportListing = () => {
    if (filteredListing.length === 0) {
      toast('Nothing to export', 'No records match the current filters.', 'error');
      return;
    }
    const saved = saveCsv(
      'sb-capas-legislation-listing.csv',
      ['Record No.', 'Title', 'Status', 'Category', 'Committee', 'Date Filed'],
      filteredListing.map((bill) => [bill.number, bill.title, bill.status, bill.category, bill.committee ?? bill.author, bill.dateFiled])
    );
    if (!saved) {
      toast('Export failed', 'The CSV file could not be created. Please try again.', 'error');
      return;
    }
    toast('Listing exported', `${filteredListing.length} record(s) saved as CSV.`);
    logActivity({ module: 'Reports', action: 'Exported', summary: 'Exported the legislation listing', detail: `${filteredListing.length} record(s) saved as CSV.` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">{selected.title}</h1>
          <p className="text-sm text-text-muted">{selected.description}</p>
        </div>
        <Button onClick={() => setGenerateOpen(true)}>
          <BarChart3 className="mr-2 h-4 w-4" />
          Generate New Report
        </Button>
      </div>

      {activeTab !== 'report-statistical-performance' && activeTab !== 'report-attendance-publication' ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-none shadow-sm bg-primary text-white">
            <CardContent className="p-6">
              <TrendingUp className="h-8 w-8 mb-4 opacity-50" />
              <div className="text-3xl font-bold">{statsSummary.approvalRate}%</div>
              <div className="text-xs opacity-70 uppercase tracking-wider font-semibold mt-1">Resolution Rate</div>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm bg-white">
            <CardContent className="p-6">
              <PieChart className="h-8 w-8 mb-4 text-secondary opacity-50" />
              <div className="text-3xl font-bold text-primary">{reports.length}</div>
              <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mt-1">Active Reports</div>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm bg-white">
            <CardContent className="p-6">
              <FileText className="h-8 w-8 mb-4 text-success opacity-50" />
              <div className="text-3xl font-bold text-primary">{mockBills.length}</div>
              <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mt-1">Records on File</div>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm bg-white">
            <CardContent className="p-6">
              <Users className="h-8 w-8 mb-4 text-warning opacity-50" />
              <div className="text-lg font-bold text-primary">{statsSummary.topAuthor}</div>
              <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mt-1">Most Active Committee</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === 'report-search-listing' || activeTab === 'reports' ? (
        <div className="bg-white rounded-lg border border-border p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-primary">Search and Listing</h3>
            <Button variant="outline" size="sm" onClick={exportListing}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Search by title, number, author"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              options={statusOptions}
              value={statusOptions.find((option) => option.value === statusFilter) ?? null}
              onChange={(option) => setStatusFilter(option?.value ?? 'All')}
              placeholder="Filter by status"
            />
            <Select
              options={categoryOptions}
              value={categoryOptions.find((option) => option.value === categoryFilter) ?? null}
              onChange={(option) => setCategoryFilter(option?.value ?? 'All')}
              placeholder="Filter by category"
            />
          </div>
          <div className={gridTableClassName}>
            <div className={gridTableHeaderClassName}>
              <div className="col-span-2">Bill No.</div>
              <div className="col-span-4">Title</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2">Author</div>
            </div>
            {filteredListing.map((bill) => (
              <div key={bill.id} className={gridTableRowClassName}>
                <div className="col-span-2">{bill.number}</div>
                <div className="col-span-4">{bill.title}</div>
                <div className="col-span-2">
                  <StatusBadge status={bill.status} />
                </div>
                <div className="col-span-2">{bill.category}</div>
                <div className="col-span-2">{bill.author}</div>
              </div>
            ))}
            {filteredListing.length === 0 && (
              <div className="px-4 py-4 text-sm text-text-muted">No records found for current filters.</div>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'report-statistical-performance' ? (
        <StatisticsView
          reports={reports}
          onDownload={(report) => {
            if (!printReport(report.title, report.type, report.date)) {
              toast('Report not opened', 'Your browser blocked the report window. Allow pop-ups for this site and try again.', 'error');
            }
          }}
        />
      ) : null}

      {activeTab === 'report-attendance-publication' ? (
        <AttendancePublicationView
          reports={reports}
          onDownload={(report) => {
            if (!printReport(report.title, report.type, report.date)) {
              toast('Report not opened', 'Your browser blocked the report window. Allow pop-ups for this site and try again.', 'error');
            }
          }}
        />
      ) : null}

      {(activeTab === 'report-search-listing' || activeTab === 'reports') && (
        <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-[#fafafa] font-semibold text-primary">
            Available Reports
          </div>
          <div className="divide-y divide-border">
            {reports.map((report) => (
              <div key={report.title} className="px-6 py-4 flex items-center justify-between hover:bg-muted/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-primary">{report.title}</div>
                    <div className="text-xs text-text-muted">{report.type} • {report.date}</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-primary font-semibold" onClick={() => {
                  if (!printReport(report.title, report.type, report.date)) {
                    toast('Report not opened', 'Your browser blocked the report window. Allow pop-ups for this site and try again.', 'error');
                  }
                }}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">Generate New Report</DialogTitle>
            <DialogDescription>The report opens in a printable page that you can print or save as PDF.</DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-3">
            <label className="block text-xs font-semibold text-text-muted">
              Report
              <select
                value={generateType}
                onChange={(e) => setGenerateType(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-normal text-text-main"
              >
                {reports.map((report) => (
                  <option key={report.title}>{report.title}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-text-muted">
              Period
              <select
                value={generatePeriod}
                onChange={(e) => setGeneratePeriod(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-normal text-text-main"
              >
                {['September 2026', 'Q3 2026', 'First Half 2026', 'FY 2026', 'FY 2025'].map((period) => (
                  <option key={period}>{period}</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setGenerateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate}>Generate</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
