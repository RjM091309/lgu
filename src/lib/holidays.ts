import { useEffect, useSyncExternalStore } from 'react';
import { DATED_LOCAL_HOLIDAYS, RECURRING_LOCAL_HOLIDAYS, type HolidayScope } from '@/lib/local-holidays';

// Philippine public holidays from the free Nager.Date API (no key, CORS enabled), plus the local
// holidays of Tarlac and Capas from local-holidays.ts. Each year is fetched once per page load and
// remembered in this browser; when the API is unreachable the 2026 list below keeps the calendars working.

export interface Holiday {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  name: string;
  localName: string;
  scope: HolidayScope;
  /** Legal basis, for local holidays. */
  basis?: string;
}

export type HolidaySource = 'loading' | 'live' | 'cached' | 'built-in' | 'unavailable';

interface YearState {
  holidays: Holiday[];
  source: HolidaySource;
}

const API_URL = (year: number) => `https://date.nager.at/api/v3/PublicHolidays/${year}/PH`;
const STORAGE_KEY = (year: number) => `sb-capas-holidays-${year}`;
const TIMEOUT_MS = 8000;

// Snapshot from Nager.Date, used only when the API cannot be reached.
const BUILT_IN: Record<number, Holiday[]> = {
  2026: [
    ['2026-01-01', "New Year's Day", 'Bagong Taon'],
    ['2026-02-17', 'Chinese New Year', 'Chinese New Year'],
    ['2026-04-02', 'Maundy Thursday', 'Huwebes Santo'],
    ['2026-04-03', 'Good Friday', 'Biyernes Santo'],
    ['2026-04-04', 'Holy Saturday', 'Sabado de Gloria'],
    ['2026-04-09', 'Day of Valor', 'Araw ng Kagitingan'],
    ['2026-05-01', 'Labour Day', 'Araw ng Paggawa'],
    ['2026-06-12', 'Independence Day', 'Araw ng Kalayaan'],
    ['2026-08-21', 'Ninoy Aquino Day', 'Araw ng Kamatayan ni Senador Benigno Simeon "Ninoy" Aquino Jr.'],
    ['2026-08-31', 'National Heroes Day', 'Araw ng mga Bayani'],
    ['2026-10-31', "All Saints' Day Eve", "All Saints' Day Eve"],
    ['2026-11-01', "All Saints' Day", 'Araw ng mga Santo'],
    ['2026-11-30', 'Bonifacio Day', 'Araw ni Gat Andres Bonifacio'],
    ['2026-12-08', 'Feast of the Immaculate Conception of Mary', 'Kapistahan ng Immaculada Concepcion'],
    ['2026-12-24', 'Christmas Eve', 'Christmas Eve'],
    ['2026-12-25', 'Christmas Day', 'Araw ng Pasko'],
    ['2026-12-30', 'Rizal Day', 'Araw ng Kamatayan ni Dr. Jose Rizal'],
    ['2026-12-31', 'Last Day of the Year', 'Huling Araw ng Taon'],
  ].map(([date, name, localName]) => ({ date, name, localName, scope: 'national' as const })),
};

let state: Record<number, YearState> = {};
const requested = new Set<number>();
const listeners = new Set<() => void>();

const setYear = (year: number, next: YearState) => {
  state = { ...state, [year]: next };
  listeners.forEach((listener) => listener());
};

const readStored = (year: number): Holiday[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(year));
    const parsed = raw ? JSON.parse(raw) : null;
    // Saved copies are national holidays; older copies predate the scope field.
    return Array.isArray(parsed) ? parsed.map((holiday: Holiday) => ({ ...holiday, scope: 'national' as const })) : null;
  } catch {
    return null;
  }
};

const fallback = (year: number): YearState => {
  const stored = readStored(year);
  if (stored) return { holidays: stored, source: 'cached' };
  if (BUILT_IN[year]) return { holidays: BUILT_IN[year], source: 'built-in' };
  return { holidays: [], source: 'unavailable' };
};

async function loadYear(year: number) {
  if (requested.has(year)) return;
  requested.add(year);
  // Show what we already have while the live list loads.
  const initial = fallback(year);
  setYear(year, { ...initial, source: initial.holidays.length ? initial.source : 'loading' });
  try {
    const response = await fetch(API_URL(year), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as { date: string; name: string; localName: string }[];
    const holidays = data.map(({ date, name, localName }) => ({ date, name, localName, scope: 'national' as const }));
    try {
      localStorage.setItem(STORAGE_KEY(year), JSON.stringify(holidays));
    } catch {
      // Storage unavailable: the list is fetched again next visit.
    }
    setYear(year, { holidays, source: 'live' });
  } catch {
    setYear(year, fallback(year));
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const EMPTY: YearState = { holidays: [], source: 'loading' };

const localHolidays = (year: number): Holiday[] => {
  const dated = DATED_LOCAL_HOLIDAYS.filter((holiday) => holiday.date.startsWith(`${year}-`));
  const recurring = RECURRING_LOCAL_HOLIDAYS.map((rule) => ({ ...rule, date: `${year}-${rule.monthDay}` })).filter(
    (holiday) => !dated.some((entry) => entry.date === holiday.date)
  );
  return [...recurring, ...dated].map(({ date, name, scope, basis }) => ({ date, name, localName: name, scope, basis }));
};

/** National and local holidays for one year, sorted by date; national ones are fetched on first use. */
export function useHolidays(year: number): YearState & { byDate: Map<string, Holiday> } {
  useEffect(() => {
    void loadYear(year);
  }, [year]);
  const yearState = useSyncExternalStore(subscribe, () => state[year] ?? EMPTY);
  const holidays = [...yearState.holidays, ...localHolidays(year)].sort((a, b) => a.date.localeCompare(b.date));
  // Two holidays on one day show as one entry with both names; national takes the lead.
  const byDate = new Map<string, Holiday>();
  for (const holiday of holidays) {
    const existing = byDate.get(holiday.date);
    byDate.set(holiday.date, existing ? { ...existing, name: `${existing.name} / ${holiday.name}` } : holiday);
  }
  return { ...yearState, holidays, byDate };
}

/** Calendar colors: national holidays in red, Tarlac and Capas holidays in amber. */
export const holidayTone = (holiday: Holiday) =>
  holiday.scope === 'national'
    ? { cell: 'bg-red-50 font-semibold text-red-700', dot: 'bg-red-500', text: 'text-red-700', ring: 'ring-red-500' }
    : { cell: 'bg-amber-50 font-semibold text-amber-800', dot: 'bg-amber-500', text: 'text-amber-800', ring: 'ring-amber-500' };

export const holidayTitle = (holiday: Holiday) => `Holiday: ${holiday.name}${holiday.basis ? ` (${holiday.basis})` : ''}`;

export const HOLIDAY_SOURCE_LABEL: Record<HolidaySource, string> = {
  loading: 'Loading holidays…',
  live: 'Philippine holidays from Nager.Date',
  cached: 'Philippine holidays (saved copy, offline)',
  'built-in': 'Philippine holidays (built-in list, offline)',
  unavailable: 'Holidays unavailable offline',
};
