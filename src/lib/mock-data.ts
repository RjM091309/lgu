// Sample data for demonstration only. Officials are identified by position, never by name.

export interface Bill {
  id: string;
  title: string;
  number: string;
  status: 'Draft' | 'First Reading' | 'Committee' | 'Second Reading' | 'Third Reading' | 'Passed' | 'Vetoed' | 'Enacted';
  /** Sponsoring SB member, by position (see mockMembers). */
  author: string;
  dateFiled: string;
  category: string;
  description: string;
  classification?: 'Ordinance' | 'Resolution';
  committee?: string;
  subject?: string;
  actionTaken?: string;
  /** Co-sponsoring SB member, by position. */
  coAuthor?: string;
}

export interface Member {
  id: string;
  name: string;
  role: string;
  position: string;
  seat: 'Presiding Officer' | 'At-large' | 'Ex-officio';
  abbr: string;
  avatar?: string;
}

export interface Session {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  /** A Meeting is informal (a caucus, briefing or coordination meeting): not an official session of the body. */
  type: 'Regular' | 'Special' | 'Committee Hearing' | 'Meeting';
  /** For committee hearings: the committee conducting it (see mockCommittees). */
  committeeId?: string;
  /** For special sessions: the matter it was called for, as stated in the notice (LGC Sec. 52). */
  purpose?: string;
  /** For meetings: who is invited (`member:m1`, `user:USR-001`), chosen when it is set up. */
  invitees?: string[];
  /** For meetings: the topics to take up, if any were given. */
  agenda?: string[];
}

export interface Committee {
  id: string;
  name: string;
  lead: string;
}

export const LGU_PROFILE = {
  legislature: 'LIMS',
  /** The body named on official documents (PDF letterheads). */
  legislativeBody: 'Sangguniang Bayan of Capas',
  municipality: 'Municipality of Capas',
  province: 'Tarlac',
  systemName: 'Legislative Information Management System',
  founded: 1712,
  barangayCount: 20,
  address: 'Capas Municipal Hall, Capas, Tarlac 2315',
  sessionHall: 'SB Session Hall, Capas Municipal Hall',
  email: 'info@capas.gov.ph',
  viber: '+63 925 015 4000',
};

export const BARANGAYS = [
  'Aranguren',
  'Bueno',
  'Cristo Rey',
  'Cubcub',
  'Cut-Cut I',
  'Cut-Cut II',
  'Dolores',
  'Estrada',
  'Lawy',
  'Manga',
  'Manlapig',
  'Maruglu',
  "O'Donnell",
  'Sta. Juliana',
  'Sta. Lucia',
  'Sta. Rita',
  'Sto. Domingo 1st',
  'Sto. Domingo 2nd',
  'Sto. Rosario',
  'Talaga',
];

export const mockCommittees: Committee[] = [
  { id: 'c1', name: 'Committee on Finance, Budget and Appropriations', lead: 'Chairperson' },
  { id: 'c2', name: 'Committee on Tourism, Culture and Heritage', lead: 'Chairperson' },
  { id: 'c3', name: 'Committee on Health and Social Welfare', lead: 'Chairperson' },
  { id: 'c4', name: 'Committee on Education', lead: 'Chairperson' },
  { id: 'c5', name: 'Committee on Public Works and Infrastructure', lead: 'Chairperson' },
  { id: 'c6', name: 'Committee on Agriculture', lead: 'Chairperson' },
  { id: 'c7', name: 'Committee on Peace and Order and Public Safety', lead: 'Chairperson' },
  { id: 'c8', name: 'Committee on Environment and Natural Resources', lead: 'Chairperson' },
  { id: 'c9', name: 'Committee on Transportation', lead: 'Chairperson' },
];

