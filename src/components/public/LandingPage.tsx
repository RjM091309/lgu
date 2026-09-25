import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { DataTable } from '@/components/ui/DataTable';
import { LGU_PROFILE, mockBills, mockCommittees, mockMembers, mockSessions } from '@/lib/mock-data';
import { openPrintWindow, saveFile } from '@/lib/files';
import { addSessionToCalendar, buildAgenda, formatLongDate, printAgenda } from '@/lib/sessions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Search,
  ArrowRight,
  ArrowUp,
  ScrollText,
  FileText,
  CalendarDays,
  CalendarPlus,
  Gavel,
  Lock,
  User,
  LogIn,
  MoreHorizontal,
  Users,
  Landmark,
  Award,
  Menu,
  X,
  Clock,
  MapPin,
  Mail,
  Phone,
  Download,
  Printer,
  Eye,
  FileSearch,
  UserPlus,
  BookOpen,
  Archive,
  ClipboardList,
  ExternalLink,
  ShieldCheck,
  SlidersHorizontal,
  RotateCcw,
  Megaphone,
} from 'lucide-react';
import { motion } from 'motion/react';
import { CompositionChart, committeeRolesOf, shortCommitteeName } from '@/components/members/CompositionChart';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { StatusBadge } from '@/components/ui/status-badge';
import { logActivity } from '@/lib/activity-log';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LandingPageProps {
  onLogin: (remember: boolean) => void;
}

type Lang = 'EN' | 'FIL';

const COPY = {
  EN: {
    nav: {
      home: 'Home',
      legislation: 'Legislation',
      'sangguniang-bayan': 'The Sanggunian',
      'public-sessions': 'Sessions',
      resources: 'Resources',
      news: 'News',
      contact: 'Contact',
    },
    pst: 'Philippine Standard Time',
    staffLogin: 'Staff Login',
    heroKicker: 'Official Legislative Portal',
    heroTitle: 'Transparent and Accessible Local Legislation',
    heroText:
      'Search ordinances and resolutions, follow session schedules, and request legislative documents from the Sangguniang Bayan ng Capas.',
    searchPlaceholder: 'Search ordinances, resolutions, or record numbers',
    search: 'Search',
    services: 'Public Services',
    overview: 'Legislative Records at a Glance',
    legislation: 'Legislation',
    sb: 'The Sangguniang Bayan',
    sessions: 'Sessions and Hearings',
    resources: 'Resources and Forms',
    news: 'News and Announcements',
  },
  FIL: {
    nav: {
      home: 'Tahanan',
      legislation: 'Lehislasyon',
      'sangguniang-bayan': 'Ang Sanggunian',
      'public-sessions': 'Mga Sesyon',
      resources: 'Mga Dokumento',
      news: 'Balita',
      contact: 'Makipag-ugnayan',
    },
    pst: 'Oras sa Pilipinas',
    staffLogin: 'Pag-login ng Kawani',
    heroKicker: 'Opisyal na Portal ng Lehislasyon',
    heroTitle: 'Bukas at Abot-kayang Lokal na Lehislasyon',
    heroText:
      'Maghanap ng mga ordinansa at resolusyon, subaybayan ang iskedyul ng mga sesyon, at humiling ng mga dokumento mula sa Sangguniang Bayan ng Capas.',
    searchPlaceholder: 'Maghanap ng ordinansa, resolusyon, o numero ng rekord',
    search: 'Hanapin',
    services: 'Mga Serbisyong Pampubliko',
    overview: 'Buod ng mga Rekord',
    legislation: 'Lehislasyon',
    sb: 'Ang Sangguniang Bayan',
    sessions: 'Mga Sesyon at Pagdinig',
    resources: 'Mga Dokumento at Porma',
    news: 'Balita at Anunsyo',
  },
} as const;

const NAV_IDS = ['home', 'legislation', 'sangguniang-bayan', 'public-sessions', 'resources', 'news', 'contact'] as const;

const ABOUT_GOVPH_LINKS = [
  { label: 'GOV.PH', href: 'https://www.gov.ph' },
  { label: 'Open Data Portal', href: 'https://data.gov.ph' },
  { label: 'Official Gazette', href: 'https://www.officialgazette.gov.ph' },
];

const GOVERNMENT_LINKS = [
  { label: 'Office of the President', href: 'https://op-proper.gov.ph' },
  { label: 'Office of the Vice President', href: 'https://www.ovp.gov.ph' },
  { label: 'Senate of the Philippines', href: 'https://www.senate.gov.ph' },
  { label: 'House of Representatives', href: 'https://www.congress.gov.ph' },
  { label: 'Supreme Court', href: 'https://sc.judiciary.gov.ph' },
  { label: 'Department of the Interior and Local Government', href: 'https://www.dilg.gov.ph' },
];

const TRANSPARENCY_LINKS = [
  { label: 'Transparency Seal', description: 'Budget, procurement, and performance disclosures', href: 'https://www.capas.gov.ph/transparency-seal', icon: ShieldCheck },
  { label: "Citizen's Charter", description: 'Service standards of the Municipality of Capas', href: 'https://www.capas.gov.ph/citizens-charter', icon: BookOpen },
  { label: 'Freedom of Information', description: 'File an FOI request online', href: 'https://www.foi.gov.ph', icon: FileSearch },
  { label: 'Full Disclosure Policy', description: 'DILG Full Disclosure Policy Portal', href: 'https://fdpp.dilg.gov.ph', icon: Archive },
];

const ACCREDITATION_STATUS: Record<string, string> = {
  'ACC-2026-008': 'For Verification',
  'ACC-2026-005': 'Approved',
  'ACC-2026-002': 'Submitted',
};

type NewsItem = {
  id: string;
  category: string;
  title: string;
  date: string;
  summary: string;
  body: string[];
  icon: typeof Award;
  relatedDocId?: string;
};

const NEWS: NewsItem[] = [
  {
    id: 'news-lla',
    category: 'Recognition',
    title: 'SB Capas Named Regional Winner, Local Legislative Award',
    date: '2022–2025 Term',
    summary: 'The Sangguniang Bayan ng Capas was recognized as Regional Winner of the Local Legislative Award for the 2022–2025 term.',
    body: [
      'The Sangguniang Bayan ng Capas was recognized as Regional Winner of the Local Legislative Award for the 2022–2025 term.',
      'The award recognizes local legislative bodies for the quality of their legislation, the efficiency of their procedures, and their engagement with constituents.',
    ],
    icon: Award,
  },
  {
    id: 'news-hearing',
    category: 'Public Hearing',
    title: 'Public Hearing on the Proposed Tricycle Franchising Ordinance',
    date: 'October 7, 2026',
    summary: 'Tricycle operators, drivers, and commuters are invited to share their views on Prop. Ord. No. 2026-P-012.',
    body: [
      'The Committee on Transportation will conduct a public hearing on Prop. Ord. No. 2026-P-012, an ordinance regulating the operation of tricycles-for-hire and prescribing fare rates in the Municipality of Capas.',
      `The hearing will be held on October 7, 2026 at 2:00 PM at the ${LGU_PROFILE.sessionHall}. Written position papers may be submitted to the Office of the Secretary to the Sanggunian before the hearing.`,
    ],
    icon: Megaphone,
    relatedDocId: 'leg-1',
  },
  {
    id: 'news-heritage',
    category: 'Enacted Ordinance',
    title: 'Capas National Shrine Environs Declared a Heritage Protection Zone',
    date: 'February 2026',
    summary: 'Mun. Ord. No. 2026-005 regulates signage, vending, and new construction within the buffer zone of the Capas National Shrine.',
    body: [
      'Municipal Ordinance No. 2026-005 declares the environs of the Capas National Shrine a Heritage Protection Zone.',
      'The ordinance regulates signage, vending, and new construction within the buffer zone to preserve the memorial site of the Bataan Death March.',
    ],
    icon: Landmark,
    relatedDocId: 'leg-3',
  },
];

