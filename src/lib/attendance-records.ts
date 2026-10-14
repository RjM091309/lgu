import { useMemo } from 'react';
import { createPdf, type PdfBlock } from '@/lib/pdf';
import { LGU_PROFILE, mockAttendanceMarks, mockAttendanceSessions, mockMembers, type AttendanceMark } from '@/lib/mock-data';
import { formatLongDate } from '@/lib/sessions';
import { fileUrl, letterhead, useSessionFiles, type SessionFile } from '@/lib/session-files';
import { useCalendarSessions } from '@/lib/esession-sync';

// The attendance records the Attendance page lists: the sample sessions held in the Session Hall (Jul to Sep 2026,
// built from the same marks as the sample attendance data, so the numbers agree everywhere), plus every attendance
// record in Session Files: the ones saved when an e-session ends, and any uploaded there (a signed sheet, say).

export interface AttendanceRecord {
  id: string;
  title: string;
  /** Date the session was held (its scheduled date). */
  date: string;
  type: string;
  /** Members who attended, the members the quorum counts from, and the quorum; null for an uploaded file. */
  present: number | null;
  total: number | null;
  quorum: number | null;
  /** Where it came from: an e-session, an upload to Session Files, or a sitting in the Session Hall. */
  origin: 'e-session' | 'upload' | 'hall';
  /** Who saved it, for files in Session Files. */
  savedBy?: string;
  fileName: string;
  /** For sorting records of the same day (ms); 0 when not known. */
  heldAt: number;
  /** The PDF itself. */
  load: () => Promise<Blob>;
}

export const quorumMet = (record: AttendanceRecord) => (record.present === null || record.quorum === null ? null : record.present >= record.quorum);

/* ------------------------------------------------------------ Sample sessions held in the Session Hall */

const QUORUM = Math.floor(mockMembers.length / 2) + 1;
const memberDetail = (member: (typeof mockMembers)[number]) => (member.seat === 'Presiding Officer' ? 'Presiding Officer' : member.role);

const hallRecordPdf = (index: number) => {
  const session = mockAttendanceSessions[index];
  const title = session.type === 'Special' ? 'Special Session' : `${session.label} Session`;
  const marks = mockMembers.map((member) => ({ member, mark: ((mockAttendanceMarks[member.id] ?? '')[index] ?? 'A') as AttendanceMark }));
  const present = marks.filter((entry) => entry.mark !== 'A');
  const absent = marks.filter((entry) => entry.mark === 'A');
  const met = present.length >= QUORUM;
  const blocks: PdfBlock[] = [
    ...letterhead(),
    { text: 'SESSION ATTENDANCE RECORD', size: 13, bold: true, spaceBefore: 18 },
    { text: title, size: 12, bold: true },
    { text: `${formatLongDate(session.date)} · 09:00 AM · ${session.type} session`, size: 10 },
    { text: `Held at the ${LGU_PROFILE.sessionHall}. Attendance taken by roll call at the opening of the session.`, size: 10 },
    { text: `Quorum: ${met ? 'met' : 'not met'}. ${present.length} of ${mockMembers.length} members present; ${QUORUM} needed.`, size: 11, bold: true, spaceBefore: 12 },
    { text: `Members present (${present.length})`, size: 11, bold: true, spaceBefore: 14, keepWithNext: true },
    {
      table: {
        spaceBefore: 6,
        columns: [
          { title: 'Name', width: 2 },
          { title: 'Position', width: 1.6 },
          { title: 'Remarks', width: 1 },
        ],
        rows: present.map(({ member, mark }) => [member.name, memberDetail(member), mark === 'L' ? 'Arrived late' : 'Present']),
      },
    },
  ];
  if (absent.length) {
    blocks.push(
      { text: `Members absent (${absent.length})`, size: 11, bold: true, spaceBefore: 14, keepWithNext: true },
      { table: { spaceBefore: 6, columns: [{ title: 'Name', width: 2 }, { title: 'Position', width: 2.6 }], rows: absent.map(({ member }) => [member.name, memberDetail(member)]) } }
    );
  }
  blocks.push({ text: 'Certified correct by the Office of the SB Secretary.', size: 9, gray: 0.35, spaceBefore: 18 });
  return createPdf(blocks, { watermark: 'SB CAPAS · OFFICIAL COPY', footer: `Session attendance record · ${title} · ${formatLongDate(session.date)}` });
};

// Built once, when first opened.
const hallPdfs = new Map<number, Blob>();

const hallRecords = (): AttendanceRecord[] =>
  mockAttendanceSessions.map((session, index) => {
    const title = session.type === 'Special' ? 'Special Session' : `${session.label} Session`;
    const present = mockMembers.filter((member) => (mockAttendanceMarks[member.id] ?? '')[index] !== 'A').length;
    return {
      id: `hall-${session.id}`,
      title,
      date: session.date,
      type: session.type,
      present,
      total: mockMembers.length,
      quorum: QUORUM,
      origin: 'hall',
      fileName: `${title} - Attendance Record ${session.date}.pdf`,
      heldAt: 0,
      load: async () => {
        if (!hallPdfs.has(index)) hallPdfs.set(index, hallRecordPdf(index));
        return hallPdfs.get(index)!;
      },
    };
  });

/* ------------------------------------------------------------ Records in Session Files */

const isAttendanceRecord = (file: SessionFile) =>
  file.kind === 'pdf' && (file.category === 'Attendance Record' || (file.category === 'Supporting Document' && /attendance record/i.test(file.name)));

const loadFile = async (file: SessionFile) => {
  if (file.blob) return file.blob;
  const url = fileUrl(file);
  if (!url) throw new Error('missing');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.blob();
};

/** Every attendance record, newest first. */
export function useAttendanceRecords(): AttendanceRecord[] {
  const files = useSessionFiles();
  const calendar = useCalendarSessions();
  return useMemo(() => {
    const saved = files.filter(isAttendanceRecord).map((file): AttendanceRecord => {
      const summary = file.attendance;
      const session = calendar.find((entry) => entry.id === file.sessionId);
      return {
        id: file.id,
        title: summary?.title ?? session?.title ?? file.name.replace(/\.pdf$/i, ''),
        date: summary?.date ?? session?.date ?? file.uploadedAt,
        type: summary?.type ?? session?.type ?? 'Session',
        present: summary?.present ?? null,
        total: summary?.total ?? null,
        quorum: summary?.quorum ?? null,
        origin: summary ? 'e-session' : 'upload',
        savedBy: file.uploadedBy,
        fileName: file.name,
        heldAt: summary?.heldAt ?? 0,
        load: () => loadFile(file),
      };
    });
    return [...saved, ...hallRecords()].sort((a, b) => b.date.localeCompare(a.date) || b.heldAt - a.heldAt);
  }, [files, calendar]);
}