export const mockBills: Bill[] = [
  {
    id: '1',
    title: 'An Ordinance Regulating the Operation of Tricycles-for-Hire and Prescribing Fare Rates in the Municipality of Capas',
    number: 'Prop. Ord. No. 2026-P-012',
    status: 'Committee',
    author: 'Municipal Councilor (3rd)',
    dateFiled: '2026-08-04',
    category: 'Transportation',
    description: 'Sets franchising requirements, route zoning, and a fare matrix for tricycles-for-hire operating within the 20 barangays of Capas.',
    classification: 'Ordinance',
    committee: 'Committee on Transportation',
    subject: 'Tricycle Franchising',
    actionTaken: 'Referred to committee; public hearing scheduled',
    coAuthor: 'Municipal Councilor (6th)',
  },
  {
    id: '2',
    title: 'An Ordinance Establishing Safety Standards and Environmental Fees for Mt. Pinatubo Trekking and 4x4 Tour Operations',
    number: 'Prop. Ord. No. 2026-P-015',
    status: 'Second Reading',
    author: 'Municipal Councilor (2nd)',
    dateFiled: '2026-07-14',
    category: 'Tourism',
    description: 'Requires accreditation of tour operators and guides, mandatory safety briefings, and an environmental fee for visitors to the Mt. Pinatubo crater trail.',
    classification: 'Ordinance',
    committee: 'Committee on Tourism, Culture and Heritage',
    subject: 'Mt. Pinatubo Tourism',
    actionTaken: 'Approved on second reading',
    coAuthor: 'IPMR Representative',
  },
  {
    id: '3',
    title: 'An Ordinance Declaring the Capas National Shrine Environs as a Heritage Protection Zone',
    number: 'Mun. Ord. No. 2026-005',
    status: 'Enacted',
    author: 'Municipal Councilor (2nd)',
    dateFiled: '2026-02-09',
    category: 'Tourism',
    description: 'Regulates signage, vending, and new construction within the buffer zone of the Capas National Shrine to preserve the site of the Bataan Death March memorial.',
    classification: 'Ordinance',
    committee: 'Committee on Tourism, Culture and Heritage',
    subject: 'Heritage Conservation',
    actionTaken: 'Enacted; approved by the Municipal Mayor',
  },
  {
    id: '4',
    title: 'An Ordinance Appropriating Supplemental Funds for Barangay Disaster Preparedness Equipment',
    number: 'Mun. Ord. No. 2026-007',
    status: 'Passed',
    author: 'Municipal Councilor (1st)',
    dateFiled: '2026-05-18',
    category: 'Finance',
    description: 'Appropriates supplemental funds for rescue equipment and early-warning devices for flood-prone barangays along the O\'Donnell and Bulsa rivers.',
    classification: 'Ordinance',
    committee: 'Committee on Finance, Budget and Appropriations',
    subject: 'Disaster Risk Reduction',
    actionTaken: 'Approved on third reading; transmitted to the Municipal Mayor',
    coAuthor: 'ABC President',
  },
  {
    id: '5',
    title: 'An Ordinance Institutionalizing the Capas Municipal Scholarship Program',
    number: 'Mun. Ord. No. 2025-018',
    status: 'Enacted',
    author: 'Municipal Councilor (5th)',
    dateFiled: '2025-09-22',
    category: 'Education',
    description: 'Establishes qualifications, benefits, and a selection board for college scholarships for deserving Capaseño students.',
    classification: 'Ordinance',
    committee: 'Committee on Education',
    subject: 'Scholarship',
    actionTaken: 'Enacted; published and posted',
    coAuthor: 'SK Federation President',
  },
  {
    id: '6',
    title: 'An Ordinance Revising the Rental Rates of Stalls at the Capas Public Market',
    number: 'Prop. Ord. No. 2026-P-018',
    status: 'First Reading',
    author: 'Municipal Councilor (1st)',
    dateFiled: '2026-09-01',
    category: 'Finance',
    description: 'Updates monthly stall rental rates and payment terms for the Capas Public Market following the market redevelopment.',
    classification: 'Ordinance',
    committee: 'Committee on Finance, Budget and Appropriations',
    subject: 'Public Market',
    actionTaken: 'Filed; for first reading',
  },
  {
    id: '7',
    title: 'An Ordinance Strengthening the Anti-Littering and Solid Waste Segregation Program',
    number: 'Prop. Ord. No. 2026-P-020',
    status: 'Draft',
    author: 'Municipal Councilor (4th)',
    dateFiled: '2026-09-15',
    category: 'Environment',
    description: 'Amends penalties for littering and requires segregation at source for households and establishments, in line with RA 9003.',
    classification: 'Ordinance',
    committee: 'Committee on Environment and Natural Resources',
    subject: 'Solid Waste Management',
    actionTaken: 'Draft under review by the Secretariat',
  },
  {
    id: '8',
    title: 'Resolution Endorsing the Proposed Access Road Linking Barangay Sta. Lucia to New Clark City',
    number: 'SB Res. No. 2026-041',
    status: 'Passed',
    author: 'Municipal Councilor (7th)',
    dateFiled: '2026-06-02',
    category: 'Public Works',
    description: 'Endorses to the national government the construction of an access road to improve mobility between Capas barangays and New Clark City.',
    classification: 'Resolution',
    committee: 'Committee on Public Works and Infrastructure',
    subject: 'Road Infrastructure',
    actionTaken: 'Adopted; copies furnished to concerned agencies',
    coAuthor: 'ABC President',
  },
  {
    id: '9',
    title: 'Resolution Requesting the Provincial Agriculture Office to Extend Seed and Fertilizer Assistance to Capas Farmers',
    number: 'SB Res. No. 2026-038',
    status: 'Passed',
    author: 'Municipal Councilor (8th)',
    dateFiled: '2026-05-25',
    category: 'Agriculture',
    description: 'Requests additional seed and fertilizer support for rice and vegetable farmers affected by the dry season.',
    classification: 'Resolution',
    committee: 'Committee on Agriculture',
    subject: 'Farmer Assistance',
    actionTaken: 'Adopted; transmitted to the Provincial Agriculture Office',
  },
  {
    id: '10',
    title: 'Resolution Authorizing the Municipal Mayor to Enter into a Memorandum of Agreement for Rural Health Unit Laboratory Services',
    number: 'SB Res. No. 2026-044',
    status: 'Third Reading',
    author: 'Municipal Councilor (6th)',
    dateFiled: '2026-08-11',
    category: 'Health',
    description: 'Grants authority to enter into an agreement with an accredited laboratory to expand diagnostic services at the Rural Health Unit.',
    classification: 'Resolution',
    committee: 'Committee on Health and Social Welfare',
    subject: 'Health Services',
    actionTaken: 'For final deliberation',
  },
];

