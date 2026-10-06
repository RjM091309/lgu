import { LGU_PROFILE } from '@/lib/mock-data';
import { createPdf, type PdfLine } from '@/lib/pdf';
import { saveCsv } from '@/lib/files';
import { formatLongDate } from '@/lib/sessions';
import { addSessionFiles, todayInManila } from '@/lib/session-files';
import type { MobileAccount } from '@/lib/mobile-accounts';
import {
  ROLE_LABEL,
  clockTime,
  clockTimeWithSeconds,
  dateTime,
  durationText,
  timeInRoom,
  type AuditEvent,
  type AuditType,
  type RoomAudit,
} from '@/lib/esession-room';

// The e-session's record: its audit trail in plain language, the attendance record (PDF, saved to the
// session's folder in Session Files), and a CSV of everything for the Secretariat's own files.

export type EventGroup = 'attendance' | 'moderation' | 'floor' | 'recording' | 'chat';

export const EVENT_GROUP: Record<AuditType, EventGroup> = {
  started: 'moderation',
  ended: 'moderation',
  'join-request': 'attendance',
  admitted: 'attendance',
  denied: 'attendance',
  joined: 'attendance',
  left: 'attendance',
  'left-waiting': 'attendance',
  reconnected: 'attendance',
  removed: 'moderation',
  muted: 'moderation',
  'muted-all': 'moderation',
  locked: 'moderation',
  unlocked: 'moderation',
  'auto-admit-on': 'moderation',
  'auto-admit-off': 'moderation',
  'hand-raised': 'floor',
  'hand-lowered': 'floor',
  'floor-granted': 'floor',
  'floor-cleared': 'floor',
  agenda: 'floor',
  'roll-call': 'floor',
  chat: 'chat',
  'screen-started': 'moderation',
  'screen-stopped': 'moderation',
  'recording-started': 'recording',
  'recording-stopped': 'recording',
  'recording-saved': 'recording',
};

export const EVENT_GROUP_LABEL: Record<EventGroup, string> = {
  attendance: 'Attendance',
  moderation: 'Moderation',
  floor: 'Floor & agenda',
  recording: 'Recording',
  chat: 'Chat',
};

/** One line of the audit trail, e.g. `SB Secretary admitted Municipal Councilor (3rd)`. */
export const eventText = (event: AuditEvent) => {
  const actor = event.actor?.name ?? 'The system';
  const target = event.target?.name ?? 'a participant';
  switch (event.type) {
    case 'started':
      return `${actor} started the e-session`;
    case 'ended':
      return event.actor ? `${actor} ended the e-session` : 'The e-session ended';
    case 'join-request':
      return `${actor} asked to join`;
    case 'admitted':
      return `${actor} admitted ${target}`;
    case 'denied':
      return `${actor} did not admit ${target}`;
    case 'joined':
      return `${actor} joined`;
    case 'left':
      return `${actor} left`;
    case 'left-waiting':
      return `${actor} left the waiting room`;
    case 'reconnected':
      return `${actor} reconnected`;
    case 'removed':
      return `${actor} removed ${target} from the e-session`;
    case 'muted':
      return `${actor} muted ${target}`;
    case 'muted-all':
      return `${actor} muted everyone`;
    case 'locked':
      return `${actor} locked the e-session`;
    case 'unlocked':
      return `${actor} unlocked the e-session`;
    case 'auto-admit-on':
      return `${actor} turned on automatic admission of invitees`;
    case 'auto-admit-off':
      return `${actor} turned off automatic admission`;
    case 'hand-raised':
      return `${actor} asked for the floor`;
    case 'hand-lowered':
      return `${actor} withdrew the request for the floor`;
    case 'floor-granted':
      return `${actor} gave the floor to ${target}`;
    case 'floor-cleared':
      return event.actor ? `${actor} closed the floor` : `The floor was closed`;
    case 'agenda':
      return `${actor} took up an item of business`;
    case 'roll-call':
      return `${actor} called the roll`;
    case 'chat':
      return `${actor} sent a message`;
    case 'screen-started':
      return `${actor} started sharing their screen`;
    case 'screen-stopped':
      return `${actor} stopped sharing their screen`;
    case 'recording-started':
      return `${actor} started recording`;
    case 'recording-stopped':
      return `${actor} stopped recording`;
    case 'recording-saved':
      return `${actor} saved the recording to Session Files`;
    default:
      return actor;
  }
};

