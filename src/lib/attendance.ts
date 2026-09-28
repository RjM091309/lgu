import { useSyncExternalStore } from 'react';
import { mockCommitteeAssignments, mockCommittees, mockMembers, type Session } from '@/lib/mock-data';
import type { UserAccount } from '@/lib/access-store';

// Who is expected at each session and whether they said they will attend. In memory like the
// other sample data (resets on refresh).

export type RsvpStatus = 'attending' | 'declined';

export interface Rsvp {
  status: RsvpStatus;
  reason?: string;
  /** Local Manila time, `YYYY-MM-DDTHH:mm`. */
  respondedAt: string;
  /** Name of whoever recorded the response (the invitee or the Secretariat on their behalf). */
  recordedBy: string;
}

export interface Invitee {
  id: string;
  name: string;
  detail: string;
  abbr: string;
  group: 'member' | 'staff';
  /** Set for staff invitees, so a signed-in user can find their own row. */
  userId?: string;
}

/** Roles invited as Secretariat staff; committee hearings add committee staff. */
const SECRETARIAT_ROLES = ['Administrator', 'Records Officer'];

const initialsOf = (name: string) =>
  name
    .replace(/[^A-Za-z ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

/** Members of the body (from the master listing) plus the staff accounts expected at the session. */
export const inviteesFor = (session: Session, users: UserAccount[]): Invitee[] => {
  const assignment = session.committeeId ? mockCommitteeAssignments[session.committeeId] : undefined;
  const members = assignment
    ? [
        { id: assignment.chair, role: 'Committee Chair' },
        { id: assignment.viceChair, role: 'Committee Vice Chair' },
        ...assignment.members.map((id) => ({ id, role: 'Committee Member' })),
      ].flatMap(({ id, role }) => {
        const member = mockMembers.find((entry) => entry.id === id);
        return member ? [{ member, detail: role }] : [];
      })
    : mockMembers.map((member) => ({ member, detail: member.seat === 'Presiding Officer' ? 'Presiding Officer' : member.role }));

  const staffRoles = assignment ? [...SECRETARIAT_ROLES, 'Committee Staff'] : SECRETARIAT_ROLES;
  const staff = users.filter((user) => user.status === 'Active' && staffRoles.includes(user.role));

  return [
    ...members.map(({ member, detail }) => ({ id: `member:${member.id}`, name: member.name, detail, abbr: member.abbr, group: 'member' as const })),
    ...staff.map((user) => ({ id: `user:${user.id}`, name: user.name, detail: `${user.office} · ${user.role}`, abbr: initialsOf(user.name), group: 'staff' as const, userId: user.id })),
  ];
};

export const committeeNameOf = (session: Session) => mockCommittees.find((committee) => committee.id === session.committeeId)?.name;

/** A quorum is a majority of all the members of the body. */
export const QUORUM = Math.floor(mockMembers.length / 2) + 1;

const key = (sessionId: string, inviteeId: string) => `${sessionId}|${inviteeId}`;

let responses: Record<string, Rsvp> = {
  [key('s1', 'member:m1')]: { status: 'attending', respondedAt: '2026-09-24T10:12', recordedBy: 'SB Secretary' },
  [key('s1', 'member:m2')]: { status: 'attending', respondedAt: '2026-09-24T10:14', recordedBy: 'SB Secretary' },
  [key('s1', 'member:m3')]: { status: 'attending', respondedAt: '2026-09-24T13:40', recordedBy: 'SB Secretary' },
  [key('s1', 'member:m4')]: { status: 'declined', reason: 'On official travel to Tarlac City', respondedAt: '2026-09-25T08:05', recordedBy: 'SB Secretary' },
  [key('s1', 'member:m5')]: { status: 'attending', respondedAt: '2026-09-25T09:30', recordedBy: 'SB Secretary' },
  [key('s1', 'member:m6')]: { status: 'attending', respondedAt: '2026-09-25T09:31', recordedBy: 'SB Secretary' },
  [key('s1', 'member:m11')]: { status: 'attending', respondedAt: '2026-09-25T11:02', recordedBy: 'SB Secretary' },
  [key('s1', 'user:USR-002')]: { status: 'attending', respondedAt: '2026-09-24T10:00', recordedBy: 'SB Secretary' },
  [key('s1', 'user:USR-005')]: { status: 'attending', respondedAt: '2026-09-24T16:20', recordedBy: 'Journal and Minutes Officer' },
  [key('s2', 'member:m3')]: { status: 'attending', respondedAt: '2026-09-25T14:10', recordedBy: 'SB Committee Staff' },
  [key('s2', 'member:m11')]: { status: 'declined', reason: 'Barangay assembly on the same afternoon', respondedAt: '2026-09-25T15:45', recordedBy: 'SB Committee Staff' },
};

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useAttendance = () => useSyncExternalStore(subscribe, () => responses);

export const rsvpOf = (all: Record<string, Rsvp>, sessionId: string, inviteeId: string) => all[key(sessionId, inviteeId)];

/** Records a response; `null` clears it back to "no response". */
export const setRsvp = (sessionId: string, inviteeId: string, rsvp: Rsvp | null) => {
  const next = { ...responses };
  if (rsvp) next[key(sessionId, inviteeId)] = rsvp;
  else delete next[key(sessionId, inviteeId)];
  responses = next;
  listeners.forEach((listener) => listener());
};