export const mockMembers: Member[] = [
  { id: 'm1', name: 'Municipal Vice Mayor', role: 'Presiding Officer', position: 'Municipal Vice Mayor', seat: 'Presiding Officer', abbr: 'VM' },
  { id: 'm2', name: 'Municipal Councilor (1st)', role: 'SB Member', position: 'Municipal Councilor', seat: 'At-large', abbr: 'MC1' },
  { id: 'm3', name: 'Municipal Councilor (2nd)', role: 'SB Member', position: 'Municipal Councilor', seat: 'At-large', abbr: 'MC2' },
  { id: 'm4', name: 'Municipal Councilor (3rd)', role: 'SB Member', position: 'Municipal Councilor', seat: 'At-large', abbr: 'MC3' },
  { id: 'm5', name: 'Municipal Councilor (4th)', role: 'SB Member', position: 'Municipal Councilor', seat: 'At-large', abbr: 'MC4' },
  { id: 'm6', name: 'Municipal Councilor (5th)', role: 'SB Member', position: 'Municipal Councilor', seat: 'At-large', abbr: 'MC5' },
  { id: 'm7', name: 'Municipal Councilor (6th)', role: 'SB Member', position: 'Municipal Councilor', seat: 'At-large', abbr: 'MC6' },
  { id: 'm8', name: 'Municipal Councilor (7th)', role: 'SB Member', position: 'Municipal Councilor', seat: 'At-large', abbr: 'MC7' },
  { id: 'm9', name: 'Municipal Councilor (8th)', role: 'SB Member', position: 'Municipal Councilor', seat: 'At-large', abbr: 'MC8' },
  { id: 'm10', name: 'IPMR Representative', role: 'Ex-officio SB Member', position: 'Indigenous Peoples Mandatory Representative', seat: 'Ex-officio', abbr: 'IP' },
  { id: 'm11', name: 'ABC President', role: 'Ex-officio SB Member', position: 'Liga ng mga Barangay President', seat: 'Ex-officio', abbr: 'ABC' },
  { id: 'm12', name: 'SK Federation President', role: 'Ex-officio SB Member', position: 'Sangguniang Kabataan Federation President', seat: 'Ex-officio', abbr: 'SK' },
];

