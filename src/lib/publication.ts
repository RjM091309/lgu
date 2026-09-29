import type { PublicationRecord } from '@/lib/mock-data';

// Posting rules for approved ordinances, shared by the Legislative Tracking "Enacted" tab and the
// Attendance & Publication report: post within 5 days of approval; effective 10 days after posting.
export const POSTING_DEADLINE_DAYS = 5;
export const EFFECTIVITY_DAYS = 10;

const DAY = 86_400_000;
const toDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const addDays = (iso: string, days: number) => new Date(toDay(iso) + days * DAY).toISOString().slice(0, 10);

export type PublicationStatus = 'Effective' | 'Awaiting effectivity' | 'For posting' | 'Posting overdue';

export const PUBLICATION_TONE: Record<PublicationStatus, string> = {
  Effective: 'border-green-200 bg-green-50 text-green-800',
  'Awaiting effectivity': 'border-blue-200 bg-blue-50 text-blue-800',
  'For posting': 'border-amber-200 bg-amber-50 text-amber-800',
  'Posting overdue': 'border-red-200 bg-red-50 text-red-800',
};

export function publicationStatus(record: Pick<PublicationRecord, 'approvedOn' | 'postedOn'>, today: string): PublicationStatus {
  if (!record.postedOn) return today > addDays(record.approvedOn, POSTING_DEADLINE_DAYS) ? 'Posting overdue' : 'For posting';
  return today >= addDays(record.postedOn, EFFECTIVITY_DAYS) ? 'Effective' : 'Awaiting effectivity';
}
