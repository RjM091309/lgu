import * as React from "react";

import { cn } from "@/lib/utils";

// On phones, tables render as a stack of cards (see "table-cards" in index.css). Each cell is
// labelled with its column header through data-th, so the pages don't have to repeat the labels.
const headerLabel = (cell: Element) =>
  Array.from(cell.childNodes)
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean)
    .join(" ");

// A column whose header is empty or screen-reader-only holds row actions; its cell floats to the card's corner.
const isActionHeader = (th: HTMLTableCellElement, label: string) => {
  if (th.hasAttribute("data-action") || !label) return true;
  const srOnly = th.querySelector(".sr-only");
  return srOnly !== null && srOnly.textContent?.trim() === th.textContent?.trim();
};

function labelTableCells(table: HTMLTableElement) {
  const headRow = table.tHead?.rows[0];
  if (!headRow) return;
  const columns: { label: string; action: boolean }[] = [];
  for (const th of Array.from(headRow.cells)) {
    const label = headerLabel(th);
    const action = isActionHeader(th, label);
    for (let i = 0; i < th.colSpan; i++) columns.push({ label, action });
  }
  const rows = [...Array.from(table.tBodies).flatMap((body) => Array.from(body.rows)), ...Array.from(table.tFoot?.rows ?? [])];
  for (const row of rows) {
    let index = 0;
    for (const cell of Array.from(row.cells)) {
      const column = columns[index];
      cell.dataset.th = column?.label ?? "";
      cell.toggleAttribute("data-action", Boolean(column?.action) && cell.colSpan === 1);
      cell.toggleAttribute("data-full", cell.colSpan >= columns.length);
      index += cell.colSpan;
    }
  }
}

function labelGridCells(container: HTMLElement) {
  const head = container.querySelector(":scope > .grid-table-head");
  if (!head) return;
  const labels = Array.from(head.children).map(headerLabel);
  container.querySelectorAll<HTMLElement>(":scope > .grid-table-row").forEach((row) => {
    Array.from(row.children).forEach((cell, index) => {
      (cell as HTMLElement).dataset.th = labels[index] ?? "";
    });
  });
}

// Ref callbacks that label the cells now and again whenever rows change (filters, paging).
const observeLabels =
  <T extends HTMLElement>(label: (el: T) => void) =>
  (el: T | null) => {
    if (!el) return;
    label(el);
    const observer = new MutationObserver(() => label(el));
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  };

const tableCardsRef = observeLabels(labelTableCells);

/** Attach to a grid table's container (the element holding the header and rows) to get phone cards. */
const gridTableCardsRef = observeLabels(labelGridCells);

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Show rows as cards on phones. Turn off for matrices that only read as a grid. */
  mobileCards?: boolean;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(({ className, mobileCards = true, ...props }, ref) => {
  const setRef = React.useCallback(
    (node: HTMLTableElement | null) => {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
      const disconnect = mobileCards ? tableCardsRef(node) : undefined;
      return () => {
        disconnect?.();
        if (typeof ref === "function") ref(null);
        else if (ref) ref.current = null;
      };
    },
    [ref, mobileCards]
  );
  return <table ref={setRef} className={cn("relative w-full caption-bottom text-sm", mobileCards && "table-cards", className)} {...props} />;
});
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("bg-muted/40 [&_tr]:border-b", className)} {...props} />
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t border-border bg-muted/40 font-semibold [&>tr]:border-b-0", className)} {...props} />
  )
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn("border-b border-border transition-colors hover:bg-muted/30", className)} {...props} />
  )
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th ref={ref} className={cn("h-10 px-4 text-center align-middle text-xs font-bold uppercase text-text-main", className)} {...props} />
  )
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <td ref={ref} className={cn("px-4 py-2.5 text-center align-middle text-sm", className)} {...props} />
);
TableCell.displayName = "TableCell";

// Shared look for the div/grid-based tables (12-column grid), matching <Table> above.
// Put gridTableCardsRef on the container so the rows turn into cards on phones.
const gridTableClassName = "grid-table overflow-x-auto rounded-md border border-border";
const gridTableHeaderClassName =
  "grid-table-head grid min-w-[720px] grid-cols-12 items-center gap-x-4 bg-muted/40 px-4 py-2 text-center text-xs font-bold uppercase";
const gridTableRowClassName =
  "grid-table-row grid min-w-[720px] grid-cols-12 items-center gap-x-4 border-t border-border px-4 py-2.5 text-center text-sm";

export { gridTableClassName, gridTableHeaderClassName, gridTableRowClassName, gridTableCardsRef };
export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell };
