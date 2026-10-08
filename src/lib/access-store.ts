import { useSyncExternalStore } from 'react';
import { NAV_GROUPS } from '@/lib/navigation';
import { isPageOn, navGroupsFor, useModules } from '@/lib/modules';
import { getSharedAccounts, isSyncLive, saveSharedAccounts, subscribeSync } from '@/lib/esession-sync';

// Accounts, roles, and security settings for the Administration pages. Accounts and roles changed here are shared
// through the LIMS server with every device (E-Session and LIMS Mobile sign in with the same accounts), until the
// server restarts and the sample accounts return. Security settings stay in this browser.

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  email: string;
  office: string;
  role: string;
  status: 'Active' | 'Inactive';
  mfa: boolean;
  /** Local Manila time, `YYYY-MM-DDTHH:mm`. */
  lastActive: string;
}

export interface Role {
  name: string;
  scope: string;
  updated: string;
  /** Nav item ids the role can open (see PERMISSION_GROUPS). */
  pages: string[];
  /** Accent used for the role's pill and avatar. */
  tone: 'indigo' | 'blue' | 'violet' | 'emerald' | 'slate';
}

export interface SecuritySettings {
  mfaSms: boolean;
  mfaApp: boolean;
  mfaToken: boolean;
  requireMfaForAdmins: boolean;
  sessionTimeout: number;
  passwordMinLength: number;
  requireSymbols: boolean;
  lockoutAttempts: number;
  dailyBackup: boolean;
  auditRetentionDays: number;
  lastBackup: string;
}

// Pages a role can be granted, grouped as in the sidebar. Overview pages are open to every role;
// System Requirements is proposal reference material, shown to administrators only.
export const PERMISSION_GROUPS = NAV_GROUPS.filter((group) => group.id !== 'overview' && group.id !== 'reference').map((group) => ({
  id: group.id,
  name: group.label,
  pages: group.items.map((item) => ({ id: item.id, label: item.label })),
}));
export const ALL_PAGES = PERMISSION_GROUPS.flatMap((group) => group.pages.map((page) => page.id));
const OPEN_PAGES = NAV_GROUPS.find((group) => group.id === 'overview')?.items.map((item) => item.id) ?? [];
const pagesOf = (...groupIds: string[]) => PERMISSION_GROUPS.filter((group) => groupIds.includes(group.id)).flatMap((group) => group.pages.map((page) => page.id));

export const ADMIN_ROLE = 'Administrator';

/** A role can open a page when the page is part of the portal right now (see modules.ts) and the role has it. */
export const canOpenPage = (role: Role | undefined, tab: string) =>
  isPageOn(tab) && (role?.name === ADMIN_ROLE || OPEN_PAGES.includes(tab) || (role?.pages.includes(tab) ?? false));

/** The permission groups as the role editor shows them: only pages turned on, under their current names. */
export const usePermissionGroups = () => {
  const groups = navGroupsFor(useModules());
  return PERMISSION_GROUPS.map((group) => ({
    ...group,
    pages: group.pages.flatMap((page) => {
      const item = groups.flatMap((entry) => entry.items).find((entry) => entry.id === page.id);
      return item ? [{ id: page.id, label: item.label }] : [];
    }),
  })).filter((group) => group.pages.length > 0);
};

export const ROLE_TONE: Record<Role['tone'], { pill: string; avatar: string; bar: string }> = {
  indigo: { pill: 'border-indigo-200 bg-indigo-50 text-indigo-800', avatar: 'bg-indigo-600 text-white', bar: 'bg-indigo-600' },
  // Avatars use fixed shades: white initials need a dark fill, and dark mode turns the stock -700 shades light.
  blue: { pill: 'border-blue-200 bg-blue-50 text-blue-800', avatar: 'bg-[#1d4ed8] text-white', bar: 'bg-blue-600' },
  violet: { pill: 'border-violet-200 bg-violet-50 text-violet-800', avatar: 'bg-violet-600 text-white', bar: 'bg-violet-600' },
  emerald: { pill: 'border-emerald-200 bg-emerald-50 text-emerald-800', avatar: 'bg-[#047857] text-white', bar: 'bg-emerald-600' },
  slate: { pill: 'border-slate-200 bg-slate-50 text-slate-700', avatar: 'bg-[#475569] text-white', bar: 'bg-slate-500' },
};