// Monthly totals of measures filed and approved by the SB (sample figures for the dashboard trend).
export const mockMonthlyActivity = [
  { month: 'Jan', filed: 6, approved: 3 },
  { month: 'Feb', filed: 4, approved: 4 },
  { month: 'Mar', filed: 7, approved: 3 },
  { month: 'Apr', filed: 5, approved: 5 },
  { month: 'May', filed: 8, approved: 4 },
  { month: 'Jun', filed: 6, approved: 6 },
  { month: 'Jul', filed: 9, approved: 5 },
  { month: 'Aug', filed: 7, approved: 7 },
  { month: 'Sep', filed: 8, approved: 6 },
];

// Yearly performance; 2026 is year-to-date (Jan–Sep) and its filed/approved match mockMonthlyActivity.
export const mockYearlyActivity = [
  { year: '2023', filed: 58, approved: 41, sessionsHeld: 46, sessionsPlanned: 48, quorumRate: 91, avgDaysToApprove: 74, publishedOnTime: 82 },
  { year: '2024', filed: 64, approved: 47, sessionsHeld: 47, sessionsPlanned: 48, quorumRate: 94, avgDaysToApprove: 66, publishedOnTime: 88 },
  { year: '2025', filed: 71, approved: 52, sessionsHeld: 48, sessionsPlanned: 48, quorumRate: 96, avgDaysToApprove: 58, publishedOnTime: 93 },
  { year: '2026', filed: 60, approved: 43, sessionsHeld: 35, sessionsPlanned: 36, quorumRate: 97, avgDaysToApprove: 52, publishedOnTime: 95 },
];

// Committee hearings held per month, January–September 2026.
export const mockCommitteeHearings = [
  { committee: 'Finance, Budget and Appropriations', monthly: [2, 3, 2, 4, 3, 2, 3, 4, 5] },
  { committee: 'Tourism, Culture and Heritage', monthly: [1, 2, 1, 1, 3, 2, 2, 1, 2] },
  { committee: 'Transportation', monthly: [1, 0, 2, 1, 1, 2, 3, 2, 3] },
  { committee: 'Health and Social Welfare', monthly: [1, 1, 1, 2, 2, 1, 1, 2, 1] },
  { committee: 'Public Works and Infrastructure', monthly: [0, 1, 2, 1, 0, 2, 1, 1, 2] },
  { committee: 'Environment and Natural Resources', monthly: [1, 0, 1, 1, 2, 1, 0, 1, 1] },
  { committee: 'Agriculture', monthly: [0, 1, 1, 0, 1, 1, 2, 1, 0] },
  { committee: 'Education', monthly: [1, 0, 0, 1, 1, 0, 1, 0, 1] },
];


