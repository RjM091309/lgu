import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  BarChart3,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderOpen,
  History,
  LayoutDashboard,
  MonitorSmartphone,
  PenLine,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords: string[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

// Single source for the sidebar, the top-bar breadcrumb, and global search.
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: ['dashboard', 'overview', 'home'] },
      { id: 'activity-log', label: 'Activity Log', icon: History, keywords: ['activity', 'log', 'history', 'audit', 'actions', 'users'] },
    ],
  },
  {
    id: 'legislative',
    label: 'Legislative',
    items: [
      { id: 'manage-legislation', label: 'Legislative Tracking', icon: FileText, keywords: ['legislation', 'legislative', 'tracking', 'ordinance', 'resolution'] },
      { id: 'manage-master-files', label: 'Files & Master Listings', icon: Users, keywords: ['master', 'files', 'members', 'listings', 'committees'] },
      { id: 'manage-transactions', label: 'Transaction Operations', icon: Calendar, keywords: ['transaction', 'operations', 'routing', 'agenda', 'sessions'] },
      { id: 'archive', label: 'Archives', icon: Archive, keywords: ['archive', 'archives', 'records'] },
    ],
  },
  {
    id: 'esession',
    label: 'E-Session',
    items: [
      { id: 'esig-platform', label: 'Session Platform', icon: MonitorSmartphone, keywords: ['platform', 'e-session', 'devices'] },
      { id: 'esig-electronic-signature', label: 'Electronic Signature', icon: PenLine, keywords: ['electronic signature', 'digital signature', 'esig', 'sign'] },
      { id: 'esig-session-files', label: 'Session Files', icon: FolderOpen, keywords: ['session files', 'attachments', 'minutes', 'recording'] },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    items: [
      { id: 'report-search-listing', label: 'Search & Listing', icon: Search, keywords: ['report', 'reports', 'search', 'listing'] },
      { id: 'report-statistical-performance', label: 'Statistics & Performance', icon: BarChart3, keywords: ['statistics', 'statistical', 'performance'] },
      { id: 'report-attendance-publication', label: 'Attendance & Publication', icon: ClipboardCheck, keywords: ['attendance', 'publication', 'quorum'] },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { id: 'access-users', label: 'Users', icon: UserCog, keywords: ['access', 'user', 'users', 'accounts'] },
      { id: 'access-roles', label: 'Roles & Permissions', icon: ShieldCheck, keywords: ['role', 'roles', 'permissions'] },
      { id: 'access-control-panel', label: 'Control Panel', icon: SlidersHorizontal, keywords: ['control', 'panel', 'security', 'settings', 'audit'] },
    ],
  },
  {
    id: 'reference',
    label: 'System Requirements',
    items: [
      { id: 'req-core-modules', label: 'Core Modules', icon: ClipboardList, keywords: ['requirements', 'core', 'modules'] },
      { id: 'req-public-inquiry', label: 'Public Inquiry', icon: ClipboardList, keywords: ['public', 'inquiry'] },
      { id: 'req-reports-analytics', label: 'Reports & Analytics', icon: ClipboardList, keywords: ['analytics', 'report analytics'] },
      { id: 'req-e-session-signature', label: 'E-Session & eSig', icon: ClipboardList, keywords: ['e-session requirements', 'esig requirements'] },
    ],
  },
];

export function findNavItem(tab: string) {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((entry) => entry.id === tab);
    if (item) return { group, item };
  }
  return null;
}
