import { mockCommitteeAssignments, mockCommittees, mockMembers, type Session } from '@/lib/mock-data';
import type { UserAccount } from '@/lib/access-store';
import { rsvpKey, setRsvp, useESessionState, type Rsvp } from '@/lib/esession-sync';

// Who is expected at each session and whether they said they will attend. The responses themselves
// are shared with the mobile app through the E-Session sync (see esession-sync.ts).

export { setRsvp, type Rsvp, type RsvpStatus } from '@/lib/esession-sync';

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
/** Staff who can be picked for a meeting: the ones with a LIMS Mobile sign-in (see mobile-accounts.ts). */
const MEETING_STAFF_ROLES = [...SECRETARIAT_ROLES, 'Committee Staff'];

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
  if (session.type === 'Meeting') return chosenInvitees(session.invitees ?? [], users);
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

  return [...members.map(({ member, detail }) => memberInvitee(member, detail)), ...staff.map(staffInvitee)];
};

const memberInvitee = (member: (typeof mockMembers)[number], detail = member.seat === 'Presiding Officer' ? 'Presiding Officer' : member.role): Invitee => ({
  id: `member:${member.id}`,
  name: member.name,
  detail,
  abbr: member.abbr,
  group: 'member',
});

const staffInvitee = (user: UserAccount): Invitee => ({ id: `user:${user.id}`, name: user.name, detail: `${user.office} · ${user.role}`, abbr: initialsOf(user.name), group: 'staff', userId: user.id });

/** Members of the body and active staff who can be invited to a meeting (everyone with a LIMS Mobile sign-in). */
export const inviteePool = (users: UserAccount[]): Invitee[] => [
  ...mockMembers.map((member) => memberInvitee(member)),
  ...users.filter((user) => user.status === 'Active' && MEETING_STAFF_ROLES.includes(user.role)).map(staffInvitee),
];

/** A meeting's invitees, in the pool's order; anyone no longer in the pool (a deactivated account) drops off. */
const chosenInvitees = (ids: string[], users: UserAccount[]) => {
  const chosen = new Set(ids);
  return inviteePool(users).filter((invitee) => chosen.has(invitee.id));
};

export const committeeNameOf = (session: Session) => mockCommittees.find((committee) => committee.id === session.committeeId)?.name;

/** A quorum is a majority of all the members of the body. */
export const QUORUM = Math.floor(mockMembers.length / 2) + 1;

export const useAttendance = () => useESessionState().rsvps;

export const rsvpOf = (all: Record<string, Rsvp>, sessionId: string, inviteeId: string) => all[rsvpKey(sessionId, inviteeId)];
