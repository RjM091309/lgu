import { useState } from 'react';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { todayInManila } from '@/lib/session-files';
import { SESSION_TONE } from '@/lib/sessions';
import { holidayTone, useHolidays } from '@/lib/holidays';
import { SessionCard, useMySessions } from '@/components/mobile/mobile-sessions';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const shiftMonth = (month: string, by: number) => {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** Month view of the account's sessions and the holidays, with the chosen day's sessions below. */
export function MobileCalendar() {
  const today = todayInManila();
  const mine = useMySessions();
  const firstUpcoming = mine.find((entry) => entry.session.date >= today);
  const [month, setMonth] = useState((firstUpcoming?.session.date ?? today).slice(0, 7));
  const [selected, setSelected] = useState(firstUpcoming?.session.date ?? today);

  const [year, monthNumber] = month.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthLabel = new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const { byDate: holidaysByDate } = useHolidays(year);

  const daySessions = mine.filter((entry) => entry.session.date === selected);
  const selectedHoliday = holidaysByDate.get(selected);
  const changeMonth = (by: number) => {
    const next = shiftMonth(month, by);
    setMonth(next);
    setSelected(mine.find((entry) => entry.session.date.startsWith(next))?.session.date ?? `${next}-01`);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-border">
        <div className="mb-2 flex items-center justify-between px-1">
          <button type="button" onClick={() => changeMonth(-1)} className="rounded-full p-2 text-primary active:bg-muted" aria-label="Previous month">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold text-text-main">{monthLabel}</h1>
          <button type="button" onClick={() => changeMonth(1)} className="rounded-full p-2 text-primary active:bg-muted" aria-label="Next month">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-text-muted">
          {WEEKDAYS.map((day, i) => (
            <span key={i} className="py-1">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: firstWeekday }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const iso = `${month}-${String(i + 1).padStart(2, '0')}`;
            const sessions = mine.filter((entry) => entry.session.date === iso);
            const holiday = holidaysByDate.get(iso);
            const isSelected = iso === selected;
            const needsReply = sessions.some((entry) => entry.invited && entry.status === 'none');
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                aria-pressed={isSelected}
                aria-label={`${iso}${sessions.length ? `, ${sessions.length} session(s)` : ''}${holiday ? `, ${holiday.name}` : ''}`}
                className="flex flex-col items-center gap-0.5 py-0.5"
              >
                <span
                  className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-full text-sm tabular-nums',
                    isSelected ? 'bg-primary font-bold text-white' : iso === today ? 'font-bold text-primary ring-1 ring-primary' : holiday ? cn('font-semibold', holidayTone(holiday).text) : 'text-text-main',
                    holiday && !isSelected && (holiday.scope === 'national' ? 'bg-red-50' : 'bg-amber-50')
                  )}
                >
                  {i + 1}
                  {needsReply ? <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-600 ring-2 ring-white" aria-hidden /> : null}
                </span>
                <span className="flex h-1.5 gap-0.5">
                  {sessions.slice(0, 3).map((entry) => (
                    <span key={entry.session.id} className={cn('h-1.5 w-1.5 rounded-full', SESSION_TONE[entry.session.type].split(' ')[0])} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 border-t border-border pt-2.5 text-[10px] text-text-muted">
          {(['Regular', 'Committee Hearing', 'Special'] as const).map((type) => (
            <span key={type} className="inline-flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', SESSION_TONE[type].split(' ')[0])} />
              {type === 'Committee Hearing' ? 'Hearing' : type}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-600 ring-1 ring-white" />
            Reply needed
          </span>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">
          {new Date(`${selected}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
        </h2>
        {selectedHoliday ? (
          <p className={cn('mb-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium', selectedHoliday.scope === 'national' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800')}>
            <Flag className="h-3.5 w-3.5 shrink-0" />
            {selectedHoliday.name}
          </p>
        ) : null}
        {daySessions.length ? (
          <div className="space-y-2">
            {daySessions.map((entry) => (
              <SessionCard key={entry.session.id} entry={entry} muted={entry.session.date < today} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-white px-4 py-6 text-center text-xs text-text-muted">No sessions on this day.</p>
        )}
      </section>
    </div>
  );
}
