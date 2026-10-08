import { LGU_PROFILE, mockBills, type Session } from '@/lib/mock-data';
import { escapeHtml, openPrintWindow, saveFile } from '@/lib/files';

/**
 * Colour of each kind of session on the calendars (web and mobile). Dark enough for white text in both themes; the
 * orange and teal are fixed values because dark mode turns the stock -700 shades light (index.css).
 */
export const SESSION_TONE: Record<Session['type'], string> = {
  Regular: 'bg-primary text-white',
  'Committee Hearing': 'bg-violet-600 text-white',
  Special: 'bg-[#c2410c] text-white',
  Meeting: 'bg-[#0f766e] text-white',
};

/** Sessions and hearings are official proceedings of the body; meetings are not. */
export const isOfficial = (session: Pick<Session, 'type'>) => session.type !== 'Meeting';

export const formatLongDate = (iso: string, locale = 'en-PH') =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

export const buildAgenda = (session: Session) => {
  if (session.type === 'Meeting') return session.agenda?.length ? session.agenda : ['Open discussion'];
  if (session.type === 'Committee Hearing') {
    return [
      'Call to Order',
      'Opening Remarks of the Committee Chairperson',
      `Presentation of the Measure: ${session.title.replace('Public Hearing: ', '')}`,
      'Open Forum: Comments and Position Papers from Stakeholders',
      'Committee Deliberation',
      'Adjournment',
    ];
  }
  const opening = [
    'Call to Order',
    'Invocation and Singing of the Philippine National Anthem',
    'Roll Call and Declaration of Quorum',
  ];
  if (session.type === 'Special') {
    return [...opening, session.purpose || session.title, 'Adjournment'];
  }
  const firstReading = mockBills
    .filter((bill) => ['Draft', 'First Reading'].includes(bill.status))
    .map((bill) => `First Reading and Referral: ${bill.number} – ${bill.title}`);
  const unfinished = mockBills
    .filter((bill) => ['Second Reading', 'Third Reading'].includes(bill.status))
    .map((bill) => `Unfinished Business: ${bill.number} – ${bill.title}`);
  return [
    ...opening,
    'Reading and Approval of the Minutes of the Previous Session',
    ...firstReading,
    'Committee Reports',
    ...unfinished,
    'Other Matters',
    'Adjournment',
  ];
};

const sessionTimes = (session: Session) => {
  const [hourText, rest] = session.time.split(':');
  const [minutes, meridiem] = rest.split(' ');
  const hour = (Number(hourText) % 12) + (meridiem === 'PM' ? 12 : 0);
  const day = session.date.replace(/-/g, '');
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    start: `${day}T${pad(hour)}${minutes}00`,
    end: `${day}T${pad(Math.min(hour + 3, 23))}${minutes}00`,
  };
};

export const addSessionToCalendar = (session: Session) => {
  const { start, end } = sessionTimes(session);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LIMS//Session Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${session.id}@capas.gov.ph`,
    `DTSTART;TZID=Asia/Manila:${start}`,
    `DTEND;TZID=Asia/Manila:${end}`,
    `SUMMARY:${session.title} - ${LGU_PROFILE.legislature}`,
    `LOCATION:${session.location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  saveFile(`${session.title.replace(/[^A-Za-z0-9]+/g, '-')}.ics`, ics, 'text/calendar;charset=utf-8');
};

export const printAgenda = (session: Session) => {
  const items = buildAgenda(session)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  openPrintWindow(
    `${session.title} - Order of Business`,
    `
    <div class="title">${escapeHtml(session.title)}</div>
    <div class="rows">${formatLongDate(session.date)} · ${escapeHtml(session.time)} · ${escapeHtml(session.location)}</div>
    <h3>Order of Business</h3>
    <ol>${items}</ol>`
  );
};
