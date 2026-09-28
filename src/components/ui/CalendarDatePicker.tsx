import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { holidayTitle, holidayTone, useHolidays } from '@/lib/holidays';
import { SCOPE_LABEL } from '@/lib/local-holidays';

type CalendarDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function formatForTrigger(value: string): string {
  const parsed = parseIsoDate(value);
  if (!parsed) return 'Select date';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

export function CalendarDatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  className,
}: CalendarDatePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedDate = parseIsoDate(value);
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(selectedDate ?? new Date());

  useEffect(() => {
    if (selectedDate) {
      setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-PH', {
        month: 'long',
        year: 'numeric',
      }).format(viewDate),
    [viewDate]
  );

  const dayCells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<number | null> = [];

    for (let i = 0; i < firstDayOfMonth; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
    while (cells.length < 42) cells.push(null);

    return cells;
  }, [viewDate]);

  const selectedIso = selectedDate ? toIsoDate(selectedDate) : '';
  const { byDate: holidaysByDate, holidays } = useHolidays(viewDate.getFullYear());
  const viewMonthPrefix = toIsoDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)).slice(0, 7);
  const monthHolidays = holidays.filter((holiday) => holiday.date.startsWith(viewMonthPrefix));

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm',
          'ring-offset-background focus-visible:outline-none focus-visible:border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/15'
        )}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className={cn(selectedDate ? 'text-foreground' : 'text-text-muted')}>
          {selectedDate ? formatForTrigger(value) : placeholder}
        </span>
        <CalendarDays className="h-4 w-4 text-text-muted" />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-[280px] rounded-md border border-border bg-white p-3 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-semibold text-text-main">{monthLabel}</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 pb-1">
            {weekDays.map((dayName) => (
              <span key={dayName} className="text-center text-[11px] font-semibold text-text-muted">
                {dayName}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {dayCells.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="h-8 w-full" />;
              }

              const candidate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
              const iso = toIsoDate(candidate);
              const isSelected = iso === selectedIso;
              const holiday = holidaysByDate.get(iso);

              return (
                <button
                  key={iso}
                  type="button"
                  title={holiday ? holidayTitle(holiday) : undefined}
                  aria-label={holiday ? `${day}, holiday: ${holiday.name}` : undefined}
                  className={cn(
                    'relative h-8 rounded-md text-sm transition-colors',
                    isSelected ? 'bg-primary text-white' : holiday ? cn(holidayTone(holiday).cell, 'hover:brightness-95') : 'hover:bg-muted'
                  )}
                  onClick={() => {
                    onChange(iso);
                    setIsOpen(false);
                  }}
                >
                  {day}
                  {holiday && !isSelected ? (
                    <span className={cn('absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full', holidayTone(holiday).dot)} aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>

          {monthHolidays.length ? (
            <ul className="mt-3 space-y-1 border-t border-border pt-2.5">
              {monthHolidays.map((holiday) => (
                <li key={`${holiday.date}-${holiday.name}`} className="flex gap-2 text-[11px]" title={holiday.basis}>
                  <span className={cn('w-6 shrink-0 text-right font-semibold tabular-nums', holidayTone(holiday).text)}>{Number(holiday.date.slice(8, 10))}</span>
                  <span className="min-w-0 flex-1 text-text-muted">{holiday.name}</span>
                  {holiday.scope !== 'national' ? (
                    <span className="h-fit shrink-0 rounded bg-amber-50 px-1 text-[9px] font-semibold uppercase text-amber-800">{SCOPE_LABEL[holiday.scope]}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