const SAMPLE_USERS: UserAccount[] = [
  { id: 'USR-001', name: 'SB Secretariat Admin', username: 'admin', email: 'sb.admin@capas.gov.ph', office: 'SB Secretariat', role: 'Administrator', status: 'Active', mfa: true, lastActive: '2026-09-25T08:31' },
  { id: 'USR-002', name: 'SB Secretary', username: 'secretary', email: 'sb.secretary@capas.gov.ph', office: 'Office of the SB Secretary', role: 'Administrator', status: 'Active', mfa: true, lastActive: '2026-09-25T08:52' },
  { id: 'USR-003', name: 'SB Records Officer', username: 'records', email: 'sb.records@capas.gov.ph', office: 'Records Section', role: 'Records Officer', status: 'Active', mfa: true, lastActive: '2026-09-25T09:22' },
  { id: 'USR-004', name: 'SB Committee Staff', username: 'committee', email: 'sb.committee@capas.gov.ph', office: 'Committee Affairs', role: 'Committee Staff', status: 'Active', mfa: false, lastActive: '2026-09-25T09:37' },
  { id: 'USR-005', name: 'Journal and Minutes Officer', username: 'journal', email: 'sb.journal@capas.gov.ph', office: 'Records Section', role: 'Records Officer', status: 'Active', mfa: false, lastActive: '2026-09-24T16:10' },
  { id: 'USR-006', name: 'Committee Secretary, Finance', username: 'cfinance', email: 'sb.cfinance@capas.gov.ph', office: 'Committee Affairs', role: 'Committee Staff', status: 'Active', mfa: false, lastActive: '2026-09-23T14:30' },
  { id: 'USR-007', name: 'Legislative Researcher', username: 'research', email: 'sb.research@capas.gov.ph', office: 'Legislative Research', role: 'Committee Staff', status: 'Inactive', mfa: false, lastActive: '2026-08-29T11:00' },
  { id: 'USR-008', name: 'Public Information Desk', username: 'infodesk', email: 'sb.infodesk@capas.gov.ph', office: 'Public Assistance', role: 'Viewer', status: 'Active', mfa: false, lastActive: '2026-09-22T10:05' },
  { id: 'USR-009', name: 'SB Encoder', username: 'encoder', email: 'sb.encoder@capas.gov.ph', office: 'Records Section', role: 'Encoder', status: 'Active', mfa: false, lastActive: '2026-09-25T10:15' },
];

const SAMPLE_ROLES: Role[] = [
  { name: 'Administrator', scope: 'Full access, including accounts and security settings', updated: '2026-04-10', pages: ALL_PAGES, tone: 'indigo' },
  { name: 'Records Officer', scope: 'Encode, route, and archive legislative records and session files', updated: '2026-04-11', pages: pagesOf('legislative', 'esession', 'reports'), tone: 'blue' },
  {
    name: 'Committee Staff',
    scope: 'Committee hearings: schedules, hearing records, and reports',
    updated: '2026-10-08',
    pages: [...pagesOf('legislative', 'reports'), 'esig-calendar-sessions', 'esig-session-files'],
    tone: 'violet',
  },
  {
    name: 'Encoder',
    scope: 'Uploads scanned copies of enacted ordinances and the audio and video of sessions and hearings',
    updated: '2026-09-28',
    pages: ['esig-session-files', 'archive'],
    tone: 'emerald',
  },
  { name: 'Viewer', scope: 'Read-only access to reports', updated: '2026-05-02', pages: pagesOf('reports'), tone: 'slate' },
];

