export interface Bill {
  id: string;
  title: string;
  number: string;
  status: 'Draft' | 'First Reading' | 'Committee' | 'Second Reading' | 'Third Reading' | 'Passed' | 'Vetoed' | 'Enacted';
  author: string;
  dateFiled: string;
  category: string;
  description: string;
}

export interface Member {
  id: string;
  name: string;
  role: string;
  party: string;
  district: string;
  avatar: string;
}

export interface Session {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  type: 'Regular' | 'Special' | 'Committee Hearing';
}

export const mockBills: Bill[] = [
  {
    id: '1',
    title: 'Digital Transformation Act of 2024',
    number: 'HB-1024',
    status: 'Committee',
    author: 'Hon. Maria Santos',
    dateFiled: '2024-03-15',
    category: 'Technology',
    description: 'An act to modernize government services through digital infrastructure and cybersecurity enhancements.'
  },
  {
    id: '2',
    title: 'Sustainable Agriculture Initiative',
    number: 'SB-056',
    status: 'Second Reading',
    author: 'Sen. Robert Chen',
    dateFiled: '2024-02-10',
    category: 'Environment',
    description: 'Providing subsidies and technical support for small-scale farmers adopting organic farming methods.'
  },
  {
    id: '3',
    title: 'Universal Healthcare Expansion Bill',
    number: 'HB-2045',
    status: 'Passed',
    author: 'Hon. James Wilson',
    dateFiled: '2024-01-20',
    category: 'Health',
    description: 'Expanding coverage for mental health services and prescription drugs under the national health program.'
  },
  {
    id: '4',
    title: 'Public Transportation Modernization',
    number: 'HB-3012',
    status: 'First Reading',
    author: 'Hon. Elena Rodriguez',
    dateFiled: '2024-04-01',
    category: 'Infrastructure',
    description: 'Funding for electric bus fleets and expansion of light rail systems in metropolitan areas.'
  },
  {
    id: '5',
    title: 'Education Equity Act',
    number: 'SB-112',
    status: 'Enacted',
    author: 'Sen. Sarah Thompson',
    dateFiled: '2023-11-15',
    category: 'Education',
    description: 'Ensuring equal funding distribution across all public school districts regardless of local property tax revenue.'
  }
];

export const mockMembers: Member[] = [
  {
    id: 'm1',
    name: 'Hon. Maria Santos',
    role: 'Speaker of the House',
    party: 'Progressive Party',
    district: 'District 1',
    avatar: 'https://i.pravatar.cc/150?u=m1'
  },
  {
    id: 'm2',
    name: 'Sen. Robert Chen',
    role: 'Senate President',
    party: 'Liberal Alliance',
    district: 'Statewide',
    avatar: 'https://i.pravatar.cc/150?u=m2'
  },
  {
    id: 'm3',
    name: 'Hon. James Wilson',
    role: 'Majority Leader',
    party: 'Progressive Party',
    district: 'District 4',
    avatar: 'https://i.pravatar.cc/150?u=m3'
  },
  {
    id: 'm4',
    name: 'Hon. Elena Rodriguez',
    role: 'Member',
    party: 'Conservative Union',
    district: 'District 2',
    avatar: 'https://i.pravatar.cc/150?u=m4'
  }
];

export const mockSessions: Session[] = [
  {
    id: 's1',
    title: 'Regular Plenary Session',
    date: '2024-04-20',
    time: '10:00 AM',
    location: 'Main Hall',
    type: 'Regular'
  },
  {
    id: 's2',
    title: 'Committee on Finance Hearing',
    date: '2024-04-21',
    time: '02:00 PM',
    location: 'Conference Room B',
    type: 'Committee Hearing'
  },
  {
    id: 's3',
    title: 'Special Session on Emergency Relief',
    date: '2024-04-25',
    time: '09:00 AM',
    location: 'Main Hall',
    type: 'Special'
  }
];
