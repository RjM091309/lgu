import { useEffect, useMemo, useRef, useState } from 'react';
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
import { EgovAiChat } from '@/components/public/EgovAiChat';

// Demo sign-in.
const DEMO_PASSWORD = 'admin123';

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
  const headerRef = useRef<HTMLElement | null>(null);
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

  // Lands each section right under the sticky header (measured, so it stays exact on every screen size);
  // Home goes to the very top so the GOVPH bar shows too. Cards inside a section get a little breathing room.
  const scrollToSection = (id: string) => {
    setMobileNavOpen(false);
    // Measure after the mobile menu has closed and the header is back to its normal height.
    requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;
      if (id === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      const gap = target.tagName === 'SECTION' || target.tagName === 'FOOTER' ? 0 : 24;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - headerHeight - gap, behavior: 'smooth' });
    });
  };

  const handlePortalLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    if (!username.trim() || !password) {
      setLoginError('Please enter your username and password.');
      toast('Sign-in failed', 'Please enter your username and password.', 'error');
      return;
    }
    if (username.trim() === 'admin' && password === DEMO_PASSWORD) {
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

  const container = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';

  const sectionHeading = (kicker: string, title: string, description: string) => (
    <div className="mb-10 max-w-3xl">
      <p className="text-sm font-semibold text-primary">{kicker}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-3 text-base leading-relaxed text-slate-600">{description}</p>
    </div>
  );

  const sessionTypeStyle = (type: string) =>
    type === 'Special' ? 'bg-orange-50 text-orange-700 ring-orange-200' : type === 'Committee Hearing' ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-primary/5 text-primary ring-primary/15';

  const nextSessionDate = nextSession ? new Date(`${nextSession.date}T00:00:00`) : null;

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <a
        href="#legislation"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-primary focus:shadow"
      >
        Skip to main content
      </a>

      {/* GOVPH top bar */}
      <div className="bg-[#0a0f3d] text-xs text-white/70">
        <div className={cn(container, 'flex h-9 items-center justify-between gap-4')}>
          <div className="flex items-center gap-3">
            <a href="https://www.gov.ph" target="_blank" rel="noopener noreferrer" className="font-bold tracking-wider text-white hover:text-white/80">
              GOVPH
            </a>
            <span className="hidden h-3 w-px bg-white/25 sm:block" aria-hidden />
            <span className="hidden sm:inline">Republic of the Philippines</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 lg:flex">
              <Clock className="h-3.5 w-3.5" />
              {t.pst}: {philippineTime}
            </span>
            <div className="flex rounded-md bg-white/10 p-0.5" role="group" aria-label="Language">
              {(['EN', 'FIL'] as Lang[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={cn('rounded px-2 py-0.5 font-semibold transition-colors', lang === code ? 'bg-white text-[#0a0f3d]' : 'text-white/75 hover:text-white')}
                  aria-pressed={lang === code}
                >
                  {code}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold text-white transition-colors hover:bg-white/10"
            >
              <Lock className="h-3.5 w-3.5" />
              {t.staffLogin}
            </button>
          </div>
        </div>
      </div>

      {/* Header and main navigation */}
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className={cn(container, 'flex h-16 items-center gap-6')}>
          <button type="button" onClick={() => scrollToSection('home')} className="flex min-w-0 items-center gap-3 text-left">
            <img src="/capas-logo.jpg" alt="Seal of the Municipality of Capas" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-tight text-slate-900">Sangguniang Bayan ng Capas</span>
              <span className="block truncate text-xs text-slate-500">Legislative Information System</span>
            </span>
          </button>

          <nav className="hidden flex-1 justify-center lg:flex" aria-label="Main">
            <ul className="flex items-center gap-1">
              {NAV_IDS.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(id)}
                    className={cn(
                      'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      activeSection === id ? 'bg-primary/5 text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )}
                    aria-current={activeSection === id ? 'true' : undefined}
                  >
                    {t.nav[id]}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button onClick={() => openRequestDialog()} className="hidden h-9 rounded-lg px-4 font-semibold sm:inline-flex">
              <FileSearch className="mr-2 h-4 w-4" />
              Request a Document
            </Button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileNavOpen ? (
          <nav className="border-t border-slate-200 bg-white lg:hidden" aria-label="Main">
            <ul className={cn(container, 'grid gap-1 py-3')}>
              {NAV_IDS.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(id)}
                    className={cn(
                      'w-full rounded-md px-3 py-2.5 text-left text-sm font-medium',
                      activeSection === id ? 'bg-primary/5 text-primary' : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {t.nav[id]}
                  </button>
                </li>
              ))}
              <li className="pt-2 sm:hidden">
                <Button onClick={() => openRequestDialog()} className="w-full rounded-lg font-semibold">
                  <FileSearch className="mr-2 h-4 w-4" />
                  Request a Document
                </Button>
              </li>
            </ul>
          </nav>
        ) : null}
      </header>

      <main>
        {/* Hero */}
        <section id="home" className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-[#f4f6fd] to-white">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(#1a237e1a_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
            aria-hidden
          />
          <div className={cn(container, 'relative grid gap-12 py-16 md:py-24 lg:grid-cols-[1.3fr_1fr] lg:items-center')}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#d4a72c]" aria-hidden />
                {t.heroKicker} · Capas, Tarlac
              </p>
              <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 md:text-5xl">{t.heroTitle}</h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">{t.heroText}</p>

              <form onSubmit={handleHeroSearch} className="mt-8 flex max-w-xl items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10" role="search">
                <label htmlFor="hero-search" className="sr-only">
                  {t.searchPlaceholder}
                </label>
                <Search className="ml-2.5 h-5 w-5 shrink-0 text-slate-400" />
                <input
                  id="hero-search"
                  value={heroKeyword}
                  onChange={(e) => setHeroKeyword(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                <Button type="submit" className="h-10 shrink-0 rounded-lg px-5 font-semibold">
                  {t.search}
                </Button>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-500">Quick links:</span>
                {[
                  { label: 'Ordinances', action: () => applyQuickFilter({ classification: 'Ordinance' }) },
                  { label: 'Resolutions', action: () => applyQuickFilter({ classification: 'Resolution' }) },
                  { label: 'Session calendar', action: () => scrollToSection('public-sessions') },
                ].map((link) => (
                  <button
                    key={link.label}
                    type="button"
                    onClick={link.action}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 transition-colors hover:border-primary/30 hover:text-primary"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {nextSession && nextSessionDate ? (
              <motion.aside
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.25)]"
                aria-label="Next session"
              >
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    Next session
                  </p>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', sessionTypeStyle(nextSession.type))}>{nextSession.type}</span>
                </div>

                <div className="mt-5 flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-white">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-white/75">
                      {nextSessionDate.toLocaleDateString('en-PH', { month: 'short' })}
                    </span>
                    <span className="text-2xl font-bold leading-none">{nextSessionDate.getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-snug text-slate-900">{nextSession.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{formatLongDate(nextSession.date)}</p>
                  </div>
                </div>

                <dl className="mt-5 space-y-2.5 border-t border-slate-100 pt-5 text-sm">
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                    <dt className="sr-only">Time</dt>
                    <dd>{nextSession.time}</dd>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                    <dt className="sr-only">Venue</dt>
                    <dd>{nextSession.location}</dd>
                  </div>
                </dl>

                <div className="mt-6 grid grid-cols-2 gap-2">
                  <Button onClick={() => setAgendaSessionId(nextSession.id)} className="rounded-lg font-semibold">
                    <Eye className="mr-2 h-4 w-4" />
                    View Agenda
                  </Button>
                  <Button variant="outline" onClick={() => addSessionToCalendar(nextSession)} className="rounded-lg font-semibold">
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    Add to Calendar
                  </Button>
                </div>
              </motion.aside>
            ) : null}
          </div>
        </section>

        {/* Public services */}
        <section aria-labelledby="services-heading" className="py-16 md:py-20">
          <div className={container}>
            <div className="mb-10 max-w-3xl">
              <p className="text-sm font-semibold text-primary">{t.services}</p>
              <h2 id="services-heading" className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                How can we help you?
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {serviceTiles.map((tile) => (
                <button
                  key={tile.title}
                  type="button"
                  onClick={tile.action}
                  className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_30px_-18px_rgba(26,35,126,0.45)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10">
                    <tile.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">{tile.title}</span>
                    <span className="mt-1 block text-sm text-slate-600">{tile.description}</span>
                  </span>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Records at a glance */}
        <section className="border-y border-slate-200 bg-slate-50 py-16 md:py-20">
          <div className={container}>
            {sectionHeading('Transparency', t.overview, 'Totals of legislative records on file with the Office of the Secretary to the Sanggunian.')}
            <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4">
              {publicStats.map((stat, index) => (
                <article
                  key={stat.label}
                  className={cn(
                    'flex flex-col p-6',
                    index > 0 && 'border-t border-slate-200 sm:border-t-0',
                    index % 2 === 1 && 'sm:border-l',
                    index >= 2 && 'sm:border-t lg:border-t-0',
                    index === 2 && 'lg:border-l'
                  )}
                >
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
                    <stat.icon className="h-4 w-4 text-primary" />
                    {stat.label}
                  </p>
                  <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{stat.value}</p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{stat.description}</p>
                  <button type="button" onClick={stat.action} className="mt-4 inline-flex items-center gap-1 self-start text-sm font-semibold text-primary hover:underline">
                    {stat.actionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Legislation */}
        <section id="legislation" className="scroll-mt-[65px] py-16 md:py-20">
          <div className={container}>
            {sectionHeading(
              'Public Inquiry',
              t.legislation,
              'Search ordinances, resolutions, incoming documents, and public resources. Open a record to view, download, or print a watermarked public copy.'
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="space-y-4 border-b border-slate-200 p-4 sm:p-5">
                <div className="-mx-1 overflow-x-auto px-1">
                  <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Record type">
                    {recordTabs.map((tab) => (
                      <button
                        key={tab.label}
                        type="button"
                        role="tab"
                        aria-selected={tab.active}
                        onClick={tab.apply}
                        className={cn(
                          'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                          tab.active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={inquiryKeyword}
                      onChange={(e) => setInquiryKeyword(e.target.value)}
                      placeholder="Keyword, record no., author, subject..."
                      className="pl-9"
                      aria-label="Search records"
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
                  <div className="grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-4">
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

                <p className="text-xs text-slate-500">
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
                      <TableHead className="text-left">Record No.</TableHead>
                      <TableHead className="text-left">Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInquiryResults.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="whitespace-nowrap text-left text-slate-600">{record.number}</TableCell>
                        <TableCell className="min-w-[280px] text-left">
                          <button type="button" onClick={() => openDoc(record.id)} className="text-left font-semibold text-slate-900 hover:text-primary hover:underline">
                            {record.title}
                          </button>
                          <div className="mt-0.5 text-xs text-slate-500">{record.referral}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-600">{record.classification}</TableCell>
                        <TableCell className="whitespace-nowrap text-slate-600">{record.date}</TableCell>
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
                        <TableCell colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
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
        <section id="sangguniang-bayan" className="scroll-mt-[65px] border-y border-slate-200 bg-slate-50 py-16 md:py-20">
          <div className={container}>
            {sectionHeading(
              'Legislative Body',
              t.sb,
              'The legislative body of the Municipality of Capas, presided over by the Municipal Vice Mayor. It enacts ordinances, adopts resolutions, and appropriates funds for the general welfare of the municipality and its inhabitants.'
            )}

            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Municipal Councilors', value: '8', icon: Users },
                { label: 'Ex-officio Members', value: '3', icon: ShieldCheck },
                { label: 'Standing Committees', value: String(mockCommittees.length), icon: Landmark },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-slate-900">{item.value}</p>
                    <p className="text-sm text-slate-500">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Composition of the Sangguniang Bayan</h3>
                  <p className="text-sm text-slate-500">{mockMembers.length} members · select a member to see their committee assignments</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf6e3] px-2 py-0.5 font-semibold text-[#8a6a12]">
                    <Gavel className="h-3 w-3" /> Chair
                  </span>
                  chairs at least one committee
                </span>
              </div>
              <CompositionChart onSelect={setPublicMemberId} />
            </div>

            <div className="mt-10">
              <h3 className="text-lg font-semibold text-slate-900">Standing Committees</h3>
              <p className="mt-1 text-sm text-slate-500">Select a committee to see the measures referred to it.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mockCommittees.map((committee) => (
                  <button
                    key={committee.id}
                    type="button"
                    onClick={() => {
                      resetFilters();
                      setSelectedReferral(committee.name);
                      scrollToSection('legislation');
                    }}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left text-sm font-medium text-slate-700 transition-colors hover:border-primary/30 hover:text-primary"
                  >
                    {committee.name}
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Sessions */}
        <section id="public-sessions" className="scroll-mt-[65px] py-16 md:py-20">
          <div className={container}>
            {sectionHeading(
              'Schedule',
              t.sessions,
              `Sessions are open to the public and held at the ${LGU_PROFILE.sessionHall}. View the order of business, add a session to your calendar, or print the agenda.`
            )}

            <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-3">
                {mockSessions.map((session) => {
                  const date = new Date(`${session.date}T00:00:00`);
                  return (
                    <article
                      key={session.id}
                      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-center">
                        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{date.toLocaleDateString('en-PH', { month: 'short' })}</span>
                          <span className="text-2xl font-bold leading-none text-slate-900">{date.getDate()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', sessionTypeStyle(session.type))}>{session.type}</span>
                          <h3 className="mt-1.5 font-semibold text-slate-900">{session.title}</h3>
                          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
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
                      </div>
                      <div className="flex gap-2 sm:shrink-0">
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setAgendaSessionId(session.id)}>
                          <Eye className="mr-1.5 h-4 w-4" />
                          Agenda
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => addSessionToCalendar(session)} aria-label={`Add ${session.title} to calendar`}>
                          <CalendarPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="font-semibold text-slate-900">Recently Approved Measures</h3>
                <p className="mt-1 text-sm text-slate-500">Ordinances and resolutions approved by the SB.</p>
                <ul className="mt-4 divide-y divide-slate-200">
                  {publicLegislationRecords
                    .filter((r) => ['Passed', 'Enacted'].includes(r.status))
                    .slice(0, 5)
                    .map((record) => (
                      <li key={record.id} className="py-3">
                        <button type="button" onClick={() => openDoc(record.id)} className="group w-full text-left">
                          <span className="text-xs font-semibold text-primary">{record.number}</span>
                          <span className="mt-0.5 block text-sm font-medium text-slate-800 group-hover:text-primary group-hover:underline">{record.title}</span>
                        </button>
                      </li>
                    ))}
                </ul>
                <Button variant="outline" className="mt-4 w-full rounded-lg bg-white" onClick={() => applyQuickFilter({ type: 'Legislation' })}>
                  View all legislation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </aside>
            </div>
          </div>
        </section>

        {/* Resources */}
        <section id="resources" className="scroll-mt-[65px] border-y border-slate-200 bg-slate-50 py-16 md:py-20">
          <div className={container}>
            {sectionHeading('Downloads', t.resources, 'Guides, archives, and forms for citizens and organizations. Downloaded and printed copies carry a public-copy watermark.')}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {resourceCards.map((card) => {
                const record = recordById(card.id);
                return (
                  <article key={card.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10">
                      <card.icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 font-semibold text-slate-900">{card.title}</h3>
                    <p className="mt-1 flex-1 text-sm text-slate-600">{card.description}</p>
                    <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
                      <Button size="sm" variant="outline" className="h-8 flex-1 rounded-lg" onClick={() => openDoc(card.id)}>
                        <Eye className="mr-1.5 h-4 w-4" />
                        View
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg p-0" onClick={() => downloadRecord(record)} aria-label={`Download ${card.title}`} title="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg p-0" onClick={() => printRecord(record)} aria-label={`Print ${card.title}`} title="Print">
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <article id="register" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10">
                  <UserPlus className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Register for Legislative Updates</h3>
                <p className="mt-1 text-sm text-slate-600">Receive notices of new ordinances, resolutions, and public hearings.</p>
                <form onSubmit={handlePublicRegistration} className="mt-5 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input value={publicName} onChange={(e) => setPublicName(e.target.value)} placeholder="Full name" aria-label="Full name" />
                    <Input value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} type="email" placeholder="Email address" aria-label="Email address" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={notifyUpdates} onChange={(e) => setNotifyUpdates(e.target.checked)} className="h-4 w-4 accent-primary" />
                    Subscribe to ordinance and resolution updates
                  </label>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button type="submit" className="rounded-lg font-semibold">
                      Register
                    </Button>
                    <button type="button" onClick={() => setPolicyDialog('privacy')} className="text-xs text-slate-500 underline hover:text-primary">
                      How we use your data
                    </button>
                  </div>
                  {registrationNotice ? <p className="text-sm font-medium text-primary">{registrationNotice}</p> : null}
                </form>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Check Accreditation Status</h3>
                <p className="mt-1 text-sm text-slate-600">Enter the reference number of your organization&apos;s accreditation request.</p>
                <form onSubmit={handleAccreditationLookup} className="mt-5 flex gap-2">
                  <Input
                    value={accreditationQuery}
                    onChange={(e) => {
                      setAccreditationQuery(e.target.value);
                      setAccreditationResult(null);
                    }}
                    placeholder="e.g. ACC-2026-005"
                    aria-label="Accreditation reference number"
                  />
                  <Button type="submit" className="rounded-lg font-semibold">
                    Check
                  </Button>
                </form>
                {accreditationResult ? (
                  <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-primary">{accreditationResult}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => downloadRecord(recordById('res-2'))}>
                    <Download className="mr-1.5 h-4 w-4" />
                    Download accreditation form
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => openRequestDialog()}>
                    <FileSearch className="mr-1.5 h-4 w-4" />
                    Request a document
                  </Button>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* News */}
        <section id="news" className="scroll-mt-[65px] py-16 md:py-20">
          <div className={container}>
            {sectionHeading('Updates', t.news, 'Recent actions, notices, and announcements from the Sangguniang Bayan ng Capas.')}
            <div className="grid gap-4 lg:grid-cols-3">
              {NEWS.map((item) => (
                <article
                  key={item.id}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-18px_rgba(15,23,42,0.35)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-medium text-slate-500">{item.date}</span>
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-primary">{item.category}</p>
                  <h3 className="mt-1.5 text-lg font-semibold leading-snug text-slate-900">{item.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{item.summary}</p>
                  <button type="button" onClick={() => setActiveNewsId(item.id)} className="mt-5 inline-flex items-center gap-1 self-start text-sm font-semibold text-primary hover:underline">
                    Read more
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Transparency links */}
        <section aria-labelledby="transparency-heading" className="border-t border-slate-200 bg-slate-50 py-12">
          <div className={container}>
            <h2 id="transparency-heading" className="text-sm font-semibold text-slate-900">
              Transparency and Accountability
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TRANSPARENCY_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-primary/30"
                >
                  <link.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    <span className="flex items-center gap-1 text-sm font-semibold text-slate-900 group-hover:text-primary">
                      {link.label}
                      <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{link.description}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* GOVPH footer */}
      <footer id="contact" className="scroll-mt-[65px] bg-[#0a0f3d] text-sm text-white/65">
        <div className={cn(container, 'grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]')}>
          <div>
            <div className="flex items-center gap-3">
              <img src="/capas-logo.jpg" alt="Seal of the Municipality of Capas" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/15" />
              <div>
                <p className="font-semibold text-white">{LGU_PROFILE.legislature}</p>
                <p className="text-xs text-white/55">
                  {LGU_PROFILE.municipality}, {LGU_PROFILE.province}
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-sm leading-relaxed">All content is in the public domain unless otherwise stated.</p>
          </div>

          <div>
            <h2 className="font-semibold text-white">Contact the SB Office</h2>
            <ul className="mt-4 space-y-3">
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />
                <span>
                  Office of the Sangguniang Bayan
                  <br />
                  {LGU_PROFILE.address}
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-white/45" />
                <a href={`mailto:${LGU_PROFILE.email}`} className="hover:text-white">
                  {LGU_PROFILE.email}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-white/45" />
                <a href={`viber://chat?number=${LGU_PROFILE.viber.replace(/\s+/g, '')}`} className="hover:text-white">
                  Viber: {LGU_PROFILE.viber}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <ExternalLink className="h-4 w-4 shrink-0 text-white/45" />
                <a href="https://www.capas.gov.ph" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  Municipality of Capas website
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-white">About GOVPH</h2>
            <p className="mt-4 leading-relaxed">Learn more about the Philippine government, its structure, how government works, and the people behind it.</p>
            <ul className="mt-3 space-y-2">
              {ABOUT_GOVPH_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-white">Government Links</h2>
            <ul className="mt-4 space-y-2">
              {GOVERNMENT_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className={cn(container, 'flex flex-col items-center justify-between gap-4 py-5 text-xs md:flex-row')}>
            <p>© 2026 {LGU_PROFILE.legislature}. All rights reserved.</p>
            <div className="flex flex-wrap items-center justify-center gap-5">
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
                className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1 hover:bg-white/10 hover:text-white"
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
              <span className="font-mono font-semibold text-text-main">{DEMO_PASSWORD}</span>
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

      <EgovAiChat />
    </div>
  );
}
