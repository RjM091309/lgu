import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/80', className)} aria-hidden />;
}

function CardShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-xl border border-border bg-white p-5 shadow-sm', className)}>{children}</div>;
}

function TableRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="hidden h-3.5 w-40 md:block" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// Placeholder shown while a page's content loads inside the app shell.
export function PageSkeleton({ variant = 'page' }: { variant?: 'dashboard' | 'page' }) {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2.5">
          {variant === 'dashboard' ? <Skeleton className="h-3.5 w-48" /> : null}
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {variant === 'dashboard' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <CardShell key={i}>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
                <Skeleton className="mt-5 h-8 w-16" />
                <Skeleton className="mt-5 h-9 w-full" />
              </CardShell>
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <CardShell className="xl:col-span-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="mt-2 h-3 w-72" />
              <Skeleton className="mt-6 h-56 w-full" />
            </CardShell>
            <CardShell>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-52" />
              <div className="mt-6 flex justify-center">
                <Skeleton className="h-40 w-40 rounded-full" />
              </div>
              <div className="mt-6 space-y-3">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            </CardShell>
          </div>
        </>
      ) : (
        <CardShell className="p-4">
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-72 max-w-full" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
        </CardShell>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <Skeleton className="h-4 w-52" />
        </div>
        <TableRowsSkeleton rows={variant === 'dashboard' ? 4 : 6} />
      </div>
    </div>
  );
}

// Placeholder for the public portal's first paint.
export function LandingSkeleton() {
  return (
    <div className="min-h-screen bg-white" role="status" aria-label="Loading">
      <div className="h-10 bg-[#0b1033]" />
      <div className="container mx-auto flex items-center justify-between gap-6 px-6 py-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2.5">
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-7 w-80 max-w-[60vw]" />
            <Skeleton className="h-3.5 w-44" />
          </div>
        </div>
        <Skeleton className="hidden h-11 w-96 md:block" />
      </div>
      <div className="h-12 bg-primary" />
      <div className="bg-gradient-to-br from-primary via-[#1c2a8f] to-[#0d1452]">
        <div className="container mx-auto grid gap-10 px-6 pb-28 pt-16 lg:grid-cols-[1.2fr_minmax(320px,400px)]">
          <div className="space-y-5">
            <div className="h-7 w-60 animate-pulse rounded-full bg-white/15" />
            <div className="h-12 w-full max-w-xl animate-pulse rounded-md bg-white/15" />
            <div className="h-12 w-4/5 max-w-lg animate-pulse rounded-md bg-white/15" />
            <div className="h-5 w-full max-w-2xl animate-pulse rounded-md bg-white/10" />
            <div className="flex gap-3 pt-3">
              <div className="h-12 w-48 animate-pulse rounded-md bg-white/20" />
              <div className="h-12 w-44 animate-pulse rounded-md bg-white/10" />
            </div>
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-white/15" />
        </div>
      </div>
      <div className="container mx-auto -mt-16 px-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xl md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-3 bg-white p-5">
              <Skeleton className="h-11 w-11 rounded-lg" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
