import { useSyncExternalStore } from 'react';

// System-wide activity log: sample history plus every action performed in this browser session.
// Kept in memory like the rest of the sample data, so it resets on refresh.

export const ACTIVITY_MODULES = [
  'Authentication',
  'Legislative Tracking',
  'Transactions',
  'Master Listings',
  'Archives',
  'E-Session',
  'Reports',
  'Administration',
  'Public Portal',
] as const;
export type ActivityModule = (typeof ACTIVITY_MODULES)[number];

export const ACTIVITY_ACTIONS = [
  'Created',
  'Updated',
  'Routed',
  'Approved',
  'Returned',
  'Deleted',
  'Signed',
  'Uploaded',
  'Published',
  'Exported',
  'Signed in',
  'Signed out',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface ActivityEntry {
  id: string;
  /** Local Manila time, `YYYY-MM-DDTHH:mm`. */
  timestamp: string;
  user: string;
  module: ActivityModule;
  action: ActivityAction;
  summary: string;
  detail?: string;
}

// The demo signs everyone in as the Secretariat administrator.
export const CURRENT_USERNAME = 'sb.admin';

const SEED: Omit<ActivityEntry, 'id'>[] = [
  { timestamp: '2026-09-25T09:37', user: 'sb.committee', module: 'Transactions', action: 'Returned', summary: 'Returned APP-2026-016 as incomplete', detail: 'Missing certified true copy of the committee report.' },
  { timestamp: '2026-09-25T09:22', user: 'sb.records', module: 'E-Session', action: 'Uploaded', summary: 'Uploaded minutes of the 37th Regular Session', detail: 'Added to Session Files under Minutes.' },
  { timestamp: '2026-09-25T09:14', user: 'sb.admin', module: 'Legislative Tracking', action: 'Approved', summary: 'Approved routing of Mun. Ord. No. 2026-007', detail: 'Forwarded to the Office of the Municipal Mayor.' },
  { timestamp: '2026-09-25T08:52', user: 'sb.secretary', module: 'Authentication', action: 'Signed in', summary: 'Signed in to the Secretariat portal' },
  { timestamp: '2026-09-25T08:31', user: 'sb.admin', module: 'Authentication', action: 'Signed in', summary: 'Signed in to the Secretariat portal' },
  { timestamp: '2026-09-24T16:45', user: 'sb.records', module: 'Legislative Tracking', action: 'Published', summary: 'Posted Mun. Ord. No. 2026-005 on the public bulletin', detail: 'Posting period started for publication compliance.' },
  { timestamp: '2026-09-24T15:20', user: 'sb.secretary', module: 'E-Session', action: 'Signed', summary: 'Signed the journal of the 37th Regular Session', detail: 'Electronic signature recorded by the SB Secretary.' },
  { timestamp: '2026-09-24T14:10', user: 'sb.admin', module: 'Transactions', action: 'Created', summary: 'Prepared the order of business for the 38th Regular Session', detail: 'Agenda items 1–9 queued for the session.' },
  { timestamp: '2026-09-24T11:05', user: 'sb.committee', module: 'Legislative Tracking', action: 'Updated', summary: 'Moved Prop. Ord. No. 2026-P-012 to Committee', detail: 'Referred to the Committee on Transportation.' },
  { timestamp: '2026-09-24T10:12', user: 'public', module: 'Public Portal', action: 'Created', summary: 'Requested a certified copy of Mun. Ord. No. 2025-018', detail: 'Reference number CR-2026-0412.' },
  { timestamp: '2026-09-24T09:40', user: 'sb.admin', module: 'Reports', action: 'Exported', summary: 'Exported the legislation listing', detail: '10 record(s) saved as CSV.' },
  { timestamp: '2026-09-23T17:02', user: 'sb.admin', module: 'Administration', action: 'Updated', summary: 'Saved permissions for the Records Officer role', detail: 'Access to 4 module group(s).' },
  { timestamp: '2026-09-23T15:48', user: 'sb.records', module: 'E-Session', action: 'Uploaded', summary: 'Uploaded the plenary recording of the 37th Regular Session', detail: 'Video recording attached to the session.' },
  { timestamp: '2026-09-23T14:30', user: 'sb.committee', module: 'Transactions', action: 'Routed', summary: 'Routed APP-2026-014 to Committee Referral', detail: 'Assigned to the Committee on Finance, Budget and Appropriations.' },
  { timestamp: '2026-09-23T13:15', user: 'sb.secretary', module: 'Legislative Tracking', action: 'Updated', summary: 'Moved SB Res. No. 2026-044 to Third Reading' },
  { timestamp: '2026-09-23T10:02', user: 'public', module: 'Public Portal', action: 'Created', summary: 'Registered for legislative updates', detail: 'Subscribed to email notifications.' },
  { timestamp: '2026-09-23T09:20', user: 'sb.admin', module: 'Master Listings', action: 'Created', summary: 'Added the Committee on Youth and Sports Development', detail: 'Added to the master listing of committees.' },
  { timestamp: '2026-09-22T16:40', user: 'sb.admin', module: 'Administration', action: 'Created', summary: 'Created a user account for the Committee Secretary', detail: 'Activation link sent.' },
  { timestamp: '2026-09-22T15:05', user: 'sb.records', module: 'Archives', action: 'Exported', summary: 'Exported the archive index', detail: 'sb-capas-archive-index.csv was downloaded.' },
  { timestamp: '2026-09-22T11:30', user: 'sb.committee', module: 'Legislative Tracking', action: 'Created', summary: 'Saved Prop. Ord. No. 2026-P-020', detail: 'An Ordinance Strengthening the Anti-Littering and Solid Waste Segregation Program.' },
  { timestamp: '2026-09-22T10:18', user: 'sb.secretary', module: 'E-Session', action: 'Signed', summary: 'Signed Mun. Ord. No. 2026-007 for transmittal' },
  { timestamp: '2026-09-22T09:02', user: 'sb.admin', module: 'Administration', action: 'Updated', summary: 'Saved security settings', detail: 'Session timeout: 30 minutes.' },
  { timestamp: '2026-09-21T17:10', user: 'sb.admin', module: 'Authentication', action: 'Signed out', summary: 'Signed out of the Secretariat portal' },
  { timestamp: '2026-09-21T15:33', user: 'sb.committee', module: 'Transactions', action: 'Approved', summary: 'Approved APP-2026-013 for the agenda', detail: 'Cleared by the committee chair.' },
  { timestamp: '2026-09-21T14:12', user: 'sb.records', module: 'Reports', action: 'Exported', summary: 'Generated the Session Attendance with Quorum report', detail: 'September 2026, opened for printing.' },
  { timestamp: '2026-09-21T10:45', user: 'sb.admin', module: 'Legislative Tracking', action: 'Deleted', summary: 'Deleted a duplicate draft record', detail: 'Duplicate of Prop. Ord. No. 2026-P-018.' },
];

let seq = 0;
const nextId = () => `ACT-${String(++seq).padStart(4, '0')}`;

let entries: ActivityEntry[] = SEED.map((entry) => ({ ...entry, id: nextId() }));
const listeners = new Set<() => void>();

const manilaNow = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

export const logActivity = (entry: { module: ActivityModule; action: ActivityAction; summary: string; detail?: string; user?: string }) => {
  entries = [{ ...entry, id: nextId(), timestamp: manilaNow(), user: entry.user ?? CURRENT_USERNAME }, ...entries];
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useActivityLog = () => useSyncExternalStore(subscribe, () => entries);
