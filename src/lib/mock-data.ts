// Sample data for demonstration only. Officials are identified by position, never by name.

export interface Bill {
  id: string;
  title: string;
  number: string;
  status: 'Draft' | 'First Reading' | 'Committee' | 'Second Reading' | 'Third Reading' | 'Passed' | 'Vetoed' | 'Enacted';
  author: string;
  dateFiled: string;
  category: string;
  description: string;
  classification?: 'Ordinance' | 'Resolution';
  committee?: string;
  subject?: string;
  actionTaken?: string;
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
  type: 'Regular' | 'Special' | 'Committee Hearing';
}

export interface Committee {
  id: string;
  name: string;
  lead: string;
}

export const LGU_PROFILE = {
  legislature: 'Sangguniang Bayan ng Capas',
  municipality: 'Municipality of Capas',
  province: 'Tarlac',
  systemName: 'SB Capas LMIS',
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
    author: 'Committee on Transportation',
    dateFiled: '2026-08-04',
    category: 'Transportation',
    description: 'Sets franchising requirements, route zoning, and a fare matrix for tricycles-for-hire operating within the 20 barangays of Capas.',
    classification: 'Ordinance',
    committee: 'Committee on Transportation',
    subject: 'Tricycle Franchising',
    actionTaken: 'Referred to committee; public hearing scheduled',
    coAuthor: 'Committee on Peace and Order and Public Safety',
  },
  {
    id: '2',
    title: 'An Ordinance Establishing Safety Standards and Environmental Fees for Mt. Pinatubo Trekking and 4x4 Tour Operations',
    number: 'Prop. Ord. No. 2026-P-015',
    status: 'Second Reading',
    author: 'Committee on Tourism, Culture and Heritage',
    dateFiled: '2026-07-14',
    category: 'Tourism',
    description: 'Requires accreditation of tour operators and guides, mandatory safety briefings, and an environmental fee for visitors to the Mt. Pinatubo crater trail.',
    classification: 'Ordinance',
    committee: 'Committee on Tourism, Culture and Heritage',
    subject: 'Mt. Pinatubo Tourism',
    actionTaken: 'Approved on second reading',
    coAuthor: 'Committee on Environment and Natural Resources',
  },
  {
    id: '3',
    title: 'An Ordinance Declaring the Capas National Shrine Environs as a Heritage Protection Zone',
    number: 'Mun. Ord. No. 2026-005',
    status: 'Enacted',
    author: 'Committee on Tourism, Culture and Heritage',
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
    author: 'Committee on Finance, Budget and Appropriations',
    dateFiled: '2026-05-18',
    category: 'Finance',
    description: 'Appropriates supplemental funds for rescue equipment and early-warning devices for flood-prone barangays along the O\'Donnell and Bulsa rivers.',
    classification: 'Ordinance',
    committee: 'Committee on Finance, Budget and Appropriations',
    subject: 'Disaster Risk Reduction',
    actionTaken: 'Approved on third reading; transmitted to the Municipal Mayor',
    coAuthor: 'Committee on Peace and Order and Public Safety',
  },
  {
    id: '5',
    title: 'An Ordinance Institutionalizing the Capas Municipal Scholarship Program',
    number: 'Mun. Ord. No. 2025-018',
    status: 'Enacted',
    author: 'Committee on Education',
    dateFiled: '2025-09-22',
    category: 'Education',
    description: 'Establishes qualifications, benefits, and a selection board for college scholarships for deserving Capaseño students.',
    classification: 'Ordinance',
    committee: 'Committee on Education',
    subject: 'Scholarship',
    actionTaken: 'Enacted; published and posted',
  },
  {
    id: '6',
    title: 'An Ordinance Revising the Rental Rates of Stalls at the Capas Public Market',
    number: 'Prop. Ord. No. 2026-P-018',
    status: 'First Reading',
    author: 'Committee on Finance, Budget and Appropriations',
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
    author: 'Committee on Environment and Natural Resources',
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
    author: 'Committee on Public Works and Infrastructure',
    dateFiled: '2026-06-02',
    category: 'Public Works',
    description: 'Endorses to the national government the construction of an access road to improve mobility between Capas barangays and New Clark City.',
    classification: 'Resolution',
    committee: 'Committee on Public Works and Infrastructure',
    subject: 'Road Infrastructure',
    actionTaken: 'Adopted; copies furnished to concerned agencies',
  },
  {
    id: '9',
    title: 'Resolution Requesting the Provincial Agriculture Office to Extend Seed and Fertilizer Assistance to Capas Farmers',
    number: 'SB Res. No. 2026-038',
    status: 'Passed',
    author: 'Committee on Agriculture',
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
    author: 'Committee on Health and Social Welfare',
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
  },
  {
    id: 's3',
    title: 'Special Session on the 2027 Annual Budget',
    date: '2026-10-16',
    time: '09:00 AM',
    location: LGU_PROFILE.sessionHall,
    type: 'Special',
  },
];