export const mockSessions: Session[] = [
  {
    id: 's1',
    title: '38th Regular Session',
    date: '2026-10-05',
    time: '09:00 AM',
    location: LGU_PROFILE.sessionHall,
    type: 'Regular',
  },
  {
    id: 's2',
    title: 'Public Hearing: Tricycle Franchising Ordinance',
    date: '2026-10-07',
    time: '02:00 PM',
    location: LGU_PROFILE.sessionHall,
    type: 'Committee Hearing',
    committeeId: 'c9',
  },
];

const CONFERENCE_ROOM = 'SB Conference Room, Capas Municipal Hall';
const ALL_MEMBERS = Array.from({ length: 12 }, (_, index) => `member:m${index + 1}`);
const SECRETARIAT = ['user:USR-001', 'user:USR-002', 'user:USR-003', 'user:USR-005'];

/**
 * The calendar from October 14 to November 30: weekly regular sessions (Mondays; Bonifacio Day skipped),
 * the budget special session, hearings on measures already filed, and informal meetings. Unlike the sessions
 * above they can be edited and cancelled in the app; the LIMS server loads them at every start, so a restart
 * brings back these originals (and drops whatever was scheduled during a demo).
 */
export const mockSeededSessions: Session[] = [
  {
    id: 'mt1',
    title: 'Caucus on the Proposed 2027 Annual Budget',
    date: '2026-10-14',
    time: '10:00 AM',
    location: CONFERENCE_ROOM,
    type: 'Meeting',
    invitees: [...ALL_MEMBERS, 'user:USR-001', 'user:USR-002'],
    agenda: ['Briefing by the Municipal Budget Officer', 'Questions from the members', 'Order of consideration at the special session'],
  },
  {
    id: 's3',
    title: 'Special Session on the 2027 Annual Budget',
    date: '2026-10-16',
    time: '09:00 AM',
    location: LGU_PROFILE.sessionHall,
    type: 'Special',
    purpose: 'Consideration of the Proposed 2027 Annual Budget of the Municipality of Capas',
  },
  { id: 's39', title: '39th Regular Session', date: '2026-10-19', time: '09:00 AM', location: LGU_PROFILE.sessionHall, type: 'Regular' },
  { id: 'h1', title: 'Public Hearing: Proposed 2027 Annual Budget', date: '2026-10-21', time: '02:00 PM', location: LGU_PROFILE.sessionHall, type: 'Committee Hearing', committeeId: 'c1' },
  {
    id: 'mt2',
    title: 'Coordination Meeting with the MDRRMO on Typhoon Season Preparedness',
    date: '2026-10-22',
    time: '02:00 PM',
    location: 'MDRRMO Operations Center, Capas Municipal Hall',
    type: 'Meeting',
    invitees: ['member:m1', 'member:m8', 'member:m3', 'member:m6', 'member:m12', 'user:USR-001', 'user:USR-004'],
    agenda: ['Status of barangay disaster preparedness equipment', 'Evacuation centers and pre-emptive evacuation plan', 'Requests for legislative support'],
  },
  { id: 's40', title: '40th Regular Session', date: '2026-10-26', time: '09:00 AM', location: LGU_PROFILE.sessionHall, type: 'Regular' },
  { id: 'h2', title: 'Public Hearing: Tricycle Fare Rates (Second Hearing)', date: '2026-10-28', time: '02:00 PM', location: LGU_PROFILE.sessionHall, type: 'Committee Hearing', committeeId: 'c9' },
  {
    id: 'mt3',
    title: 'Secretariat Coordination: Sessions and Records during Undas',
    date: '2026-10-29',
    time: '10:00 AM',
    location: CONFERENCE_ROOM,
    type: 'Meeting',
    invitees: SECRETARIAT,
    agenda: ['Preparations for the 41st Regular Session on November 2', 'Records Section duty schedule'],
  },
  { id: 's41', title: '41st Regular Session', date: '2026-11-02', time: '09:00 AM', location: LGU_PROFILE.sessionHall, type: 'Regular' },
  {
    id: 'mt4',
    title: 'Briefing on the 2027 Local Development Investment Program',
    date: '2026-11-05',
    time: '02:00 PM',
    location: CONFERENCE_ROOM,
    type: 'Meeting',
    invitees: [...ALL_MEMBERS, 'user:USR-001', 'user:USR-002'],
    agenda: ['Presentation by the Municipal Planning and Development Coordinator', 'Open forum'],
  },
  { id: 's42', title: '42nd Regular Session', date: '2026-11-09', time: '09:00 AM', location: LGU_PROFILE.sessionHall, type: 'Regular' },
  { id: 'h3', title: 'Public Hearing: Capas Municipal Scholarship Program', date: '2026-11-11', time: '10:00 AM', location: LGU_PROFILE.sessionHall, type: 'Committee Hearing', committeeId: 'c4' },
  {
    id: 'mt5',
    title: 'Committee Caucus on the Tricycle Fare Rates Report',
    date: '2026-11-13',
    time: '10:00 AM',
    location: CONFERENCE_ROOM,
    type: 'Meeting',
    invitees: ['member:m3', 'member:m8', 'member:m5', 'member:m11', 'user:USR-001', 'user:USR-004'],
    agenda: ['Summary of the two public hearings', 'Draft committee report and recommended fare matrix'],
  },
  { id: 's43', title: '43rd Regular Session', date: '2026-11-16', time: '09:00 AM', location: LGU_PROFILE.sessionHall, type: 'Regular' },
  { id: 'h4', title: 'Public Hearing: Anti-Littering and Solid Waste Segregation Program', date: '2026-11-18', time: '02:00 PM', location: LGU_PROFILE.sessionHall, type: 'Committee Hearing', committeeId: 'c8' },
  { id: 's44', title: '44th Regular Session', date: '2026-11-23', time: '09:00 AM', location: LGU_PROFILE.sessionHall, type: 'Regular' },
  {
    id: 'mt6',
    title: 'Secretariat Year-End Records Review',
    date: '2026-11-25',
    time: '10:00 AM',
    location: CONFERENCE_ROOM,
    type: 'Meeting',
    invitees: SECRETARIAT,
    agenda: ['Status of minutes and journals for 2026', 'Session Files still incomplete', 'Archiving schedule for December'],
  },
];

