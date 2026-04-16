import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

              return (
                <button
                  key={iso}
                  type="button"
                  className={cn(
                    'h-8 rounded-md text-sm transition-colors',
                    isSelected ? 'bg-primary text-white' : 'hover:bg-muted'
                  )}
                  onClick={() => {
                    onChange(iso);
                    setIsOpen(false);
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
