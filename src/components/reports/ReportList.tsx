import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { mockBills, mockSessions } from '@/lib/mock-data';
import { BarChart3, TrendingUp, PieChart, FileText, Download, Users } from 'lucide-react';
import { motion } from 'motion/react';

interface ReportListProps {
  activeTab: string;
}

function SimpleBarChart({
  title,
  data,
  colorClass = 'bg-primary',
}: {
  title: string;
  data: { label: string; value: number }[];
  colorClass?: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <Card className="border border-border shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{item.label}</span>
              <span className="font-semibold text-text-main">{item.value}</span>
            </div>
            <div className="h-2 w-full rounded bg-muted overflow-hidden">
              <motion.div
                className={`h-full ${colorClass}`}
                initial={{ width: 0 }}
                animate={{ width: `${(item.value / max) * 100}%` }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SimpleDonutChart({
  title,
  value,
  total,
}: {
  title: string;
  value: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  const dash = `${percent} ${100 - percent}`;

  return (
    <Card className="border border-border shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div className="relative h-20 w-20">
          <svg viewBox="0 0 36 36" className="h-20 w-20">
            <path
              d="M18 2.5a15.5 15.5 0 1 1 0 31a15.5 15.5 0 1 1 0-31"
              fill="none"
              stroke="rgba(148,163,184,0.25)"
              strokeWidth="4"
            />
            <motion.path
              d="M18 2.5a15.5 15.5 0 1 1 0 31a15.5 15.5 0 1 1 0-31"
              fill="none"
              stroke="rgb(27,36,142)"
              strokeWidth="4"
              initial={{ strokeDasharray: '0 100' }}
              animate={{ strokeDasharray: dash }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              strokeLinecap="round"
              transform="rotate(-90 18 18)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">
            {percent}%
          </div>
        </div>
        <div className="text-sm text-text-muted">
          <div>
            Value: <span className="font-semibold text-text-main">{value}</span>
          </div>
          <div>
            Total: <span className="font-semibold text-text-main">{total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const reportContentMap: Record<string, { title: string; description: string; items: { title: string; type: string; date: string }[] }> = {
  reports: {
    title: 'Search and Listing Reports',
    description: 'Generate and export filtered listings of resolutions, ordinances, and transactions.',
    items: [
      { title: 'Approved/Unapproved Legislation by Keyword', type: 'Listing', date: 'April 2024' },
      { title: 'Authorship and Sponsorship Report', type: 'Listing', date: 'Q1 2024' },
      { title: 'Committee Referral and Status Report', type: 'Search', date: 'FY 2024' },
      { title: 'Incoming Documents and Transmittals Listing', type: 'Search', date: 'March 2024' },
    ],
  },
  'report-search-listing': {
    title: 'Search and Listing Reports',
    description: 'Generate and export filtered listings of resolutions, ordinances, and transactions.',
    items: [
      { title: 'Approved/Unapproved Legislation by Keyword', type: 'Listing', date: 'April 2024' },
      { title: 'Authorship and Sponsorship Report', type: 'Listing', date: 'Q1 2024' },
      { title: 'Committee Referral and Status Report', type: 'Search', date: 'FY 2024' },
      { title: 'Incoming Documents and Transmittals Listing', type: 'Search', date: 'March 2024' },
    ],
  },
  'report-statistical-performance': {
    title: 'Statistical and Performance Reports',
    description: 'View yearly totals, committee productivity, and performance indicators.',
    items: [
      { title: 'Total Approved Resolutions/Ordinances per Year', type: 'Statistical', date: '2024 Annual' },
      { title: 'Committee Performance Summary', type: 'Performance', date: 'Q1 2024' },
      { title: 'Member Authorship Productivity', type: 'Performance', date: 'April 2024' },
      { title: 'Incoming Documents by Origin/Referral', type: 'Statistical', date: 'FY 2024' },
    ],
  },
  'report-attendance-publication': {
    title: 'Attendance and Publication Reports',
    description: 'Track session attendance, quorum status, and publication-related outputs.',
    items: [
      { title: 'Session Attendance with Quorum', type: 'Attendance', date: 'April 2024' },
      { title: 'Session Attendance without Quorum', type: 'Attendance', date: 'Q1 2024' },
      { title: 'Second Reading Publication by Posting', type: 'Publication', date: 'FY 2024' },
      { title: 'Ordinances with Penal Clause Publication Status', type: 'Publication', date: 'March 2024' },
    ],
  },
};

export function ReportList({ activeTab }: ReportListProps) {
  const selected = reportContentMap[activeTab] ?? reportContentMap['report-search-listing'];
  const reports = selected.items;
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

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

  const publicationRows = useMemo(
    () =>
      mockBills
        .filter((bill) => ['Second Reading', 'Third Reading', 'Passed', 'Enacted'].includes(bill.status))
        .map((bill) => ({
          number: bill.number,
          title: bill.title,
          publicationStatus: ['Passed', 'Enacted'].includes(bill.status) ? 'Published' : 'For Posting',
          penalClause: bill.category === 'Health' || bill.category === 'Infrastructure' ? 'Yes' : 'No',
        })),
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">{selected.title}</h1>
          <p className="text-sm text-text-muted">{selected.description}</p>
        </div>
        <Button className="bg-primary hover:bg-primary-light">
          <BarChart3 className="mr-2 h-4 w-4" />
          Generate New Report
        </Button>
      </div>

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
            <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mt-1">Total Pages</div>
          </CardContent>
        </Card>
        <Card className="border border-border shadow-sm bg-white">
          <CardContent className="p-6">
            <Users className="h-8 w-8 mb-4 text-warning opacity-50" />
            <div className="text-lg font-bold text-primary">{statsSummary.topAuthor}</div>
            <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mt-1">Top Author</div>
          </CardContent>
        </Card>
      </div>

      {activeTab === 'report-search-listing' || activeTab === 'reports' ? (
        <div className="bg-white rounded-lg border border-border p-4 md:p-6 space-y-4">
          <h3 className="font-bold text-primary">Search and Listing Process (Mock)</h3>
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
          <div className="border border-border rounded-md overflow-hidden">
            <div className="grid grid-cols-12 bg-muted/40 px-4 py-2 text-xs font-bold uppercase">
              <div className="col-span-2">Bill No.</div>
              <div className="col-span-4">Title</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2">Author</div>
            </div>
            {filteredListing.map((bill) => (
              <div key={bill.id} className="grid grid-cols-12 border-t border-border px-4 py-2 text-sm">
                <div className="col-span-2">{bill.number}</div>
                <div className="col-span-4">{bill.title}</div>
                <div className="col-span-2">{bill.status}</div>
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
        <div className="bg-white rounded-lg border border-border p-4 md:p-6 space-y-4">
          <h3 className="font-bold text-primary">Statistical and Performance Process (Mock)</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <SimpleBarChart
              title="By Author"
              data={Object.entries(statsSummary.byAuthor).map(([label, value]) => ({ label, value }))}
            />
            <SimpleBarChart
              title="By Category"
              data={Object.entries(statsSummary.byCategory).map(([label, value]) => ({ label, value }))}
              colorClass="bg-secondary"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SimpleDonutChart title="Approval Ratio" value={statsSummary.approvedCount} total={mockBills.length} />
            <SimpleBarChart
              title="Session Types"
              data={Array.from(
                mockSessions.reduce<Record<string, number>>((acc, session) => {
                  acc[session.type] = (acc[session.type] ?? 0) + 1;
                  return acc;
                }, {})
              ).map(([label, value]) => ({ label, value }))}
              colorClass="bg-success"
            />
          </div>
        </div>
      ) : null}

      {activeTab === 'report-attendance-publication' ? (
        <div className="bg-white rounded-lg border border-border p-4 md:p-6 space-y-5">
          <h3 className="font-bold text-primary">Attendance and Publication Process (Mock)</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <SimpleBarChart
              title="Present vs Absent"
              data={[
                {
                  label: 'Present',
                  value: attendanceRows.reduce((sum, row) => sum + row.present, 0),
                },
                {
                  label: 'Absent',
                  value: attendanceRows.reduce((sum, row) => sum + row.absent, 0),
                },
              ]}
              colorClass="bg-warning"
            />
            <SimpleDonutChart
              title="Published Documents"
              value={publicationRows.filter((row) => row.publicationStatus === 'Published').length}
              total={publicationRows.length}
            />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Attendance with/without Quorum</h4>
            <div className="border border-border rounded-md overflow-hidden">
              <div className="grid grid-cols-12 bg-muted/40 px-4 py-2 text-xs font-bold uppercase">
                <div className="col-span-2">Session</div>
                <div className="col-span-4">Title</div>
                <div className="col-span-2">Present</div>
                <div className="col-span-2">Absent</div>
                <div className="col-span-2">Quorum</div>
              </div>
              {attendanceRows.map((row) => (
                <div key={row.id} className="grid grid-cols-12 border-t border-border px-4 py-2 text-sm">
                  <div className="col-span-2">{row.id.toUpperCase()}</div>
                  <div className="col-span-4">{row.title}</div>
                  <div className="col-span-2">{row.present}</div>
                  <div className="col-span-2">{row.absent}</div>
                  <div className="col-span-2">{row.quorum}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Publication by Posting / Penal Clause</h4>
            <div className="border border-border rounded-md overflow-hidden">
              <div className="grid grid-cols-12 bg-muted/40 px-4 py-2 text-xs font-bold uppercase">
                <div className="col-span-2">Bill No.</div>
                <div className="col-span-5">Title</div>
                <div className="col-span-3">Publication</div>
                <div className="col-span-2">Penal Clause</div>
              </div>
              {publicationRows.map((row) => (
                <div key={row.number} className="grid grid-cols-12 border-t border-border px-4 py-2 text-sm">
                  <div className="col-span-2">{row.number}</div>
                  <div className="col-span-5">{row.title}</div>
                  <div className="col-span-3">{row.publicationStatus}</div>
                  <div className="col-span-2">{row.penalClause}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
                <Button variant="ghost" size="sm" className="text-primary font-semibold">
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