// Sessions and hearings already held (June–September 2026), shown on the calendars as completed.
// The regular and special sessions from July on are the ones in the attendance register below.
const pastSession = (id: string, title: string, date: string, type: Session['type'], time = '09:00 AM', committeeId?: string): Session => ({
  id,
  title,
  date,
  time,
  location: LGU_PROFILE.sessionHall,
  type,
  committeeId,
});

export const mockPastSessions: Session[] = [
  pastSession('ps26', '26th Regular Session', '2026-06-08', 'Regular'),
  pastSession('ps27', '27th Regular Session', '2026-06-15', 'Regular'),
  pastSession('ph1', 'Public Hearing: Mt. Pinatubo Trekking and 4x4 Tour Safety Standards', '2026-06-18', 'Committee Hearing', '02:00 PM', 'c2'),
  pastSession('ps28', '28th Regular Session', '2026-06-22', 'Regular'),
  pastSession('ps29', '29th Regular Session', '2026-06-29', 'Regular'),
  pastSession('ps30', '30th Regular Session', '2026-07-06', 'Regular'),
  pastSession('ph2', 'Public Hearing: Capas National Shrine Heritage Protection Zone', '2026-07-09', 'Committee Hearing', '02:00 PM', 'c2'),
  pastSession('ps31', '31st Regular Session', '2026-07-13', 'Regular'),
  pastSession('ph3', 'Public Hearing: Supplemental Funds for Barangay Disaster Preparedness Equipment', '2026-07-16', 'Committee Hearing', '10:00 AM', 'c1'),
  pastSession('ps32', '32nd Regular Session', '2026-07-20', 'Regular'),
  { ...pastSession('psp1', 'Special Session on Supplemental Budget No. 1', '2026-07-24', 'Special'), purpose: 'Consideration of Supplemental Budget No. 1 for Calendar Year 2026' },
  pastSession('ps33', '33rd Regular Session', '2026-08-03', 'Regular'),
  pastSession('ph4', 'Public Hearing: Access Road Linking Barangay Sta. Lucia to New Clark City', '2026-08-12', 'Committee Hearing', '02:00 PM', 'c5'),
  pastSession('ps34', '34th Regular Session', '2026-08-17', 'Regular'),
  pastSession('ps35', '35th Regular Session', '2026-08-24', 'Regular'),
  pastSession('ph5', 'Public Hearing: RHU Laboratory Services Memorandum of Agreement', '2026-08-26', 'Committee Hearing', '02:00 PM', 'c3'),
  pastSession('ps36', '36th Regular Session', '2026-09-07', 'Regular'),
  pastSession('ph6', 'Public Hearing: Revised Stall Rental Rates at the Capas Public Market', '2026-09-09', 'Committee Hearing', '10:00 AM', 'c1'),
  pastSession('ph7', 'Public Hearing: Tricycle Fare Rates (First Hearing)', '2026-09-16', 'Committee Hearing', '02:00 PM', 'c9'),
  pastSession('ps37', '37th Regular Session', '2026-09-21', 'Regular'),
];

