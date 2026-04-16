import { Button } from '@/components/ui/button';

interface DataTableProps {
  children: React.ReactNode;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  currentCount: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  tableWrapperClassName?: string;
}

export function DataTable({
  children,
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  currentCount,
  onPreviousPage,
  onNextPage,
  tableWrapperClassName,
}: DataTableProps) {
  const start = (currentPage - 1) * pageSize + (currentCount > 0 ? 1 : 0);
  const end = (currentPage - 1) * pageSize + currentCount;

  return (
    <>
      <div className={tableWrapperClassName ?? "overflow-x-auto"}>{children}</div>
      <div className="flex items-center justify-between border-t border-border px-6 py-3 text-xs text-text-muted">
        <span>
          Showing {start}-{end} of {totalItems}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onPreviousPage} disabled={currentPage === 1}>
            Previous
          </Button>
          <span className="px-2">Page {currentPage} / {totalPages}</span>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onNextPage} disabled={currentPage === totalPages}>
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
