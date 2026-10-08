import { DEMO_PASSWORD, findLoginAccount, type UserAccount } from '@/lib/access-store';
import { mobileAccounts, type MobileAccount } from '@/lib/mobile-accounts';

// One sign-in rule for the three ways into LIMS, so the same account gets the same answer everywhere:
// - the Staff Portal (the dashboard): Secretariat and staff accounts;
// - E-Session (/es) and LIMS Mobile (/m): members of the Sanggunian, by position, and the staff who attend sessions.
// The password is checked in the browser in this prototype (every sample account uses the demo password); with
// server sign-in this is where the check would call the server.

export type SignInError = 'missing' | 'invalid' | 'inactive' | 'no-sessions' | 'member-portal';
export type SignInResult<T> = { account: T } | { error: SignInError; role?: string };

const isMember = (users: UserAccount[], login: string) => mobileAccounts(users).some((account) => account.group === 'member' && account.username === login);

/** The Staff Portal: staff accounts only; a member is told where they sign in instead. */
export const signInToPortal = (users: UserAccount[], username: string, password: string): SignInResult<UserAccount> => {
  const login = username.trim().toLowerCase();
  if (!login || !password) return { error: 'missing' };
  if (password !== DEMO_PASSWORD) return { error: 'invalid' };
  const user = findLoginAccount(login);
  if (user?.status === 'Inactive') return { error: 'inactive' };
  if (user) return { account: user };
  return { error: isMember(users, login) ? 'member-portal' : 'invalid' };
};

/** E-Session and LIMS Mobile: members and session staff; other staff are told to use the Staff Portal. */
export const signInToSessions = (users: UserAccount[], username: string, password: string): SignInResult<MobileAccount> => {
  const login = username.trim().toLowerCase();
  if (!login || !password) return { error: 'missing' };
  if (password !== DEMO_PASSWORD) return { error: 'invalid' };
  const account = mobileAccounts(users).find((entry) => entry.username === login);
  if (account) return { account };
  const user = findLoginAccount(login);
  if (user?.status === 'Inactive') return { error: 'inactive' };
  if (user) return { error: 'no-sessions', role: user.role };
  return { error: 'invalid' };
};

/** What each sign-in screen says (the public site has a Filipino version of the same messages). */
export const signInMessage = (error: SignInError, role?: string) =>
  ({
    missing: 'Enter your username and password.',
    invalid: 'The username or password is incorrect.',
    inactive: 'This account is deactivated. Contact the SB Secretariat administrator.',
    'no-sessions': `The ${role ?? 'account'} role does not take part in sessions. Sign in to the Staff Portal instead.`,
    'member-portal': 'Members of the Sanggunian sign in to E-Session or LIMS Mobile, not the Staff Portal.',
  })[error];