export interface SessionDevice {
  name: string;
  type: string;
  status: 'Connected' | 'Pending' | 'Disconnected';
  lastSync: string;
}

export const mockSessionDevices: SessionDevice[] = [
  { name: 'Session Hall Tablet A', type: 'Tablet', status: 'Connected', lastSync: '10:12 AM' },
  { name: 'Session Hall Tablet B', type: 'Tablet', status: 'Disconnected', lastSync: '09:41 AM' },
  { name: 'Presiding Officer iPad', type: 'iPad', status: 'Connected', lastSync: '10:10 AM' },
  { name: 'Secretary Console', type: 'Laptop', status: 'Pending', lastSync: '09:58 AM' },
];

/* Attendance register: roll call for recent sessions. P = present, L = late, A = absent. */
export type AttendanceMark = 'P' | 'L' | 'A';

export const mockAttendanceSessions = [
  { id: 'as30', label: '30th Regular', short: '30th', date: '2026-07-06', type: 'Regular' },
  { id: 'as31', label: '31st Regular', short: '31st', date: '2026-07-13', type: 'Regular' },
  { id: 'as32', label: '32nd Regular', short: '32nd', date: '2026-07-20', type: 'Regular' },
  { id: 'asp1', label: 'Special Session', short: 'Special', date: '2026-07-24', type: 'Special' },
  { id: 'as33', label: '33rd Regular', short: '33rd', date: '2026-08-03', type: 'Regular' },
  { id: 'as34', label: '34th Regular', short: '34th', date: '2026-08-17', type: 'Regular' },
  { id: 'as35', label: '35th Regular', short: '35th', date: '2026-08-24', type: 'Regular' },
  { id: 'as36', label: '36th Regular', short: '36th', date: '2026-09-07', type: 'Regular' },
  { id: 'as37', label: '37th Regular', short: '37th', date: '2026-09-21', type: 'Regular' },
];

// One mark per session above, in order; keyed by member id.
export const mockAttendanceMarks: Record<string, string> = {
  m1: 'PPPPPPPPP',
  m2: 'PPPAPPPPP',
  m3: 'PLPAPPPPP',
  m4: 'PPPPPAPPP',
  m5: 'PPAAPPLPP',
  m6: 'PPPAPPPPA',
  m7: 'LPPAPPPPP',
  m8: 'PPPPPPAPP',
  m9: 'PAPAPPPPP',
  m10: 'APPAPLPPP',
  m11: 'PPPPAPPAP',
  m12: 'PPAAPPPPP',
};

