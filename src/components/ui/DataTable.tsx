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
  /** Optional translator for the pagination text; English when omitted. */
  translate?: (text: string, vars?: Record<string, string | number>) => string;
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
  translate,
}: DataTableProps) {
  const start = (currentPage - 1) * pageSize + (currentCount > 0 ? 1 : 0);
  const end = (currentPage - 1) * pageSize + currentCount;
  const t = (text: string, vars?: Record<string, string | number>) =>
    translate ? translate(text, vars) : vars ? Object.entries(vars).reduce((out, [key, value]) => out.split(`{${key}}`).join(String(value)), text) : text;

  return (
    <>
      <div className={tableWrapperClassName ?? "overflow-x-auto"}>{children}</div>
      <div className="flex items-center justify-between border-t border-border px-6 py-3 text-xs text-text-muted">
        <span>{t('Showing {start}-{end} of {total}', { start, end, total: totalItems })}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onPreviousPage} disabled={currentPage === 1}>
            {t('Previous')}
          </Button>
          <span className="px-2">{t('Page {page} / {pages}', { page: currentPage, pages: totalPages })}</span>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onNextPage} disabled={currentPage === totalPages}>
            {t('Next')}
          </Button>
        </div>
      </div>
    </>
  );
}
