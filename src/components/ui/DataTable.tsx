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
  labels?: Partial<typeof DEFAULT_LABELS>;
}

const DEFAULT_LABELS = {
  showing: (start: number, end: number, total: number) => `Showing ${start}-${end} of ${total}`,
  previous: 'Previous',
  next: 'Next',
  page: (current: number, total: number) => `Page ${current} / ${total}`,
};

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
  labels,
}: DataTableProps) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const start = (currentPage - 1) * pageSize + (currentCount > 0 ? 1 : 0);
  const end = (currentPage - 1) * pageSize + currentCount;

  return (
    <>
      <div className={tableWrapperClassName ?? "overflow-x-auto"}>{children}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-text-muted sm:px-6">
        <span>{text.showing(start, end, totalItems)}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onPreviousPage} disabled={currentPage === 1}>
            {text.previous}
          </Button>
          <span className="whitespace-nowrap px-1 sm:px-2">{text.page(currentPage, totalPages)}</span>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onNextPage} disabled={currentPage === totalPages}>
            {text.next}
          </Button>
        </div>
      </div>
    </>
  );
}