/* Publication tracker: posting and effectivity of approved ordinances. */
export interface PublicationRecord {
  number: string;
  title: string;
  approvedOn: string;
  postedOn: string | null;
  placesPosted: number;
  penalClause: boolean;
  newspaperOn: string | null;
}

export const mockPublications: PublicationRecord[] = [
  { number: 'Mun. Ord. No. 2026-002', title: "An Ordinance Establishing the Capas Farmers' Weekend Market", approvedOn: '2026-08-03', postedOn: '2026-08-05', placesPosted: 3, penalClause: false, newspaperOn: null },
  { number: 'Mun. Ord. No. 2026-004', title: 'An Ordinance Imposing Fines for Illegal Parking along the Capas–Patling Road', approvedOn: '2026-08-10', postedOn: '2026-08-13', placesPosted: 3, penalClause: true, newspaperOn: '2026-08-20' },
  { number: 'Mun. Ord. No. 2026-003', title: 'An Ordinance Regulating the Use of Videoke and Sound Systems during Night Hours', approvedOn: '2026-09-08', postedOn: null, placesPosted: 0, penalClause: true, newspaperOn: null },
  { number: 'Mun. Ord. No. 2026-006', title: 'An Ordinance Prohibiting Single-Use Plastics in the Capas Public Market', approvedOn: '2026-09-14', postedOn: '2026-09-16', placesPosted: 3, penalClause: true, newspaperOn: '2026-09-23' },
  { number: 'Mun. Ord. No. 2026-005', title: 'An Ordinance Declaring the Capas National Shrine Environs as a Heritage Protection Zone', approvedOn: '2026-09-21', postedOn: '2026-09-24', placesPosted: 2, penalClause: true, newspaperOn: null },
  { number: 'Mun. Ord. No. 2026-007', title: 'An Ordinance Appropriating Supplemental Funds for Barangay Disaster Preparedness Equipment', approvedOn: '2026-09-22', postedOn: null, placesPosted: 0, penalClause: false, newspaperOn: null },
];

/* Committee composition: member ids from mockMembers. */
export const mockCommitteeAssignments: Record<string, { chair: string; viceChair: string; members: string[] }> = {
  c1: { chair: 'm2', viceChair: 'm4', members: ['m6', 'm11'] },
  c2: { chair: 'm3', viceChair: 'm7', members: ['m10', 'm12'] },
  c3: { chair: 'm4', viceChair: 'm9', members: ['m5', 'm11'] },
  c4: { chair: 'm5', viceChair: 'm12', members: ['m3', 'm8'] },
  c5: { chair: 'm6', viceChair: 'm2', members: ['m9', 'm11'] },
  c6: { chair: 'm7', viceChair: 'm11', members: ['m4', 'm10'] },
  c7: { chair: 'm8', viceChair: 'm3', members: ['m6', 'm12'] },
  c8: { chair: 'm9', viceChair: 'm10', members: ['m2', 'm7'] },
  c9: { chair: 'm3', viceChair: 'm8', members: ['m5', 'm11'] },
};

/* Special legislative files kept by the Secretariat. */
export const mockSpecialFiles = [
  { id: 'sf1', title: 'Executive Legislative Agenda', detail: 'Priority legislation per session cycle, 2025–2028', count: 14, unit: 'documents', updated: '2026-09-18', custodian: 'SB Secretariat' },
  { id: 'sf2', title: 'Programs and Projects File', detail: 'Programs and projects recorded in LIMS', count: 32, unit: 'documents', updated: '2026-09-10', custodian: 'Office of the SB Secretary' },
  { id: 'sf3', title: 'Subject Matter Index', detail: 'Subject listing and codification references', count: 486, unit: 'entries', updated: '2026-08-29', custodian: 'Records Section' },
];
