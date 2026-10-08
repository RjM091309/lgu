import { ADMIN_ROLE, initials, type UserAccount } from '@/lib/access-store';
import { inviteesFor } from '@/lib/attendance';
import { mockMembers, type Session } from '@/lib/mock-data';

// Sign-in accounts for the mobile app (/m). Members of the body sign in by position; Secretariat and
// committee staff use their portal usernames. Every account uses the demo password.

export interface MobileAccount {
  /** Same id the invitation lists use (`member:m1`, `user:USR-001`). */
  inviteeId: string;
  username: string;
  name: string;
  detail: string;
  abbr: string;
  group: 'member' | 'staff';
  /** The Administrator schedules sessions, sees everyone's responses, and sends reminders. */
  canManage: boolean;
}

const MEMBER_USERNAMES: Record<string, string> = {
  m1: 'vicemayor',
  m2: 'councilor1',
  m3: 'councilor2',
  m4: 'councilor3',
  m5: 'councilor4',
  m6: 'councilor5',
  m7: 'councilor6',
  m8: 'councilor7',
  m9: 'councilor8',
  m10: 'ipmr',
  m11: 'abc',
  m12: 'sk',
};

/** Staff roles that attend sessions or hearings, so they have a schedule to keep. */
const STAFF_ROLES = [ADMIN_ROLE, 'Records Officer', 'Committee Staff'];

export const mobileAccounts = (users: UserAccount[]): MobileAccount[] => [
  ...mockMembers.map((member) => ({
    inviteeId: `member:${member.id}`,
    username: MEMBER_USERNAMES[member.id] ?? member.id,
    name: member.name,
    detail: member.seat === 'Presiding Officer' ? 'Presiding Officer' : member.role,
    abbr: member.abbr,
    group: 'member' as const,
    canManage: false,
  })),
  ...users
    .filter((user) => user.status === 'Active' && STAFF_ROLES.includes(user.role))
    .map((user) => ({
      inviteeId: `user:${user.id}`,
      username: user.username,
      name: user.name,
      detail: `${user.office} · ${user.role}`,
      abbr: initials(user.name),
      group: 'staff' as const,
      canManage: user.role === ADMIN_ROLE,
    })),
];

export const isInvited = (session: Session, users: UserAccount[], inviteeId: string) => inviteesFor(session, users).some((invitee) => invitee.id === inviteeId);
