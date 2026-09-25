import { useSyncExternalStore } from 'react';
import { NAV_GROUPS } from '@/lib/navigation';

// Accounts, roles, and security settings for the Administration pages. In memory like the other
// sample data (resets on refresh), shared so every page sees the same accounts and roles.

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
  modules: string[];
  /** Accent used for the role's pill and avatar. */
  tone: 'indigo' | 'blue' | 'violet' | 'slate';
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

export const MODULE_GROUPS = NAV_GROUPS.filter((group) => group.id !== 'overview' && group.id !== 'reference').map((group) => ({
  name: group.label,
  pages: group.items.map((item) => item.label),
}));

export const ADMIN_ROLE = 'Administrator';

export const ROLE_TONE: Record<Role['tone'], { pill: string; avatar: string; bar: string }> = {
  indigo: { pill: 'border-indigo-200 bg-indigo-50 text-indigo-800', avatar: 'bg-indigo-600 text-white', bar: 'bg-indigo-600' },
  blue: { pill: 'border-blue-200 bg-blue-50 text-blue-800', avatar: 'bg-blue-600 text-white', bar: 'bg-blue-600' },
  violet: { pill: 'border-violet-200 bg-violet-50 text-violet-800', avatar: 'bg-violet-600 text-white', bar: 'bg-violet-600' },
  slate: { pill: 'border-slate-200 bg-slate-50 text-slate-700', avatar: 'bg-slate-500 text-white', bar: 'bg-slate-500' },
};

let users: UserAccount[] = [
  { id: 'USR-001', name: 'SB Secretariat Admin', username: 'sb.admin', email: 'sb.admin@capas.gov.ph', office: 'SB Secretariat', role: 'Administrator', status: 'Active', mfa: true, lastActive: '2026-09-25T08:31' },
  { id: 'USR-002', name: 'SB Secretary', username: 'sb.secretary', email: 'sb.secretary@capas.gov.ph', office: 'Office of the SB Secretary', role: 'Administrator', status: 'Active', mfa: true, lastActive: '2026-09-25T08:52' },
  { id: 'USR-003', name: 'SB Records Officer', username: 'sb.records', email: 'sb.records@capas.gov.ph', office: 'Records Section', role: 'Records Officer', status: 'Active', mfa: true, lastActive: '2026-09-25T09:22' },
  { id: 'USR-004', name: 'SB Committee Staff', username: 'sb.committee', email: 'sb.committee@capas.gov.ph', office: 'Committee Affairs', role: 'Committee Staff', status: 'Active', mfa: false, lastActive: '2026-09-25T09:37' },
  { id: 'USR-005', name: 'Journal and Minutes Officer', username: 'sb.journal', email: 'sb.journal@capas.gov.ph', office: 'Records Section', role: 'Records Officer', status: 'Active', mfa: false, lastActive: '2026-09-24T16:10' },
  { id: 'USR-006', name: 'Committee Secretary, Finance', username: 'sb.cfinance', email: 'sb.cfinance@capas.gov.ph', office: 'Committee Affairs', role: 'Committee Staff', status: 'Active', mfa: false, lastActive: '2026-09-23T14:30' },
  { id: 'USR-007', name: 'Legislative Researcher', username: 'sb.research', email: 'sb.research@capas.gov.ph', office: 'Legislative Research', role: 'Committee Staff', status: 'Inactive', mfa: false, lastActive: '2026-08-29T11:00' },
  { id: 'USR-008', name: 'Public Information Desk', username: 'sb.infodesk', email: 'sb.infodesk@capas.gov.ph', office: 'Public Assistance', role: 'Viewer', status: 'Active', mfa: false, lastActive: '2026-09-22T10:05' },
];

let roles: Role[] = [
  { name: 'Administrator', scope: 'Full access, including accounts and security settings', updated: '2026-04-10', modules: MODULE_GROUPS.map((group) => group.name), tone: 'indigo' },
  { name: 'Records Officer', scope: 'Encode, route, and archive legislative records and session files', updated: '2026-04-11', modules: ['Legislative', 'E-Session', 'Reports'], tone: 'blue' },
  { name: 'Committee Staff', scope: 'Committee referrals, hearing records, and reports', updated: '2026-04-09', modules: ['Legislative', 'Reports'], tone: 'violet' },
  { name: 'Viewer', scope: 'Read-only access to reports', updated: '2026-05-02', modules: ['Reports'], tone: 'slate' },
];

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

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useUsers = () => useSyncExternalStore(subscribe, () => users);
export const useRoles = () => useSyncExternalStore(subscribe, () => roles);
export const useSecuritySettings = () => useSyncExternalStore(subscribe, () => settings);

export const setUsers = (update: (prev: UserAccount[]) => UserAccount[]) => {
  users = update(users);
  emit();
};
export const setRoles = (update: (prev: Role[]) => Role[]) => {
  roles = update(roles);
  emit();
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
