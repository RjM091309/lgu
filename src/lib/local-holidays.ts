// Local holidays of the Province of Tarlac and the Municipality of Capas, which the national holiday
// API does not include. Update this list when a new proclamation or executive order is issued.
//
// Provincial holidays are set by law and fall on the same date every year. The Capas fiesta and
// Capas Day are declared each year by an executive order of the Municipal Mayor, so their dates
// below are the customary ones; add the year's actual order to DATED_LOCAL_HOLIDAYS once issued.

export type HolidayScope = 'national' | 'provincial' | 'municipal';

export interface LocalHolidayRule {
  /** Month and day, MM-DD. */
  monthDay: string;
  name: string;
  scope: Exclude<HolidayScope, 'national'>;
  basis: string;
}

export interface DatedLocalHoliday {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  name: string;
  scope: Exclude<HolidayScope, 'national'>;
  basis: string;
}

export const RECURRING_LOCAL_HOLIDAYS: LocalHolidayRule[] = [
  { monthDay: '05-28', name: 'Araw ng Lalawigang Tarlak (Tarlac Foundation Day)', scope: 'provincial', basis: 'Proclamation No. 109, s. 1999' },
  { monthDay: '06-10', name: 'Danding Cojuangco Day', scope: 'provincial', basis: 'Republic Act No. 11729' },
  { monthDay: '09-10', name: 'Capas Town Fiesta (Feast of San Nicolas de Tolentino)', scope: 'municipal', basis: 'Declared yearly by executive order of the Municipal Mayor' },
  { monthDay: '11-27', name: 'Ninoy Aquino Day (Tarlac)', scope: 'provincial', basis: 'Republic Act No. 8151' },
  { monthDay: '12-10', name: 'Capas Day (Founding Anniversary)', scope: 'municipal', basis: 'Declared yearly by executive order of the Municipal Mayor' },
];

// One-off days declared for a specific year, in addition to the recurring list.
// A dated entry on the same day as a recurring one replaces it for that year.
export const DATED_LOCAL_HOLIDAYS: DatedLocalHoliday[] = [
  { date: '2026-09-10', name: 'Capas Town Fiesta (Feast of San Nicolas de Tolentino)', scope: 'municipal', basis: 'Executive Order No. 37, s. 2026' },
  { date: '2026-09-11', name: 'Capas Town Fiesta (work and class suspension)', scope: 'municipal', basis: 'Executive Order No. 37, s. 2026' },
];

export const SCOPE_LABEL: Record<HolidayScope, string> = {
  national: 'National',
  provincial: 'Tarlac',
  municipal: 'Capas',
};