const fileStamp = (ms: number) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms))
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}${parts.minute}`;
};

const safeName = (text: string) => text.replace(/[\\/:*?"<>|]+/g, '-');

export const recordingFileName = (title: string, startedAt: number, extension: string) => safeName(`${title} - E-Session Audio ${fileStamp(startedAt)}.${extension}`);

const attendanceRows = (audit: RoomAudit, now: number) =>
  [...audit.attendance]
    .sort((a, b) => Number(a.group !== 'member') - Number(b.group !== 'member') || (a.stints[0]?.joinedAt ?? 0) - (b.stints[0]?.joinedAt ?? 0))
    .map((entry) => ({
      entry,
      firstIn: entry.stints[0]?.joinedAt ?? null,
      lastOut: entry.stints.at(-1)?.leftAt ?? null,
      total: timeInRoom(entry, now),
    }));

export const attendanceRecordPdf = (audit: RoomAudit) => {
  const { room } = audit;
  const end = room.endedAt ?? Date.now();
  const rows = attendanceRows(audit, end);
  const members = rows.filter((row) => row.entry.group === 'member');
  const staff = rows.filter((row) => row.entry.group === 'staff');
  const line = (row: (typeof rows)[number]) =>
    `${row.entry.name} (${row.entry.detail || ROLE_LABEL[row.entry.role]}) - in ${row.firstIn ? clockTime(row.firstIn) : '-'}, out ${row.lastOut ? clockTime(row.lastOut) : 'still in'}, ${durationText(row.total)}${row.entry.stints.length > 1 ? `, joined ${row.entry.stints.length} times` : ''}`;

  const lines: PdfLine[] = [
    { text: `Republic of the Philippines - Province of ${LGU_PROFILE.province}`, size: 9 },
    { text: LGU_PROFILE.legislature.toUpperCase(), size: 15, bold: true },
    { text: LGU_PROFILE.address, size: 9 },
    { text: 'E-SESSION ATTENDANCE RECORD', size: 13, bold: true, spaceBefore: 18 },
    { text: room.title, size: 12, bold: true },
    { text: `${formatLongDate(room.date)} - scheduled ${room.time} - ${room.type}`, size: 10 },
    { text: `Held online (LIMS E-Session). Started ${dateTime(room.startedAt)} by ${room.startedBy.name}; ${room.endedAt ? `ended ${dateTime(room.endedAt)}${room.endedBy ? ` by ${room.endedBy.name}` : ''}` : 'still in progress'}. Duration: ${durationText(end - room.startedAt)}.`, size: 10 },
    { text: `Members present: ${members.length} of ${audit.memberTotal} (quorum: ${audit.quorum})`, size: 11, bold: true, spaceBefore: 14 },
    ...members.map((row) => ({ text: line(row), size: 10, spaceBefore: 3 })),
    ...(staff.length ? [{ text: 'Secretariat and staff', size: 11, bold: true, spaceBefore: 12 }, ...staff.map((row) => ({ text: line(row), size: 10, spaceBefore: 3 }))] : []),
  ];
  if (audit.rollCalls.length) {
    lines.push({ text: 'Roll calls', size: 11, bold: true, spaceBefore: 12 });
    audit.rollCalls.forEach((call) =>
      lines.push({
        text: `${clockTime(call.at)} - ${call.presentCount} of ${call.memberTotal} members present, ${call.hasQuorum ? 'quorum declared' : 'no quorum'} (called by ${call.by.name}): ${call.present.map((p) => p.name).join(', ') || 'none'}`,
        size: 10,
        spaceBefore: 3,
      })
    );
  }
  lines.push({ text: 'Times are Philippine Standard Time, as recorded by the LIMS server.', size: 9, spaceBefore: 18 });
  return createPdf(lines, 'SB CAPAS - E-SESSION RECORD');
};

export const attendanceRecordName = (audit: RoomAudit) => safeName(`${audit.room.title} - E-Session Attendance Record ${fileStamp(audit.room.startedAt)}.pdf`);

/** Attendance, roll calls, the full audit trail, and the chat, in one spreadsheet-friendly file. */
export const exportAuditCsv = (audit: RoomAudit) => {
  const end = audit.room.endedAt ?? Date.now();
  const rows: (string | number)[][] = [
    ...attendanceRows(audit, end).flatMap(({ entry }) =>
      entry.stints.map((stint) => [
        'Attendance',
        dateTime(stint.joinedAt),
        entry.name,
        `${entry.detail} · ${ROLE_LABEL[entry.role]}`,
        `In ${clockTimeWithSeconds(stint.joinedAt)}, out ${stint.leftAt ? clockTimeWithSeconds(stint.leftAt) : 'still in'} (${durationText((stint.leftAt ?? end) - stint.joinedAt)})${stint.reason ? ` · ${stint.reason}` : ''}`,
        stint.device,
      ])
    ),
    ...audit.events.map((event) => ['Event', dateTime(event.at), event.actor?.name ?? 'System', EVENT_GROUP_LABEL[EVENT_GROUP[event.type]], `${eventText(event)}${event.detail ? ` · ${event.detail}` : ''}`, '']),
  ];
  return saveCsv(safeName(`${audit.room.title} - E-Session Record ${fileStamp(audit.room.startedAt)}.csv`), ['Section', 'Time', 'Person', 'Kind', 'Details', 'Device'], rows);
};

/** Saves a file into the session's folder in Session Files (in this browser, like every upload). */
export const saveToSessionFiles = (file: { name: string; blob: Blob; kind: 'audio' | 'pdf'; category: 'Audio Recording' | 'Supporting Document'; sessionId: string }, account: MobileAccount) =>
  addSessionFiles([
    {
      name: file.name,
      category: file.category,
      sessionId: file.sessionId,
      kind: file.kind,
      size: file.blob.size,
      uploadedAt: todayInManila(),
      uploadedBy: account.name,
      uploadedByRole: account.canManage ? 'Administrator' : account.detail,
      source: 'upload',
      blob: file.blob,
    },
  ]);