export function LandingPage({ onLogin }: LandingPageProps) {
  const [lang, setLang] = useState<Lang>('EN');
  const t = COPY[lang];
  const [now, setNow] = useState(() => new Date());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('home');
  const [heroKeyword, setHeroKeyword] = useState('');

  const [loginOpen, setLoginOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [inquiryKeyword, setInquiryKeyword] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedReferral, setSelectedReferral] = useState('All');
  const [publicMemberId, setPublicMemberId] = useState<string | null>(null);
  const publicMember = mockMembers.find((member) => member.id === publicMemberId) ?? null;
  const [selectedClassification, setSelectedClassification] = useState('All');
  const [selectedAuthorship, setSelectedAuthorship] = useState('All');
  const [selectedActionTaken, setSelectedActionTaken] = useState('All');
  const [selectedSponsor, setSelectedSponsor] = useState('All');
  const [selectedCoAuthor, setSelectedCoAuthor] = useState('All');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [inquiryPage, setInquiryPage] = useState(1);
  const inquiryPageSize = 8;

  const [publicName, setPublicName] = useState('');
  const [publicEmail, setPublicEmail] = useState('');
  const [notifyUpdates, setNotifyUpdates] = useState(true);
  const [registrationNotice, setRegistrationNotice] = useState('');

  const [accreditationQuery, setAccreditationQuery] = useState('');
  const [accreditationResult, setAccreditationResult] = useState<string | null>(null);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestRecord, setRequestRecord] = useState('');
  const [requestPurpose, setRequestPurpose] = useState('Personal reference');
  const [requestError, setRequestError] = useState('');
  const [requestReference, setRequestReference] = useState<string | null>(null);

  const [activePublicDocId, setActivePublicDocId] = useState<string | null>(null);
  const [agendaSessionId, setAgendaSessionId] = useState<string | null>(null);
  const [activeNewsId, setActiveNewsId] = useState<string | null>(null);
  const [policyDialog, setPolicyDialog] = useState<'privacy' | 'terms' | 'accessibility' | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    NAV_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const philippineTime = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);

  const scrollToSection = (id: string) => {
    setMobileNavOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePortalLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    if (!username.trim() || !password) {
      setLoginError('Please enter your username and password.');
      toast('Sign-in failed', 'Please enter your username and password.', 'error');
      return;
    }
    if (username.trim() === 'admin' && password === 'admin123') {
      toast('Signed in', 'Welcome to the SB Capas Legislative Management System.');
      onLogin(rememberMe);
      return;
    }
    setLoginError('Invalid username or password. Please try again.');
    toast('Sign-in failed', 'Invalid username or password. Please try again.', 'error');
  };

  const handlePublicRegistration = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!publicName.trim() || !publicEmail.trim()) {
      setRegistrationNotice('Please provide your full name and email address.');
      toast('Registration not saved', 'Please provide your full name and email address.', 'error');
      return;
    }
    if (!EMAIL_PATTERN.test(publicEmail.trim())) {
      setRegistrationNotice('Please enter a valid email address.');
      toast('Registration not saved', `${publicEmail.trim()} is not a valid email address.`, 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Submit your registration?',
      description: notifyUpdates
        ? `${publicName.trim()} will be registered with ${publicEmail.trim()} and subscribed to legislative updates.`
        : `${publicName.trim()} will be registered with ${publicEmail.trim()}.`,
      confirmLabel: 'Register',
    });
    if (!confirmed) return;
    toast('Registration saved', notifyUpdates ? 'You are now subscribed to legislative updates.' : 'You may enable updates anytime.');
    logActivity({ user: 'public', module: 'Public Portal', action: 'Created', summary: 'Registered on the public portal', detail: notifyUpdates ? 'Subscribed to legislative updates.' : undefined });
    setRegistrationNotice(
      notifyUpdates
        ? 'Registration saved. You are now subscribed to legislative updates.'
        : 'Registration saved. You may enable updates anytime.'
    );
    setPublicName('');
    setPublicEmail('');
    setNotifyUpdates(true);
  };

  const handleAccreditationLookup = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const key = accreditationQuery.trim().toUpperCase();
    if (!key) {
      setAccreditationResult('Please enter a reference number.');
      toast('Lookup failed', 'Please enter a reference number.', 'error');
      return;
    }
    if (ACCREDITATION_STATUS[key]) {
      setAccreditationResult(`${key}: ${ACCREDITATION_STATUS[key]}`);
      toast('Accreditation found', `${key}: ${ACCREDITATION_STATUS[key]}`);
    } else {
      setAccreditationResult(`No accreditation request found for ${key}.`);
      toast('Accreditation not found', `No accreditation request found for ${key}.`, 'error');
    }
  };

  const handleDocumentRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!requestName.trim() || !requestEmail.trim() || !requestRecord.trim()) {
      setRequestError('Please complete your name, email address, and the document requested.');
      toast('Request not submitted', 'Please complete your name, email address, and the document requested.', 'error');
      return;
    }
    if (!EMAIL_PATTERN.test(requestEmail.trim())) {
      setRequestError('Please enter a valid email address.');
      toast('Request not submitted', `${requestEmail.trim()} is not a valid email address.`, 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Submit this document request?',
      description: `A request for "${requestRecord.trim()}" will be sent to the SB Secretariat. Updates will go to ${requestEmail.trim()}.`,
      confirmLabel: 'Submit request',
    });
    if (!confirmed) return;
    const reference = `REQ-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;
    setRequestError('');
    setRequestReference(reference);
    toast('Request submitted', `Your reference number is ${reference}.`);
    logActivity({ user: 'public', module: 'Public Portal', action: 'Created', summary: 'Submitted a certified copy request', detail: `Reference number ${reference}.` });
  };

  const openRequestDialog = (recordNumber = '') => {
    setRequestReference(null);
    setRequestError('');
    setRequestRecord(recordNumber);
    setRequestOpen(true);
  };

  const publicStats = [
    {
      label: 'Ordinances',
      value: '39',
      description: 'Local laws enacted on public safety, revenue, environment, and local governance.',
      icon: ScrollText,
      action: () => applyQuickFilter({ classification: 'Ordinance' }),
      actionLabel: 'Browse ordinances',
    },
    {
      label: 'Resolutions',
      value: '356',
      description: 'Formal expressions of the SB on policy direction, endorsements, and authorizations.',
      icon: FileText,
      action: () => applyQuickFilter({ classification: 'Resolution' }),
      actionLabel: 'Browse resolutions',
    },
    {
      label: 'Sessions Held',
      value: '35',
      description: 'Regular and special sessions where the SB deliberates on proposed measures.',
      icon: CalendarDays,
      action: () => scrollToSection('public-sessions'),
      actionLabel: 'View session calendar',
    },
    {
      label: 'Committee Hearings',
      value: '98',
      description: 'Hearings and consultations conducted before committee recommendations.',
      icon: Gavel,
      action: () => scrollToSection('public-sessions'),
      actionLabel: 'View hearings',
    },
  ];

  type PublicInquiryRecord = {
    id: string;
    recordType: 'Legislation' | 'Incoming Document' | 'Resource';
    number: string;
    title: string;
    status: string;
    category: string;
    author: string;
    subject: string;
    referral: string;
    classification: string;
    actionTaken: string;
    authorshipType: 'Author' | 'Co-author' | 'Sponsor';
    sponsor?: string;
    coAuthor?: string;
    date: string;
    bodyPreview: string;
  };

  const publicLegislationRecords: PublicInquiryRecord[] = useMemo(
    () =>
      mockBills.map((bill) => ({
        id: `leg-${bill.id}`,
        recordType: 'Legislation',
        number: bill.number,
        title: bill.title,
        status: bill.status,
        category: bill.category,
        author: bill.author,
        subject: bill.subject ?? bill.category,
        referral: bill.committee ?? 'SB Secretariat',
        classification: bill.classification ?? 'Ordinance',
        actionTaken: bill.actionTaken ?? 'Under review',
        authorshipType: bill.coAuthor ? 'Co-author' : 'Author',
        sponsor: bill.committee ?? bill.author,
        coAuthor: bill.coAuthor ?? '',
        date: bill.dateFiled,
        bodyPreview: `Public summary for ${bill.number}: ${bill.description}`,
      })),
    []
  );

  const publicInquiryDocs: PublicInquiryRecord[] = [
    {
      id: 'doc-1',
      number: 'TR-2026-014',
      title: 'Transmittal: Committee Report on the Tricycle Franchising Ordinance',
      status: 'Received',
      category: 'Transmittal',
      author: 'Office of the Secretary to the Sanggunian',
      recordType: 'Incoming Document',
      subject: 'Tricycle Franchising',
      referral: 'Committee on Transportation',
      classification: 'Transmittal Letter',
      actionTaken: 'Acknowledged / For filing',
      authorshipType: 'Sponsor',
      sponsor: 'Office of the Secretary to the Sanggunian',
      coAuthor: '',
      date: '2026-09-10',
      bodyPreview: 'Transmittal cover letter and committee report attachments for public reference.',
    },
    {
      id: 'doc-2',
      number: 'IN-2026-032',
      title: 'Incoming Letter: Request for Public Hearing Schedule',
      status: 'Referred',
      category: 'Citizen Inquiry',
      author: 'Capas Tricycle Operators and Drivers Association',
      recordType: 'Incoming Document',
      subject: 'Public Participation',
      referral: 'Office of the Secretary to the Sanggunian',
      classification: 'Incoming Letter',
      actionTaken: 'Referred to committee secretariat',
      authorshipType: 'Author',
      sponsor: 'N/A',
      coAuthor: '',
      date: '2026-09-12',
      bodyPreview: 'Letter requesting publication of public hearing schedules and venues.',
    },
  ];

  const publicResources: PublicInquiryRecord[] = [
    {
      id: 'res-1',
      recordType: 'Resource',
      number: 'RES-GUIDE-001',
      title: 'Citizen Guidebook (Public Participation)',
      status: 'Available',
      category: 'Guidebook',
      author: 'Public Information Office',
      subject: 'Public Participation',
      referral: 'Public Portal',
      classification: 'Reference Material',
      actionTaken: 'Downloadable',
      authorshipType: 'Author',
      sponsor: 'Public Information Office',
      coAuthor: '',
      date: '2026-01-05',
      bodyPreview: 'Guidebook outline: hearings, consultations, submissions, and frequently asked questions.',
    },
    {
      id: 'res-2',
      recordType: 'Resource',
      number: 'RES-FORM-ACC',
      title: 'Accreditation Request Form',
      status: 'Available',
      category: 'Form',
      author: 'Office of the Secretary to the Sanggunian',
      subject: 'Accreditation',
      referral: 'Office of the Secretary to the Sanggunian',
      classification: 'Form',
      actionTaken: 'Downloadable',
      authorshipType: 'Author',
      sponsor: 'Office of the Secretary to the Sanggunian',
      coAuthor: '',
      date: '2026-02-18',
      bodyPreview: 'Form fields: organization name, contact, purpose, representatives, and supporting documents checklist.',
    },
    {
      id: 'res-3',
      recordType: 'Resource',
      number: 'RES-ARCHIVE-ORD',
      title: 'Ordinance Archive (Searchable Index)',
      status: 'Available',
      category: 'Archive',
      author: 'Records Management Unit',
      subject: 'Ordinance Archive',
      referral: 'Public Portal',
      classification: 'Index',
      actionTaken: 'Viewable / Downloadable',
      authorshipType: 'Author',
      sponsor: 'Records Management Unit',
      coAuthor: '',
      date: '2026-03-01',
      bodyPreview: 'Archive index includes ordinance numbers, titles, year enacted, and public download references.',
    },
    {
      id: 'res-4',
      recordType: 'Resource',
      number: 'RES-MINUTES-2026',
      title: 'Session Minutes (Approved)',
      status: 'Available',
      category: 'Minutes',
      author: 'Office of the Secretary to the Sanggunian',
      subject: 'Session Minutes',
      referral: 'Office of the Secretary to the Sanggunian',
      classification: 'Minutes',
      actionTaken: 'Viewable / Printable',
      authorshipType: 'Author',
      sponsor: 'Office of the Secretary to the Sanggunian',
      coAuthor: '',
      date: '2026-04-05',
      bodyPreview: 'Approved session minutes summary with attendance, quorum confirmation, agenda items, and actions taken.',
    },
  ];

  const allRecords = [...publicLegislationRecords, ...publicInquiryDocs, ...publicResources];

  const uniqueValues = (pick: (r: PublicInquiryRecord) => string | undefined) => [
    'All',
    ...Array.from(new Set(allRecords.map(pick).filter(Boolean) as string[])),
  ];

  const asOptions = (values: string[]): SelectOption[] => values.map((value) => ({ value, label: value }));

  const statusOptions = useMemo(() => asOptions(uniqueValues((r) => r.status)), []);
  const categoryOptions = useMemo(() => asOptions(uniqueValues((r) => r.category)), []);
  const typeOptions = useMemo(() => asOptions(['All', 'Legislation', 'Incoming Document', 'Resource']), []);
  const subjectOptions = useMemo(() => asOptions(uniqueValues((r) => r.subject)), []);
  const referralOptions = useMemo(() => asOptions(uniqueValues((r) => r.referral)), []);
  const classificationOptions = useMemo(() => asOptions(uniqueValues((r) => r.classification)), []);
  const actionTakenOptions = useMemo(() => asOptions(uniqueValues((r) => r.actionTaken)), []);
  const authorshipOptions = useMemo(() => asOptions(uniqueValues((r) => r.authorshipType)), []);
  const sponsorOptions = useMemo(() => asOptions(uniqueValues((r) => r.sponsor)), []);
  const coAuthorOptions = useMemo(() => asOptions(uniqueValues((r) => r.coAuthor)), []);

  const pickOption = (options: SelectOption[], value: string) => options.find((o) => o.value === value) ?? null;

  const resetFilters = () => {
    setInquiryKeyword('');
    setSelectedStatus('All');
    setSelectedCategory('All');
    setSelectedType('All');
    setSelectedSubject('All');
    setSelectedReferral('All');
    setSelectedClassification('All');
    setSelectedAuthorship('All');
    setSelectedActionTaken('All');
    setSelectedSponsor('All');
    setSelectedCoAuthor('All');
  };

  function applyQuickFilter({ classification = 'All', type = 'All', keyword = '' }: { classification?: string; type?: string; keyword?: string }) {
    resetFilters();
    setSelectedClassification(classification);
    setSelectedType(type);
    setInquiryKeyword(keyword);
    scrollToSection('legislation');
  }

  const handleHeroSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    applyQuickFilter({ keyword: heroKeyword.trim() });
  };

  const unifiedInquiryResults = useMemo(() => {
    const keyword = inquiryKeyword.trim().toLowerCase();
    return allRecords.filter((record) => {
      const matchesKeyword =
        keyword.length === 0 ||
        record.title.toLowerCase().includes(keyword) ||
        record.number.toLowerCase().includes(keyword) ||
        record.author.toLowerCase().includes(keyword) ||
        record.subject.toLowerCase().includes(keyword);
      return (
        matchesKeyword &&
        (selectedStatus === 'All' || record.status === selectedStatus) &&
        (selectedCategory === 'All' || record.category === selectedCategory) &&
        (selectedType === 'All' || record.recordType === selectedType) &&
        (selectedSubject === 'All' || record.subject === selectedSubject) &&
        (selectedReferral === 'All' || record.referral === selectedReferral) &&
        (selectedClassification === 'All' || record.classification === selectedClassification) &&
        (selectedAuthorship === 'All' || record.authorshipType === selectedAuthorship) &&
        (selectedActionTaken === 'All' || record.actionTaken === selectedActionTaken) &&
        (selectedSponsor === 'All' || record.sponsor === selectedSponsor) &&
        (selectedCoAuthor === 'All' || record.coAuthor === selectedCoAuthor)
      );
    });
    // allRecords is rebuilt each render from static data; the filters are the real inputs.
  }, [
    inquiryKeyword,
    selectedStatus,
    selectedCategory,
    selectedType,
    selectedSubject,
    selectedReferral,
    selectedClassification,
    selectedAuthorship,
    selectedActionTaken,
    selectedSponsor,
    selectedCoAuthor,
  ]);

  const inquiryTotalPages = Math.max(1, Math.ceil(unifiedInquiryResults.length / inquiryPageSize));

  useEffect(() => {
    setInquiryPage(1);
  }, [unifiedInquiryResults.length]);

  const paginatedInquiryResults = useMemo(() => {
    const start = (inquiryPage - 1) * inquiryPageSize;
    return unifiedInquiryResults.slice(start, start + inquiryPageSize);
  }, [inquiryPage, unifiedInquiryResults]);

  const activeFilterCount = [
    selectedStatus,
    selectedCategory,
    selectedType,
    selectedSubject,
    selectedReferral,
    selectedClassification,
    selectedAuthorship,
    selectedActionTaken,
    selectedSponsor,
    selectedCoAuthor,
  ].filter((value) => value !== 'All').length + (inquiryKeyword.trim() ? 1 : 0);

  const recordTabs = [
    { label: 'All Records', active: selectedType === 'All' && selectedClassification === 'All', apply: () => applyTab('All', 'All') },
    { label: 'Ordinances', active: selectedClassification === 'Ordinance', apply: () => applyTab('Legislation', 'Ordinance') },
    { label: 'Resolutions', active: selectedClassification === 'Resolution', apply: () => applyTab('Legislation', 'Resolution') },
    { label: 'Incoming Documents', active: selectedType === 'Incoming Document', apply: () => applyTab('Incoming Document', 'All') },
    { label: 'Resources', active: selectedType === 'Resource', apply: () => applyTab('Resource', 'All') },
  ];

  function applyTab(type: string, classification: string) {
    setSelectedType(type);
    setSelectedClassification(classification);
  }

  const activePublicDoc = activePublicDocId ? allRecords.find((r) => r.id === activePublicDocId) ?? null : null;
  const agendaSession = agendaSessionId ? mockSessions.find((s) => s.id === agendaSessionId) ?? null : null;
  const activeNews = activeNewsId ? NEWS.find((n) => n.id === activeNewsId) ?? null : null;
  const nextSession = mockSessions[0];

  const watermarkText = 'SB CAPAS - PUBLIC COPY';

  const recordById = (id: string) => allRecords.find((r) => r.id === id)!;

  const downloadRecord = (record: PublicInquiryRecord) => {
    const content = [
      watermarkText,
      LGU_PROFILE.legislature,
      '',
      `Type: ${record.recordType}`,
      `Record No.: ${record.number}`,
      `Title: ${record.title}`,
      `Status: ${record.status}`,
      `Category: ${record.category}`,
      `Subject: ${record.subject}`,
      `Referral: ${record.referral}`,
      `Classification: ${record.classification}`,
      `Action taken: ${record.actionTaken}`,
      `Authorship: ${record.authorshipType}`,
      `Sponsor: ${record.sponsor ?? ''}`,
      `Co-author: ${record.coAuthor ?? ''}`,
      `Date: ${record.date}`,
      '',
      record.bodyPreview,
    ].join('\n');
    saveFile(`${record.number.replace(/[^A-Za-z0-9-]+/g, '_')}-public.txt`, content, 'text/plain;charset=utf-8');
  };

  const printRecord = (record: PublicInquiryRecord) => {
    openPrintWindow(
      record.number,
      `
      <div class="card">
        <div class="watermark">${watermarkText}</div>
        <div class="rows">
          <div><b>Type</b>: ${record.recordType}</div>
          <div><b>Record No.</b>: ${record.number}</div>
          <div><b>Status</b>: ${record.status}</div>
          <div><b>Category</b>: ${record.category}</div>
          <div><b>Subject</b>: ${record.subject}</div>
          <div><b>Referral</b>: ${record.referral}</div>
          <div><b>Classification</b>: ${record.classification}</div>
          <div><b>Action taken</b>: ${record.actionTaken}</div>
          <div><b>Sponsor</b>: ${record.sponsor ?? ''}</div>
          <div><b>Co-author</b>: ${record.coAuthor ?? ''}</div>
          <div><b>Date</b>: ${record.date}</div>
        </div>
        <div class="title">${record.title}</div>
        <div class="body">${record.bodyPreview}</div>
      </div>`
    );
  };

  const openDoc = (id: string) => setActivePublicDocId(id);

  const resourceCards = [
    { id: 'res-1', title: 'Citizen Guidebook', description: 'How to participate in public hearings and legislative consultations.', icon: BookOpen },
    { id: 'res-3', title: 'Ordinance Archive', description: 'Index of enacted municipal ordinances by number, title, and year.', icon: Archive },
    { id: 'res-4', title: 'Session Minutes', description: 'Approved minutes of regular and special sessions of the SB.', icon: ClipboardList },
    { id: 'res-2', title: 'Accreditation Form', description: 'Request form for accreditation of civil society organizations.', icon: FileText },
  ];

  const serviceTiles = [
    { title: 'Ordinances', description: 'Search enacted and proposed ordinances', icon: ScrollText, action: () => applyQuickFilter({ classification: 'Ordinance' }) },
    { title: 'Resolutions', description: 'Browse resolutions adopted by the SB', icon: FileText, action: () => applyQuickFilter({ classification: 'Resolution' }) },
    { title: 'Session Calendar', description: 'Upcoming sessions and public hearings', icon: CalendarDays, action: () => scrollToSection('public-sessions') },
    { title: 'Members & Committees', description: 'Composition of the Sanggunian', icon: Users, action: () => scrollToSection('sangguniang-bayan') },
    { title: 'Request a Document', description: 'Copies of legislative records', icon: FileSearch, action: () => openRequestDialog() },
    { title: 'Register for Updates', description: 'Get notified of new legislation', icon: UserPlus, action: () => scrollToSection('register') },
  ];

  const sectionHeading = (kicker: string, title: string, description: string, light = false) => (
    <div className="mb-10">
      <p className={`text-xs font-bold uppercase tracking-[0.2em] ${light ? 'text-[#86b6ef]' : 'text-secondary'}`}>{kicker}</p>
      <h2 className={`mt-2 text-3xl font-bold ${light ? 'text-white' : 'text-primary'}`}>{title}</h2>
      <div className={`mt-3 h-1 w-16 ${light ? 'bg-[#86b6ef]' : 'bg-secondary'}`} />
      <p className={`mt-4 max-w-3xl ${light ? 'text-white/75' : 'text-text-muted'}`}>{description}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-white font-sans">
      <a
        href="#legislation"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-primary focus:shadow"
      >
        Skip to main content
      </a>

      {/* GOVPH top bar */}
      <div className="bg-[#0b1033] text-white/80 text-xs">
        <div className="container mx-auto flex h-10 items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-4">
            <a href="https://www.gov.ph" target="_blank" rel="noopener noreferrer" className="font-bold tracking-wider text-white hover:text-[#86b6ef]">
              GOVPH
            </a>
            <span className="hidden text-white/40 sm:inline">|</span>
            <span className="hidden sm:inline">Republic of the Philippines</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-1.5 lg:flex">
              <Clock className="h-3.5 w-3.5" />
              {t.pst}: {philippineTime}
            </span>
            <div className="flex overflow-hidden rounded border border-white/20" role="group" aria-label="Language">
              {(['EN', 'FIL'] as Lang[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`px-2 py-0.5 font-semibold ${lang === code ? 'bg-white text-[#0b1033]' : 'hover:bg-white/10'}`}
                  aria-pressed={lang === code}
                >
                  {code}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="inline-flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1 font-semibold text-white hover:bg-white/20"
            >
              <Lock className="h-3.5 w-3.5" />
              {t.staffLogin}
            </button>
          </div>
        </div>
      </div>

      {/* Masthead */}
      <header className="bg-white">
        <div className="container mx-auto flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <button type="button" onClick={() => scrollToSection('home')} className="flex items-center gap-4 text-left">
            <img src="/capas-logo.jpg" alt="Seal of the Municipality of Capas" className="h-16 w-16 shrink-0 rounded-full object-cover md:h-20 md:w-20" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                Republic of the Philippines · Province of Tarlac
              </p>
              <p className="font-serif text-2xl font-bold leading-tight text-primary md:text-3xl">Sangguniang Bayan ng Capas</p>
              <p className="text-sm font-medium text-text-muted">Legislative Information System</p>
            </div>
          </button>

          <form onSubmit={handleHeroSearch} className="flex w-full max-w-md" role="search">
            <label htmlFor="masthead-search" className="sr-only">
              {t.searchPlaceholder}
            </label>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                id="masthead-search"
                value={heroKeyword}
                onChange={(e) => setHeroKeyword(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="h-11 w-full rounded-l-md border border-r-0 border-border bg-white pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <button type="submit" className="h-11 rounded-r-md bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-light">
              {t.search}
            </button>
          </form>
        </div>
      </header>

      {/* Main navigation */}
      <nav className="sticky top-0 z-40 bg-primary shadow-md" aria-label="Main">
        <div className="container mx-auto flex items-center justify-between px-6">
          <ul className="hidden lg:flex">
            {NAV_IDS.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(id)}
                  className={`border-b-[3px] px-4 py-3.5 text-sm font-semibold transition-colors ${
                    activeSection === id ? 'border-white bg-white/10 text-white' : 'border-transparent text-white/85 hover:bg-white/10 hover:text-white'
                  }`}
                  aria-current={activeSection === id ? 'true' : undefined}
                >
                  {t.nav[id]}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            className="flex items-center gap-2 py-3 text-sm font-semibold text-white lg:hidden"
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            Menu
          </button>
          <button
            type="button"
            onClick={() => openRequestDialog()}
            className="my-2 hidden rounded bg-secondary px-4 py-1.5 text-sm font-semibold text-white hover:bg-secondary/90 sm:inline-flex"
          >
            Request a Document
          </button>
        </div>
        {mobileNavOpen ? (
          <ul className="border-t border-white/10 bg-primary px-6 pb-3 lg:hidden">
            {NAV_IDS.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(id)}
                  className={`w-full px-2 py-2.5 text-left text-sm font-semibold ${activeSection === id ? 'text-white underline underline-offset-4' : 'text-white/90'}`}
                >
                  {t.nav[id]}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </nav>

      <main>
        {/* Hero */}
        <section id="home" className="relative scroll-mt-16 overflow-hidden bg-gradient-to-br from-primary via-[#1c2a8f] to-[#0d1452] text-white">
          <img
            src="/capas-logo.jpg"
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-24 top-1/2 hidden h-[520px] w-[520px] -translate-y-1/2 rounded-full object-cover opacity-[0.07] md:block"
          />
          <div className="container relative mx-auto px-6 pb-28 pt-16 md:pt-20">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_minmax(320px,400px)] lg:items-center">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#86b6ef]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t.heroKicker}
                </p>
                <h1 className="mt-5 text-4xl font-extrabold leading-tight md:text-5xl">{t.heroTitle}</h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/80">{t.heroText}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button onClick={() => applyQuickFilter({})} className="h-12 bg-white px-6 text-base font-bold text-primary hover:bg-white/90">
                    <Search className="mr-2 h-4 w-4" />
                    Search Legislation
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => scrollToSection('public-sessions')}
                    className="h-12 border-white/40 px-6 text-base font-semibold text-white hover:bg-white/10"
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Session Calendar
                  </Button>
                </div>
              </motion.div>

              {nextSession ? (
                <motion.aside
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="rounded-xl border border-white/15 bg-white text-text-main shadow-2xl"
                >
                  <div className="rounded-t-xl bg-secondary px-6 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white">Next Session</div>
                  <div className="p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-secondary">{nextSession.type}</p>
                    <h2 className="mt-1 text-xl font-bold text-primary">{nextSession.title}</h2>
                    <ul className="mt-4 space-y-2 text-sm text-text-muted">
                      <li className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        {formatLongDate(nextSession.date)}
                      </li>
                      <li className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        {nextSession.time}
                      </li>
                      <li className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        {nextSession.location}
                      </li>
                    </ul>
                    <div className="mt-6 grid grid-cols-2 gap-2">
                      <Button onClick={() => setAgendaSessionId(nextSession.id)} className="bg-primary font-semibold">
                        <Eye className="mr-2 h-4 w-4" />
                        View Agenda
                      </Button>
                      <Button variant="outline" onClick={() => addSessionToCalendar(nextSession)} className="font-semibold">
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        Add to Calendar
                      </Button>
                    </div>
                  </div>
                </motion.aside>
              ) : null}
            </div>
          </div>
        </section>

        {/* Public service tiles */}
        <section aria-label={t.services} className="relative z-10 -mt-16">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xl md:grid-cols-3 lg:grid-cols-6">
              {serviceTiles.map((tile) => (
                <button
                  key={tile.title}
                  type="button"
                  onClick={tile.action}
                  className="group flex flex-col items-start gap-3 bg-white p-5 text-left transition-colors hover:bg-primary"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-white/15 group-hover:text-white">
                    <tile.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-primary group-hover:text-white">{tile.title}</span>
                    <span className="mt-1 block text-xs text-text-muted group-hover:text-white/75">{tile.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Records at a glance */}
        <section className="bg-white py-16">
          <div className="container mx-auto px-6">
            {sectionHeading('Transparency', t.overview, 'Totals of legislative records on file with the Office of the Secretary to the Sanggunian.')}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {publicStats.map((stat) => (
                <article key={stat.label} className="flex flex-col border border-border border-t-4 border-t-primary bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-text-muted">{stat.label}</p>
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="mt-3 text-4xl font-bold text-primary">{stat.value}</p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-text-muted">{stat.description}</p>
                  <button type="button" onClick={stat.action} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-secondary hover:underline">
                    {stat.actionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Legislation */}
        <section id="legislation" className="scroll-mt-16 border-y border-border bg-background py-16">
          <div className="container mx-auto px-6">
            {sectionHeading(
              'Public Inquiry',
              t.legislation,
              'Search ordinances, resolutions, incoming documents, and public resources. Open a record to view, download, or print a watermarked public copy.'
            )}

            <div className="rounded-xl border border-border bg-white shadow-sm">
              <div className="flex flex-wrap gap-1 border-b border-border px-4 pt-3" role="tablist">
                {recordTabs.map((tab) => (
                  <button
                    key={tab.label}
                    type="button"
                    role="tab"
                    aria-selected={tab.active}
                    onClick={tab.apply}
                    className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                      tab.active ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-primary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3 p-4">
                <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <Input
                      value={inquiryKeyword}
                      onChange={(e) => setInquiryKeyword(e.target.value)}
                      placeholder="Keyword, record no., author, subject..."
                      className="pl-9"
                    />
                  </div>
                  <Select
                    options={statusOptions}
                    value={pickOption(statusOptions, selectedStatus)}
                    onChange={(opt) => setSelectedStatus(opt?.value ?? 'All')}
                    placeholder="Status"
                  />
                  <Select
                    options={categoryOptions}
                    value={pickOption(categoryOptions, selectedCategory)}
                    onChange={(opt) => setSelectedCategory(opt?.value ?? 'All')}
                    placeholder="Category"
                  />
                  <Button variant="outline" onClick={() => setShowAdvancedFilters((open) => !open)} aria-expanded={showAdvancedFilters}>
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    {showAdvancedFilters ? 'Fewer filters' : 'More filters'}
                  </Button>
                  <Button variant="outline" onClick={resetFilters} disabled={activeFilterCount === 0}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>

                {showAdvancedFilters ? (
                  <div className="grid gap-3 border-t border-border pt-3 md:grid-cols-4">
                    <Select options={typeOptions} value={pickOption(typeOptions, selectedType)} onChange={(opt) => setSelectedType(opt?.value ?? 'All')} placeholder="Type" isSearchable={false} />
                    <Select options={subjectOptions} value={pickOption(subjectOptions, selectedSubject)} onChange={(opt) => setSelectedSubject(opt?.value ?? 'All')} placeholder="Subject" />
                    <Select options={referralOptions} value={pickOption(referralOptions, selectedReferral)} onChange={(opt) => setSelectedReferral(opt?.value ?? 'All')} placeholder="Referral" />
                    <Select
                      options={classificationOptions}
                      value={pickOption(classificationOptions, selectedClassification)}
                      onChange={(opt) => setSelectedClassification(opt?.value ?? 'All')}
                      placeholder="Classification"
                    />
                    <Select
                      options={actionTakenOptions}
                      value={pickOption(actionTakenOptions, selectedActionTaken)}
                      onChange={(opt) => setSelectedActionTaken(opt?.value ?? 'All')}
                      placeholder="Action taken"
                    />
                    <Select
                      options={authorshipOptions}
                      value={pickOption(authorshipOptions, selectedAuthorship)}
                      onChange={(opt) => setSelectedAuthorship(opt?.value ?? 'All')}
                      placeholder="Authorship"
                      isSearchable={false}
                    />
                    <Select options={sponsorOptions} value={pickOption(sponsorOptions, selectedSponsor)} onChange={(opt) => setSelectedSponsor(opt?.value ?? 'All')} placeholder="Sponsor" />
                    <Select options={coAuthorOptions} value={pickOption(coAuthorOptions, selectedCoAuthor)} onChange={(opt) => setSelectedCoAuthor(opt?.value ?? 'All')} placeholder="Co-author" />
                  </div>
                ) : null}

                <p className="text-xs text-text-muted">
                  {unifiedInquiryResults.length} record{unifiedInquiryResults.length === 1 ? '' : 's'} found
                  {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied` : ''}
                </p>
              </div>

              <DataTable
                currentPage={inquiryPage}
                totalPages={inquiryTotalPages}
                pageSize={inquiryPageSize}
                totalItems={unifiedInquiryResults.length}
                currentCount={paginatedInquiryResults.length}
                onPreviousPage={() => setInquiryPage((prev) => Math.max(1, prev - 1))}
                onNextPage={() => setInquiryPage((prev) => Math.min(inquiryTotalPages, prev + 1))}
                tableWrapperClassName="overflow-x-auto overflow-y-visible"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RECORD NO.</TableHead>
                      <TableHead>TITLE</TableHead>
                      <TableHead>TYPE</TableHead>
                      <TableHead>DATE</TableHead>
                      <TableHead>STATUS</TableHead>
                      <TableHead>ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInquiryResults.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="whitespace-nowrap">{record.number}</TableCell>
                        <TableCell>
                          <button type="button" onClick={() => openDoc(record.id)} className="text-center font-semibold text-primary hover:underline">
                            {record.title}
                          </button>
                          <div className="mt-0.5 text-[11px] text-text-muted">{record.referral}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{record.classification}</TableCell>
                        <TableCell className="whitespace-nowrap">{record.date}</TableCell>
                        <TableCell>
                          <StatusBadge status={record.status} />
                        </TableCell>
                        <TableCell className="relative">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions for ${record.number}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-52">
                              <DropdownMenuItem onClick={() => openDoc(record.id)}>View</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadRecord(record)}>Download public copy</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printRecord(record)}>Print public copy</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openRequestDialog(record.number)}>Request certified copy</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedInquiryResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">
                          No matching public records found.{' '}
                          <button type="button" onClick={resetFilters} className="font-semibold text-primary hover:underline">
                            Clear filters
                          </button>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </DataTable>
            </div>
          </div>
        </section>

        {/* Sangguniang Bayan */}
        <section id="sangguniang-bayan" className="scroll-mt-16 bg-gradient-to-br from-primary to-[#0d1452] py-16">
          <div className="container mx-auto px-6">
            {sectionHeading(
              'Legislative Body',
              t.sb,
              'The legislative body of the Municipality of Capas, presided over by the Municipal Vice Mayor. It enacts ordinances, adopts resolutions, and appropriates funds for the general welfare of the municipality and its inhabitants.',
              true
            )}

            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Municipal Councilors', value: '8', icon: Users },
                { label: 'Ex-officio Members', value: '3', icon: ShieldCheck },
                { label: 'Standing Committees', value: String(mockCommittees.length), icon: Landmark },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/10 p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/15 text-[#86b6ef]">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-2xl font-bold text-white">{item.value}</p>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-xl">
              <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-text-main">Composition of the Sangguniang Bayan</h3>
                  <p className="text-xs text-text-muted">{mockMembers.length} members · select a member to see their committee assignments</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf6e3] px-2 py-0.5 font-semibold text-[#8a6a12]">
                    <Gavel className="h-3 w-3" /> Chair
                  </span>
                  chairs at least one committee
                </span>
              </div>
              <CompositionChart onSelect={setPublicMemberId} />
            </div>

            <div className="mt-10">
              <h3 className="text-lg font-bold text-white">Standing Committees</h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {mockCommittees.map((committee) => (
                  <button
                    key={committee.id}
                    type="button"
                    onClick={() => {
                      resetFilters();
                      setSelectedReferral(committee.name);
                      scrollToSection('legislation');
                    }}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-left text-sm text-white/90 transition-colors hover:bg-white/15"
                  >
                    {committee.name}
                    <ArrowRight className="h-4 w-4 shrink-0 text-[#86b6ef]" />
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/60">Select a committee to see the measures referred to it.</p>
            </div>
          </div>
        </section>

        {/* Sessions */}
        <section id="public-sessions" className="scroll-mt-16 bg-white py-16">
          <div className="container mx-auto px-6">
            {sectionHeading(
              'Schedule',
              t.sessions,
              `Sessions are open to the public and held at the ${LGU_PROFILE.sessionHall}. View the order of business, add a session to your calendar, or print the agenda.`
            )}

            <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4">
                {mockSessions.map((session) => {
                  const date = new Date(`${session.date}T00:00:00`);
                  return (
                    <article key={session.id} className="flex flex-col gap-4 rounded-xl border border-border bg-white p-5 shadow-sm sm:flex-row sm:items-center">
                      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-lg bg-primary text-white">
                        <span className="text-xs font-bold uppercase">{date.toLocaleDateString('en-PH', { month: 'short' })}</span>
                        <span className="text-3xl font-bold leading-none">{date.getDate()}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-secondary">{session.type}</p>
                        <h3 className="text-lg font-bold text-primary">{session.title}</h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {session.time}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {session.location}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:flex-col">
                        <Button size="sm" onClick={() => setAgendaSessionId(session.id)}>
                          <Eye className="mr-1.5 h-4 w-4" />
                          Agenda
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => addSessionToCalendar(session)}>
                          <CalendarPlus className="mr-1.5 h-4 w-4" />
                          Calendar
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <aside className="rounded-xl border border-border bg-background p-6">
                <h3 className="text-lg font-bold text-primary">Recently Approved Measures</h3>
                <p className="mt-1 text-sm text-text-muted">Ordinances and resolutions approved by the SB.</p>
                <ul className="mt-4 divide-y divide-border">
                  {publicLegislationRecords
                    .filter((r) => ['Passed', 'Enacted'].includes(r.status))
                    .slice(0, 5)
                    .map((record) => (
                      <li key={record.id} className="py-3">
                        <button type="button" onClick={() => openDoc(record.id)} className="group w-full text-left">
                          <span className="font-mono text-[11px] font-semibold text-secondary">{record.number}</span>
                          <span className="mt-0.5 block text-sm font-semibold text-text-main group-hover:text-primary group-hover:underline">{record.title}</span>
                        </button>
                      </li>
                    ))}
                </ul>
                <Button variant="outline" className="mt-4 w-full" onClick={() => applyQuickFilter({ type: 'Legislation' })}>
                  View all legislation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </aside>
            </div>
          </div>
        </section>

        {/* Resources */}
        <section id="resources" className="scroll-mt-16 border-y border-border bg-background py-16">
          <div className="container mx-auto px-6">
            {sectionHeading('Downloads', t.resources, 'Guides, archives, and forms for citizens and organizations. Downloaded and printed copies carry a public-copy watermark.')}

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {resourceCards.map((card) => {
                const record = recordById(card.id);
                return (
                  <article key={card.id} className="flex flex-col rounded-xl border border-border bg-white p-5 shadow-sm">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <card.icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 font-bold text-primary">{card.title}</h3>
                    <p className="mt-1 flex-1 text-sm text-text-muted">{card.description}</p>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <Button size="sm" variant="outline" onClick={() => openDoc(card.id)} aria-label={`View ${card.title}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadRecord(record)} aria-label={`Download ${card.title}`}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => printRecord(record)} aria-label={`Print ${card.title}`}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <article id="register" className="scroll-mt-20 rounded-xl border border-border bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-primary">Register for Legislative Updates</h3>
                <p className="mt-1 text-sm text-text-muted">Receive notices of new ordinances, resolutions, and public hearings.</p>
                <form onSubmit={handlePublicRegistration} className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input value={publicName} onChange={(e) => setPublicName(e.target.value)} placeholder="Full name" aria-label="Full name" />
                    <Input value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} type="email" placeholder="Email address" aria-label="Email address" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-text-muted">
                    <input type="checkbox" checked={notifyUpdates} onChange={(e) => setNotifyUpdates(e.target.checked)} className="h-4 w-4 accent-primary" />
                    Subscribe to ordinance and resolution updates
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit">Register</Button>
                    <button type="button" onClick={() => setPolicyDialog('privacy')} className="text-xs text-text-muted underline hover:text-primary">
                      How we use your data
                    </button>
                  </div>
                  {registrationNotice ? <p className="text-sm font-medium text-primary">{registrationNotice}</p> : null}
                </form>
              </article>

              <article className="rounded-xl border border-border bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-primary">Check Accreditation Status</h3>
                <p className="mt-1 text-sm text-text-muted">Enter the reference number of your organization&apos;s accreditation request.</p>
                <form onSubmit={handleAccreditationLookup} className="mt-4 flex gap-2">
                  <Input
                    value={accreditationQuery}
                    onChange={(e) => {
                      setAccreditationQuery(e.target.value);
                      setAccreditationResult(null);
                    }}
                    placeholder="e.g. ACC-2026-005"
                    aria-label="Accreditation reference number"
                  />
                  <Button type="submit">Check</Button>
                </form>
                {accreditationResult ? (
                  <p className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-primary">{accreditationResult}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadRecord(recordById('res-2'))}>
                    <Download className="mr-1.5 h-4 w-4" />
                    Download accreditation form
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openRequestDialog()}>
                    <FileSearch className="mr-1.5 h-4 w-4" />
                    Request a document
                  </Button>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* News */}
        <section id="news" className="scroll-mt-16 bg-white py-16">
          <div className="container mx-auto px-6">
            {sectionHeading('Updates', t.news, 'Recent actions, notices, and announcements from the Sangguniang Bayan ng Capas.')}
            <div className="grid gap-5 lg:grid-cols-3">
              {NEWS.map((item) => (
                <article key={item.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex h-36 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                    <item.icon className="h-14 w-14" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-secondary">{item.category}</p>
                    <h3 className="mt-2 text-lg font-bold leading-snug text-primary">{item.title}</h3>
                    <p className="mt-2 flex-1 text-sm text-text-muted">{item.summary}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs font-medium uppercase text-text-muted">{item.date}</span>
                      <button type="button" onClick={() => setActiveNewsId(item.id)} className="inline-flex items-center gap-1 text-sm font-semibold text-secondary hover:underline">
                        Read more
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Transparency links */}
        <section aria-label="Transparency and accountability" className="border-t border-border bg-background py-12">
          <div className="container mx-auto grid gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
            {TRANSPARENCY_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 rounded-xl border border-border bg-white p-5 transition-colors hover:border-primary"
              >
                <link.icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <span>
                  <span className="flex items-center gap-1 font-bold text-primary group-hover:underline">
                    {link.label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                  <span className="mt-1 block text-xs text-text-muted">{link.description}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      </main>

      {/* GOVPH footer */}
      <footer id="contact" className="scroll-mt-16 bg-[#0b1033] text-white/75">
        <div className="container mx-auto grid gap-10 px-6 py-14 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <img src="/capas-logo.jpg" alt="Seal of the Municipality of Capas" className="h-20 w-20 rounded-full object-cover ring-2 ring-white/20" />
            <p className="mt-4 text-sm font-bold uppercase tracking-wider text-white">Republic of the Philippines</p>
            <p className="mt-2 text-sm leading-relaxed">
              All content is in the public domain unless otherwise stated. {LGU_PROFILE.legislature}, {LGU_PROFILE.municipality},{' '}
              {LGU_PROFILE.province}.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Contact the SB Office</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#86b6ef]" />
                <span>
                  Office of the Sangguniang Bayan
                  <br />
                  {LGU_PROFILE.address}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-[#86b6ef]" />
                <a href={`mailto:${LGU_PROFILE.email}`} className="hover:text-white hover:underline">
                  {LGU_PROFILE.email}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-[#86b6ef]" />
                <a href={`viber://chat?number=${LGU_PROFILE.viber.replace(/\s+/g, '')}`} className="hover:text-white hover:underline">
                  Viber: {LGU_PROFILE.viber}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 shrink-0 text-[#86b6ef]" />
                <a href="https://www.capas.gov.ph" target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">
                  Municipality of Capas website
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">About GOVPH</h2>
            <p className="mt-4 text-sm">Learn more about the Philippine government, its structure, how government works, and the people behind it.</p>
            <ul className="mt-3 space-y-2 text-sm">
              {ABOUT_GOVPH_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Government Links</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {GOVERNMENT_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 py-5 text-xs md:flex-row">
            <p>© 2026 {LGU_PROFILE.legislature}. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-5">
              <button type="button" onClick={() => setPolicyDialog('privacy')} className="hover:text-white">
                Privacy Notice
              </button>
              <button type="button" onClick={() => setPolicyDialog('terms')} className="hover:text-white">
                Terms of Use
              </button>
              <button type="button" onClick={() => setPolicyDialog('accessibility')} className="hover:text-white">
                Accessibility
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('home')}
                className="inline-flex items-center gap-1 rounded border border-white/20 px-2.5 py-1 hover:bg-white/10 hover:text-white"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                Back to top
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Staff login */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="relative max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl text-primary">Staff Login</DialogTitle>
            <DialogDescription>For authorized personnel of the Sangguniang Bayan ng Capas.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePortalLogin} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="portal-username" className="text-xs font-semibold text-text-muted">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  id="portal-username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="h-11 pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="portal-password" className="text-xs font-semibold text-text-muted">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  id="portal-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="h-11 pl-9"
                />
              </div>
            </div>
            <label htmlFor="portal-remember" className="flex items-center gap-2 text-xs text-text-muted">
              <input id="portal-remember" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 accent-primary" />
              Remember me
            </label>
            {loginError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
                {loginError}
              </p>
            ) : null}
            <Button type="submit" className="h-11 w-full text-base font-bold">
              <LogIn className="mr-2 h-4 w-4" />
              Sign in
            </Button>
            <p className="text-center text-[11px] text-text-muted">
              Demo access: <span className="font-mono font-semibold text-text-main">admin</span> /{' '}
              <span className="font-mono font-semibold text-text-main">admin123</span>
            </p>
          </form>
        </DialogContent>
      </Dialog>

      {/* Public document viewer */}
      <Dialog open={activePublicDoc !== null} onOpenChange={(open) => !open && setActivePublicDocId(null)}>
        <DialogContent className="relative max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Public Document Viewer</DialogTitle>
            <DialogDescription>View, download, or print a watermarked public copy.</DialogDescription>
          </DialogHeader>
          {activePublicDoc ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-col gap-3 border border-border bg-muted/20 p-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-text-main">
                    {activePublicDoc.recordType} • {activePublicDoc.number}
                  </div>
                  <div className="text-lg font-bold text-primary">{activePublicDoc.title}</div>
                  <StatusBadge status={activePublicDoc.status} align="start" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadRecord(activePublicDoc)}>
                    <Download className="mr-1.5 h-4 w-4" />
                    Download
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printRecord(activePublicDoc)}>
                    <Printer className="mr-1.5 h-4 w-4" />
                    Print
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const number = activePublicDoc.number;
                      setActivePublicDocId(null);
                      openRequestDialog(number);
                    }}
                  >
                    Request certified copy
                  </Button>
                </div>
              </div>

              <div className="relative overflow-hidden border border-border bg-white p-5">
                <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center">
                  <div className="rotate-[-18deg] text-5xl font-extrabold tracking-widest text-primary/10">{watermarkText}</div>
                </div>
                <div className="relative">
                  <div className="grid gap-2 text-xs text-text-muted md:grid-cols-2">
                    {[
                      ['Date', activePublicDoc.date],
                      ['Category', activePublicDoc.category],
                      ['Subject', activePublicDoc.subject],
                      ['Referral', activePublicDoc.referral],
                      ['Classification', activePublicDoc.classification],
                      ['Action taken', activePublicDoc.actionTaken],
                      ['Author', activePublicDoc.author],
                      ['Co-author', activePublicDoc.coAuthor || '—'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        {label}: <span className="font-semibold text-text-main">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 whitespace-pre-wrap text-sm text-text-main">{activePublicDoc.bodyPreview}</div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Session agenda */}
      <Dialog open={agendaSession !== null} onOpenChange={(open) => !open && setAgendaSessionId(null)}>
        <DialogContent className="relative max-h-[90vh] max-w-2xl overflow-y-auto">
          {agendaSession ? (
            <>
              <DialogHeader>
                <p className="text-xs font-bold uppercase tracking-wider text-secondary">{agendaSession.type}</p>
                <DialogTitle className="text-xl text-primary">{agendaSession.title}</DialogTitle>
                <DialogDescription>
                  {formatLongDate(agendaSession.date)} · {agendaSession.time} · {agendaSession.location}
                </DialogDescription>
              </DialogHeader>
              <h3 className="mt-5 text-sm font-bold uppercase tracking-wider text-text-muted">Order of Business</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-text-main">
                {buildAgenda(agendaSession).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => printAgenda(agendaSession)}>
                  <Printer className="mr-1.5 h-4 w-4" />
                  Print agenda
                </Button>
                <Button variant="outline" onClick={() => addSessionToCalendar(agendaSession)}>
                  <CalendarPlus className="mr-1.5 h-4 w-4" />
                  Add to calendar
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* News article */}
      <Dialog open={activeNews !== null} onOpenChange={(open) => !open && setActiveNewsId(null)}>
        <DialogContent className="relative max-h-[90vh] max-w-2xl overflow-y-auto">
          {activeNews ? (
            <>
              <DialogHeader>
                <p className="text-xs font-bold uppercase tracking-wider text-secondary">{activeNews.category}</p>
                <DialogTitle className="text-xl leading-snug text-primary">{activeNews.title}</DialogTitle>
                <DialogDescription>{activeNews.date}</DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-text-main">
                {activeNews.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {activeNews.relatedDocId ? (
                <Button
                  className="mt-6"
                  onClick={() => {
                    const docId = activeNews.relatedDocId!;
                    setActiveNewsId(null);
                    openDoc(docId);
                  }}
                >
                  <FileText className="mr-1.5 h-4 w-4" />
                  View related document
                </Button>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Document request */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="relative max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">Request a Document</DialogTitle>
            <DialogDescription>Request a certified copy of a legislative record from the Office of the Secretary to the Sanggunian.</DialogDescription>
          </DialogHeader>
          {requestReference ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                <p className="font-bold">Request received</p>
                <p className="mt-1">
                  Your reference number is <span className="font-mono font-bold">{requestReference}</span>. A confirmation will be sent to {requestEmail}. Please present
                  this reference number when claiming your document at the SB Office.
                </p>
              </div>
              <Button
                onClick={() => {
                  setRequestOpen(false);
                  setRequestName('');
                  setRequestEmail('');
                  setRequestRecord('');
                  setRequestPurpose('Personal reference');
                }}
              >
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleDocumentRequest} className="mt-5 space-y-3">
              <Input value={requestName} onChange={(e) => setRequestName(e.target.value)} placeholder="Full name" aria-label="Full name" />
              <Input value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} type="email" placeholder="Email address" aria-label="Email address" />
              <Input
                value={requestRecord}
                onChange={(e) => setRequestRecord(e.target.value)}
                placeholder="Record number or title (e.g. Mun. Ord. No. 2026-005)"
                aria-label="Document requested"
              />
              <label className="block text-xs font-semibold text-text-muted">
                Purpose
                <select
                  value={requestPurpose}
                  onChange={(e) => setRequestPurpose(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-normal text-text-main"
                >
                  {['Personal reference', 'Research / Academic', 'Legal proceedings', 'Business compliance', 'Other'].map((purpose) => (
                    <option key={purpose}>{purpose}</option>
                  ))}
                </select>
              </label>
              {requestError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
                  {requestError}
                </p>
              ) : null}
              <p className="text-[11px] text-text-muted">
                By submitting, you agree to the processing of your personal data under the{' '}
                <button type="button" onClick={() => setPolicyDialog('privacy')} className="underline hover:text-primary">
                  Privacy Notice
                </button>
                .
              </p>
              <Button type="submit" className="w-full">
                Submit request
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Policies */}
      <Dialog open={policyDialog !== null} onOpenChange={(open) => !open && setPolicyDialog(null)}>
        <DialogContent className="relative max-w-lg">
          <DialogHeader>
            <DialogTitle>{policyDialog === 'privacy' ? 'Privacy Notice' : policyDialog === 'terms' ? 'Terms of Use' : 'Accessibility'}</DialogTitle>
            <DialogDescription>{LGU_PROFILE.legislature}</DialogDescription>
          </DialogHeader>
          {policyDialog === 'privacy' && (
            <div className="mt-3 space-y-3 text-sm text-text-muted">
              <p>
                The Sangguniang Bayan ng Capas collects only the personal information needed to process public registrations, inquiries, and requests for legislative
                documents, in accordance with the Data Privacy Act of 2012 (RA 10173).
              </p>
              <p>
                Information is used solely for the stated purpose, kept only as long as necessary, and protected against unauthorized access. You may request access to,
                correction of, or deletion of your data through the Office of the Secretary to the Sanggunian at {LGU_PROFILE.email}.
              </p>
            </div>
          )}
          {policyDialog === 'terms' && (
            <div className="mt-3 space-y-3 text-sm text-text-muted">
              <p>
                Documents on this portal are provided for public information. Downloaded and printed copies are marked &ldquo;Public Copy&rdquo; and are not certified true
                copies. Certified copies may be requested from the Office of the Secretary to the Sanggunian.
              </p>
            </div>
          )}
          {policyDialog === 'accessibility' && (
            <div className="mt-3 space-y-3 text-sm text-text-muted">
              <p>
                This portal is designed to work on phones, tablets, and desktop computers, supports keyboard navigation, and uses readable text and color contrast. Report
                accessibility issues to {LGU_PROFILE.email}.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Member of the Sangguniang Bayan: committee assignments, each linking to its referred measures. */}
      <Dialog open={publicMember !== null} onOpenChange={(open) => !open && setPublicMemberId(null)}>
        <DialogContent>
          {publicMember ? (
            <>
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1a237e] to-[#0d1452] text-sm font-bold text-white ring-2 ring-[#d4a72c]">
                  {publicMember.abbr}
                </span>
                <DialogHeader className="text-left">
                  <DialogTitle className="text-xl text-primary">{publicMember.name}</DialogTitle>
                  <DialogDescription>
                    {publicMember.position} · {publicMember.seat}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <h4 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Committee assignments</h4>
              {committeeRolesOf(publicMember.id).length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {committeeRolesOf(publicMember.id)
                    .sort((a, b) => ['Chair', 'Vice Chair', 'Member'].indexOf(a.role) - ['Chair', 'Vice Chair', 'Member'].indexOf(b.role))
                    .map((entry) => (
                      <li key={entry.committee.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPublicMemberId(null);
                            resetFilters();
                            setSelectedReferral(entry.committee.name);
                            scrollToSection('legislation');
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                        >
                          <span className="min-w-0 truncate text-sm text-text-main">{shortCommitteeName(entry.committee.name)}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                entry.role === 'Chair' ? 'bg-[#fdf6e3] text-[#8a6a12]' : entry.role === 'Vice Chair' ? 'bg-primary/10 text-primary' : 'bg-muted text-text-muted'
                              )}
                            >
                              {entry.role}
                            </span>
                            <ArrowRight className="h-4 w-4 text-text-muted" />
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-text-muted">
                  {publicMember.seat === 'Presiding Officer' ? 'The Municipal Vice Mayor presides over sessions and does not sit in standing committees.' : 'No committee assignments.'}
                </p>
              )}
              <p className="mt-4 text-xs text-text-muted">Select a committee to see the measures referred to it.</p>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
