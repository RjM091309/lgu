import { LGU_PROFILE, mockBills, type Session } from '@/lib/mock-data';
import { openPrintWindow, saveFile } from '@/lib/files';

export const formatLongDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

export const buildAgenda = (session: Session) => {
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
    return [...opening, 'Consideration of the Proposed 2027 Annual Budget of the Municipality of Capas', 'Adjournment'];
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
    'PRODID:-//Sangguniang Bayan ng Capas//LMIS//EN',
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
    .map((item) => `<li>${item}</li>`)
    .join('');
  openPrintWindow(
    `${session.title} - Order of Business`,
    `
    <div class="title">${session.title}</div>
    <div class="rows">${formatLongDate(session.date)} · ${session.time} · ${session.location}</div>
    <h3>Order of Business</h3>
    <ol>${items}</ol>`
  );
};