let users = SAMPLE_USERS;
let roles = SAMPLE_ROLES;

let settings: SecuritySettings = {
  mfaSms: true,
  mfaApp: true,
  mfaToken: false,
  requireMfaForAdmins: true,
  sessionTimeout: 30,
  passwordMinLength: 12,
  requireSymbols: true,
  lockoutAttempts: 5,
  dailyBackup: true,
  auditRetentionDays: 365,
  lastBackup: '2026-09-25T02:00',
};

// Who is signed in. Kept per browser so a refresh keeps the same account; the demo login and the
// dashboard's account switcher set it.
const CURRENT_USER_KEY = 'sb-capas-user';
const DEFAULT_USER_ID = 'USR-001';
let currentUserId = (() => {
  try {
    return localStorage.getItem(CURRENT_USER_KEY) ?? DEFAULT_USER_ID;
  } catch {
    return DEFAULT_USER_ID;
  }
})();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useUsers = () => useSyncExternalStore(subscribe, () => users);
/** The accounts right now, outside React. */
export const getUsers = () => users;
export const useRoles = () => useSyncExternalStore(subscribe, () => roles);
export const useSecuritySettings = () => useSyncExternalStore(subscribe, () => settings);

const currentUserOf = (list: UserAccount[]) => list.find((user) => user.id === currentUserId) ?? list.find((user) => user.id === DEFAULT_USER_ID) ?? list[0];
export const getCurrentUser = () => currentUserOf(users);
export const useCurrentUser = () => useSyncExternalStore(subscribe, () => currentUserOf(users));
/**
 * Whether the signed-in account still exists and is active. An Administrator on another device may delete or
 * deactivate it; the portal then signs out instead of carrying on as the fallback account above.
 */
export const useCurrentUserActive = () => useSyncExternalStore(subscribe, () => users.find((user) => user.id === currentUserId)?.status === 'Active');

/** The signed-in account, its role, and whether that role can open a page. */
export const useAccess = () => {
  // Pages come and go as an Administrator turns optional modules on or off.
  useModules();
  const user = useCurrentUser();
  const active = useCurrentUserActive();
  const role = useRoles().find((entry) => entry.name === user.role);
  // An account that is gone or deactivated opens nothing, not even for the moment before it is signed out.
  return { user, role, can: (tab: string) => active && canOpenPage(role, tab) };
};

export const setCurrentUser = (id: string) => {
  currentUserId = id;
  try {
    localStorage.setItem(CURRENT_USER_KEY, id);
  } catch {
    // Storage unavailable: the account lasts until refresh.
  }
  emit();
};

/** Every sample account, on the web portal and the mobile app, signs in with this password. */
export const DEMO_PASSWORD = 'admin123';

/** Account for a login name. */
export const findLoginAccount = (username: string) => {
  const login = username.trim().toLowerCase();
  return users.find((user) => user.username === login) ?? null;
};

// Follow the accounts every device shares; the samples while nobody has changed them since the server started.
let appliedShared: unknown = undefined;
subscribeSync(() => {
  if (!isSyncLive()) return;
  const shared = getSharedAccounts();
  if (shared === appliedShared) return;
  appliedShared = shared;
  users = shared ? (shared.users as UserAccount[]) : SAMPLE_USERS;
  roles = shared ? (shared.roles as Role[]) : SAMPLE_ROLES;
  emit();
});

const share = () => void saveSharedAccounts({ users, roles });

export const setUsers = (update: (prev: UserAccount[]) => UserAccount[]) => {
  users = update(users);
  emit();
  share();
};
export const setRoles = (update: (prev: Role[]) => Role[]) => {
  roles = update(roles);
  emit();
  share();
};
export const saveSecuritySettings = (next: SecuritySettings) => {
  settings = next;
  emit();
};

export const initials = (name: string) =>
  name
    .replace(/[^A-Za-z ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
