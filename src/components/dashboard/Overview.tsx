import { useMemo, useState } from 'react';
import { FileText, Users, Calendar, CheckCircle2 } from 'lucide-react';
import { mockBills } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DataTable } from '@/components/ui/DataTable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const tableStatusBadgeBase =
  'h-6 min-h-6 inline-flex items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-0 text-[11px] font-medium leading-none uppercase tracking-wide';

function dashboardStatusBadgeClassName(status: string) {
  return cn(
    tableStatusBadgeBase,
    status === 'Enacted' || status === 'Passed'
      ? 'border-[#c8e6c9] bg-[#e8f5e9] text-[#2e7d32]'
      : status === 'Committee'
        ? 'border-[#ffe0b2] bg-[#fff3e0] text-[#ef6c00]'
        : 'border-[#bbdefb] bg-[#e3f2fd] text-[#1565c0]'
  );
}

export function Overview() {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(mockBills.length / pageSize));
  const paginatedBills = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return mockBills.slice(start, start + pageSize);
  }, [currentPage]);

  const stats = [
    { label: 'Legislative Tracking Records', value: '42', icon: FileText },
    { label: 'Master Listings Updated', value: '128', icon: Users },
    { label: 'Transactions Completed', value: '15', icon: CheckCircle2 },
    { label: 'Active Committee Routes', value: '09', icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-4 rounded-lg border border-border shadow-sm">
            <div className="text-[11px] uppercase text-text-muted tracking-wider font-semibold">{stat.label}</div>
            <div className="text-2xl font-bold mt-1 text-primary">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <div className="font-semibold text-base">Recent Legislative Actions</div>
          <div className="text-[12px] text-primary font-semibold cursor-pointer hover:underline">View All Actions →</div>
        </div>
        <DataTable
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={mockBills.length}
          currentCount={paginatedBills.length}
          onPreviousPage={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          onNextPage={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
        >
          <Table>
            <TableHeader className="bg-[#fafafa]">
              <TableRow className="border-border">
                <TableHead className="px-6 text-[12px] font-semibold text-text-muted">BILL NO.</TableHead>
                <TableHead className="px-6 text-[12px] font-semibold text-text-muted">TITLE</TableHead>
                <TableHead className="px-6 text-[12px] font-semibold text-text-muted">SPONSOR</TableHead>
                <TableHead className="px-6 text-[12px] font-semibold text-text-muted">DATE FILED</TableHead>
                <TableHead className="px-6 text-[12px] font-semibold text-text-muted">STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedBills.map((bill) => (
                <TableRow key={bill.id} className="hover:bg-muted/5 border-border transition-colors">
                  <TableCell className="px-6 py-3.5 text-[13px] font-mono text-text-muted">{bill.number}</TableCell>
                  <TableCell className="px-6 py-3.5 text-[13px] font-medium">{bill.title}</TableCell>
                  <TableCell className="px-6 py-3.5 text-[13px]">{bill.author}</TableCell>
                  <TableCell className="px-6 py-3.5 text-[13px]">{bill.dateFiled}</TableCell>
                  <TableCell className="px-6 py-3.5 text-[13px]">
                    <Badge
                      variant="outline"
                      className={dashboardStatusBadgeClassName(bill.status)}
                    >
                      {bill.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTable>
      </div>
    </div>
  );
}
