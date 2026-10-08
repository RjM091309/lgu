import { NAV_GROUPS, type NavGroup } from '@/lib/navigation';
import { getEnabledModules, useEnabledModules } from '@/lib/esession-sync';

// The client asked for e-sessions and keeping the record (transcriptions) of sessions. The rest of the Staff
// Portal, built from the full LIMS requirements, is kept as optional modules: hidden by default (sidebar, links,
// search, roles, dashboards), and an Administrator can turn each back on from the Control Panel, for every device
// until the server restarts. Nothing is deleted, so turning one on brings back the module as it was.

export interface OptionalModule {
  id: string;
  label: string;
  description: string;
  /** Pages (nav ids) that belong to the module. */
  pages: string[];
}

export const OPTIONAL_MODULES: OptionalModule[] = [
  {
    id: 'legislation',
    label: 'Legislative Tracking',
    description: 'Ordinances and resolutions by stage, with the special legislative files (Executive Legislative Agenda, programs, subject index) on Members & Committees.',
    pages: ['manage-legislation'],
  },
  { id: 'transactions', label: 'Transaction Operations', description: 'Receiving, routing, approval and transmittal of documents.', pages: ['manage-transactions'] },
  { id: 'archive', label: 'Archives', description: 'Enacted ordinances and resolutions by year.', pages: ['archive'] },
  { id: 'esignature', label: 'Electronic Signature', description: 'Signatures of the members present on approved measures.', pages: ['esig-electronic-signature'] },
  {
    id: 'reports',
    label: 'Legislative Reports',
    description: 'Search & listing, statistics & performance, and publication reports. The attendance report stays on either way.',
    pages: ['report-search-listing', 'report-statistical-performance'],
  },
  {
    id: 'requirements',
    label: 'System Requirements',
    description: 'The full LIMS requirements list the portal was planned from (reference, for administrators).',
    pages: ['req-core-modules', 'req-public-inquiry', 'req-reports-analytics', 'req-e-session-signature'],
  },
];

const moduleOfPage = new Map(OPTIONAL_MODULES.flatMap((module) => module.pages.map((page) => [page, module.id] as const)));

/** Whether a page is part of the portal right now: always for the mandated pages, else when its module is on. */
export const isPageOn = (tab: string, enabled: string[] = getEnabledModules()) => {
  const module = moduleOfPage.get(tab);
  return !module || enabled.includes(module);
};

export const isModuleOn = (id: string, enabled: string[] = getEnabledModules()) => enabled.includes(id);

/** Re-renders when an Administrator turns a module on or off; returns the ids turned on. */
export const useModules = () => useEnabledModules();

/** The sidebar groups with the pages turned off left out, and names that fit what is left on each page. */
export const navGroupsFor = (enabled: string[]): NavGroup[] =>
  NAV_GROUPS.map((group) => ({
    ...group,
    // Without the legislative modules, all that is left in that group is the members and committees.
    label: group.id === 'legislative' && !['legislation', 'transactions', 'archive'].some((id) => enabled.includes(id)) ? 'Sanggunian' : group.label,
    items: group.items
      .filter((item) => isPageOn(item.id, enabled))
      .map((item) => {
        if (item.id === 'manage-master-files' && !enabled.includes('legislation')) return { ...item, label: 'Members & Committees' };
        if (item.id === 'report-attendance-publication' && !enabled.includes('reports')) return { ...item, label: 'Attendance' };
        return item;
      }),
  })).filter((group) => group.items.length > 0);

export const useNavGroups = () => navGroupsFor(useModules());

export const findNavItemIn = (groups: NavGroup[], tab: string) => {
  for (const group of groups) {
    const item = group.items.find((entry) => entry.id === tab);
    if (item) return { group, item };
  }
  return null;
};
