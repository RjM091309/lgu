import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { DataTable } from '@/components/ui/DataTable';
import { LGU_PROFILE, mockBills, mockCommitteeHearings, mockCommittees, mockMembers, mockSessions, mockYearlyActivity } from '@/lib/mock-data';
import { openPrintWindow, saveCsv, saveFile } from '@/lib/files';
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
import { DEMO_PASSWORD, findLoginAccount } from '@/lib/access-store';
import { EgovAiChat } from '@/components/public/EgovAiChat';
import { LANDING_COPY, type Lang } from '@/components/public/landing-copy';
import { HeroSlider, type HeroSlide } from '@/components/public/HeroSlider';
import { ProcessSimulation } from '@/components/public/ProcessSimulation';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LandingPageProps {
  onLogin: (remember: boolean, userId: string) => void;
}

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
    title: 'Regional Winner, Local Legislative Award',
    date: '2022–2025 Term',
    summary: 'The municipal legislative council was recognized as Regional Winner of the Local Legislative Award for the 2022–2025 term.',
    body: [
      'The municipal legislative council was recognized as Regional Winner of the Local Legislative Award for the 2022–2025 term.',
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
    date: 'September 2026',
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
  const t = LANDING_COPY[lang];
  const [now, setNow] = useState(() => new Date());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const [activeSection, setActiveSection] = useState<string>('home');
  const [heroKeyword, setHeroKeyword] = useState('');
  const [heroOpen, setHeroOpen] = useState(false);
  const [heroActive, setHeroActive] = useState(-1);

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
  const [selectedYear, setSelectedYear] = useState('All');
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

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactError, setContactError] = useState('');
  const [contactNotice, setContactNotice] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Screen readers pick the right pronunciation from the page language.
  useEffect(() => {
    document.documentElement.lang = lang === 'FIL' ? 'fil' : 'en';
  }, [lang]);

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

  const philippineTime = new Intl.DateTimeFormat(lang === 'FIL' ? 'fil-PH' : 'en-PH', {
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
      setLoginError(t.loginMissing);
      toast(t.signInFailed, t.loginMissing, 'error');
      return;
    }
    // Every sample account shares the demo password; each signs in with its own role.
    const account = password === DEMO_PASSWORD ? findLoginAccount(username) : null;
    if (account && account.status === 'Inactive') {
      setLoginError(t.loginDeactivated);
      toast(t.signInFailed, t.accountDeactivated, 'error');
      return;
    }
    if (account) {
      toast(t.signedIn, t.welcomeAs(account.name, account.role));
      onLogin(rememberMe, account.id);
      return;
    }
    setLoginError(t.loginInvalid);
    toast(t.signInFailed, t.loginInvalid, 'error');
  };

  const handlePublicRegistration = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!publicName.trim() || !publicEmail.trim()) {
      setRegistrationNotice(t.needNameEmail);
      toast(t.registrationNotSaved, t.needNameEmail, 'error');
      return;
    }
    if (!EMAIL_PATTERN.test(publicEmail.trim())) {
      setRegistrationNotice(t.invalidEmail);
      toast(t.registrationNotSaved, t.notValidEmail(publicEmail.trim()), 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: t.confirmRegistrationTitle,
      description: notifyUpdates
        ? t.confirmRegistrationSubscribed(publicName.trim(), publicEmail.trim())
        : t.confirmRegistration(publicName.trim(), publicEmail.trim()),
      confirmLabel: t.register,
      cancelLabel: t.cancel,
    });
    if (!confirmed) return;
    const notice = notifyUpdates ? t.registrationSubscribed : t.registrationNoUpdates;
    toast(t.registrationSaved, notice);
    logActivity({ user: 'public', module: 'Public Portal', action: 'Created', summary: 'Registered on the public portal', detail: notifyUpdates ? 'Subscribed to legislative updates.' : undefined });
    setRegistrationNotice(notice);
    setPublicName('');
    setPublicEmail('');
    setNotifyUpdates(true);
  };

  const handleAccreditationLookup = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const key = accreditationQuery.trim().toUpperCase();
    if (!key) {
      setAccreditationResult(t.enterReference);
      toast(t.lookupFailed, t.enterReference, 'error');
      return;
    }
    if (ACCREDITATION_STATUS[key]) {
      setAccreditationResult(`${key}: ${ACCREDITATION_STATUS[key]}`);
      toast(t.accFound, `${key}: ${ACCREDITATION_STATUS[key]}`);
    } else {
      setAccreditationResult(t.accNotFound(key));
      toast(t.accNotFoundTitle, t.accNotFound(key), 'error');
    }
  };

  const handleDocumentRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!requestName.trim() || !requestEmail.trim() || !requestRecord.trim()) {
      setRequestError(t.requestIncomplete);
      toast(t.requestNotSubmitted, t.requestIncomplete, 'error');
      return;
    }
    if (!EMAIL_PATTERN.test(requestEmail.trim())) {
      setRequestError(t.invalidEmail);
      toast(t.requestNotSubmitted, t.notValidEmail(requestEmail.trim()), 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: t.confirmRequestTitle,
      description: t.confirmRequest(requestRecord.trim(), requestEmail.trim()),
      confirmLabel: t.submitRequest,
      cancelLabel: t.cancel,
    });
    if (!confirmed) return;
    const reference = `REQ-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;
    setRequestError('');
    setRequestReference(reference);
    toast(t.requestSubmitted, t.yourReference(reference));
    logActivity({ user: 'public', module: 'Public Portal', action: 'Created', summary: 'Submitted a certified copy request', detail: `Reference number ${reference}.` });
  };

  const handleContactInquiry = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setContactNotice('');
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      setContactError(t.inquiryIncomplete);
      toast(t.inquiryNotSent, t.inquiryIncomplete, 'error');
      return;
    }
    if (!EMAIL_PATTERN.test(contactEmail.trim())) {
      setContactError(t.invalidEmail);
      toast(t.inquiryNotSent, t.notValidEmail(contactEmail.trim()), 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: t.confirmInquiryTitle,
      description: t.confirmInquiry(contactEmail.trim()),
      confirmLabel: t.sendInquiry,
      cancelLabel: t.cancel,
    });
    if (!confirmed) return;
    const reference = `INQ-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;
    setContactError('');
    setContactNotice(t.inquiryReceived(reference, contactEmail.trim()));
    toast(t.inquirySent, t.yourReference(reference));
    logActivity({ user: 'public', module: 'Public Portal', action: 'Created', summary: 'Sent an inquiry to the SB Secretariat', detail: `Reference number ${reference}.` });
    setContactName('');
    setContactEmail('');
    setContactSubject('');
    setContactMessage('');
  };

  const openRequestDialog = (recordNumber = '') => {
    setRequestReference(null);
    setRequestError('');
    setRequestRecord(recordNumber);
    setRequestOpen(true);
  };

  // Counted from the same data the portal lists, so a total always matches what "Browse" shows.
  const currentYear = mockYearlyActivity[mockYearlyActivity.length - 1];
  const hearingsThisYear = mockCommitteeHearings.reduce((sum, row) => sum + row.monthly.reduce((a, b) => a + b, 0), 0);
  const countByClassification = (classification: string) => mockBills.filter((bill) => (bill.classification ?? 'Ordinance') === classification).length;

  const publicStats = [
    {
      ...t.stats.ordinances,
      value: String(countByClassification('Ordinance')),
      icon: ScrollText,
      onClick: () => applyQuickFilter({ classification: 'Ordinance' }),
    },
    {
      ...t.stats.resolutions,
      value: String(countByClassification('Resolution')),
      icon: FileText,
      onClick: () => applyQuickFilter({ classification: 'Resolution' }),
    },
    {
      ...t.stats.sessions,
      value: String(currentYear.sessionsHeld),
      icon: CalendarDays,
      onClick: () => scrollToSection('public-sessions'),
    },
    {
      ...t.stats.hearings,
      value: String(hearingsThisYear),
      icon: Gavel,
      onClick: () => scrollToSection('public-sessions'),
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

  // Filter values stay in English (they are record data); only the "All" choice and record types are translated.
  const asOptions = (values: string[], labels: Record<string, string> = {}): SelectOption[] =>
    values.map((value) => ({ value, label: value === 'All' ? t.all : labels[value] ?? value }));

  const statusOptions = useMemo(() => asOptions(uniqueValues((r) => r.status)), [lang]);
  const categoryOptions = useMemo(() => asOptions(uniqueValues((r) => r.category)), [lang]);
  const yearOptions = useMemo(
    () => asOptions(['All', ...Array.from(new Set(allRecords.map((r) => r.date.slice(0, 4)))).sort((a, b) => b.localeCompare(a))]),
    [lang]
  );
  const typeOptions = useMemo(() => asOptions(['All', 'Legislation', 'Incoming Document', 'Resource'], t.recordTypes), [lang]);
  const subjectOptions = useMemo(() => asOptions(uniqueValues((r) => r.subject)), [lang]);
  const referralOptions = useMemo(() => asOptions(uniqueValues((r) => r.referral)), [lang]);
  const classificationOptions = useMemo(() => asOptions(uniqueValues((r) => r.classification)), [lang]);
  const actionTakenOptions = useMemo(() => asOptions(uniqueValues((r) => r.actionTaken)), [lang]);
  const authorshipOptions = useMemo(() => asOptions(uniqueValues((r) => r.authorshipType)), [lang]);
  const sponsorOptions = useMemo(() => asOptions(uniqueValues((r) => r.sponsor)), [lang]);
  const coAuthorOptions = useMemo(() => asOptions(uniqueValues((r) => r.coAuthor)), [lang]);

  // An untouched filter shows its placeholder (the filter's name) instead of "All", so each dropdown says what it filters.
  const pickOption = (options: SelectOption[], value: string) => (value === 'All' ? null : options.find((o) => o.value === value) ?? null);

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
    setSelectedYear('All');
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
    setHeroOpen(false);
    applyQuickFilter({ keyword: heroKeyword.trim() });
  };

  // Live results under the hero search box, updated on every keystroke.
  const heroTokens = heroKeyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const heroMatches = useMemo(() => {
    if (heroTokens.length === 0) return [];
    const scored = allRecords
      .map((record) => {
        const haystack = [record.number, record.title, record.author, record.subject, record.category, record.classification].join(' ').toLowerCase();
        if (!heroTokens.every((token) => haystack.includes(token))) return null;
        // Record numbers and title beginnings first, then the rest in their usual order.
        const first = heroTokens[0];
        const score = record.number.toLowerCase().includes(first) ? 0 : record.title.toLowerCase().startsWith(first) ? 1 : 2;
        return { record, score };
      })
      .filter((entry): entry is { record: PublicInquiryRecord; score: number } => entry !== null);
    return scored.sort((a, b) => a.score - b.score).map((entry) => entry.record);
    // allRecords is rebuilt each render from static data; the keyword is the real input.
  }, [heroKeyword]);
  const heroShown = heroMatches.slice(0, 6);

  const openHeroResult = (record: PublicInquiryRecord) => {
    setHeroOpen(false);
    setHeroActive(-1);
    openDoc(record.id);
  };

  const onHeroKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setHeroOpen(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setHeroOpen(true);
      if (heroShown.length === 0) return;
      setHeroActive((index) => (e.key === 'ArrowDown' ? (index + 1) % heroShown.length : index <= 0 ? heroShown.length - 1 : index - 1));
      return;
    }
    if (e.key === 'Enter' && heroOpen && heroActive >= 0 && heroShown[heroActive]) {
      e.preventDefault();
      openHeroResult(heroShown[heroActive]);
    }
  };

  // Marks the typed words inside a result so it is clear why it matched.
  const highlight = (text: string) => {
    if (heroTokens.length === 0) return text;
    const pattern = new RegExp(`(${heroTokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return text.split(pattern).map((part, index) =>
      index % 2 === 1 ? (
        <mark key={index} className="rounded-sm bg-[#fdf1c7] text-inherit">
          {part}
        </mark>
      ) : (
        part
      )
    );
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
        (selectedCoAuthor === 'All' || record.coAuthor === selectedCoAuthor) &&
        (selectedYear === 'All' || record.date.startsWith(selectedYear))
      );
    });
    // allRecords is rebuilt each render from static data; the filters are the real inputs.
  }, [
    selectedYear,
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
    selectedYear,
  ].filter((value) => value !== 'All').length + (inquiryKeyword.trim() ? 1 : 0);

  // Human-readable summary of the active filters, printed on the listing so a copy shows what it covers.
  const activeFilterSummary = [
    inquiryKeyword.trim() ? `"${inquiryKeyword.trim()}"` : '',
    ...(
      [
        [t.filters.type, selectedType === 'All' ? 'All' : t.recordTypes[selectedType] ?? selectedType],
        [t.filters.status, selectedStatus],
        [t.filters.category, selectedCategory],
        [t.filters.year, selectedYear],
        [t.filters.subject, selectedSubject],
        [t.filters.referral, selectedReferral],
        [t.filters.classification, selectedClassification],
        [t.filters.actionTaken, selectedActionTaken],
        [t.filters.authorship, selectedAuthorship],
        [t.filters.sponsor, selectedSponsor],
        [t.filters.coAuthor, selectedCoAuthor],
      ] as const
    )
      .filter(([, value]) => value !== 'All')
      .map(([label, value]) => `${label}: ${value}`),
  ].filter(Boolean);

  const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const exportResults = () => {
    if (unifiedInquiryResults.length === 0) {
      toast(t.exportCsv, t.nothingToExport, 'error');
      return;
    }
    const saved = saveCsv(
      `sb-capas-public-records-${new Date().toISOString().slice(0, 10)}.csv`,
      [t.table.number, t.table.title, t.table.type, t.table.date, t.table.status, t.table.author, t.table.referral],
      unifiedInquiryResults.map((r) => [r.number, r.title, r.classification, r.date, r.status, r.author, r.referral])
    );
    if (!saved) toast(t.exportCsv, t.downloadFailed, 'error');
  };

  const printResults = () => {
    if (unifiedInquiryResults.length === 0) {
      toast(t.printList, t.nothingToExport, 'error');
      return;
    }
    const rows = unifiedInquiryResults
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.number)}</td><td>${escapeHtml(r.title)}</td><td>${escapeHtml(r.classification)}</td><td>${r.date}</td><td>${escapeHtml(r.status)}</td></tr>`
      )
      .join('');
    const opened = openPrintWindow(
      t.listTitle,
      `
      <div class="card">
        <div class="watermark">${watermarkText}</div>
        <div class="title">${t.listTitle}</div>
        <div class="rows">
          <div><b>${t.listFilters}</b>: ${escapeHtml(activeFilterSummary.join(' · ') || t.listNone)}</div>
          <div><b>${t.listGenerated}</b>: ${philippineTime}</div>
          <div>${t.recordsFound(unifiedInquiryResults.length)}</div>
        </div>
        <table>
          <thead><tr><th>${t.table.number}</th><th>${t.table.title}</th><th>${t.table.type}</th><th>${t.table.date}</th><th>${t.table.status}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
    );
    if (!opened) toast(t.printList, t.popupBlocked, 'error');
  };

  const recordTabs = [
    { label: t.tabs.all, active: selectedType === 'All' && selectedClassification === 'All', apply: () => applyTab('All', 'All') },
    { label: t.tabs.ordinances, active: selectedClassification === 'Ordinance', apply: () => applyTab('Legislation', 'Ordinance') },
    { label: t.tabs.resolutions, active: selectedClassification === 'Resolution', apply: () => applyTab('Legislation', 'Resolution') },
    { label: t.tabs.incoming, active: selectedType === 'Incoming Document', apply: () => applyTab('Incoming Document', 'All') },
    { label: t.tabs.resources, active: selectedType === 'Resource', apply: () => applyTab('Resource', 'All') },
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
    { id: 'res-1', ...t.resourceCards['res-1'], icon: BookOpen },
    { id: 'res-3', ...t.resourceCards['res-3'], icon: Archive },
    { id: 'res-4', ...t.resourceCards['res-4'], icon: ClipboardList },
    { id: 'res-2', ...t.resourceCards['res-2'], icon: FileText },
  ];

  const serviceTiles = [
    { ...t.tiles.ordinances, icon: ScrollText, action: () => applyQuickFilter({ classification: 'Ordinance' }) },
    { ...t.tiles.resolutions, icon: FileText, action: () => applyQuickFilter({ classification: 'Resolution' }) },
    { ...t.tiles.calendar, icon: CalendarDays, action: () => scrollToSection('public-sessions') },
    { ...t.tiles.members, icon: Users, action: () => scrollToSection('sangguniang-bayan') },
    { ...t.tiles.request, icon: FileSearch, action: () => openRequestDialog() },
    { ...t.tiles.register, icon: UserPlus, action: () => scrollToSection('register') },
  ];

  const hearingSession = mockSessions.find((session) => session.id === 's2');

  const heroSlides: HeroSlide[] = [
    {
      id: 'welcome',
      kicker: `${t.heroKicker} · Capas, Tarlac`,
      title: t.heroTitle,
      text: t.heroText,
      icon: Gavel,
      tone: 'navy',
      actions: [
        { label: t.slides.welcome.browse, icon: ScrollText, primary: true, onClick: () => applyQuickFilter({}) },
        { label: t.sessionCalendar, icon: CalendarDays, onClick: () => scrollToSection('public-sessions') },
      ],
    },
    {
      id: 'hearing',
      ...t.slides.hearing,
      icon: Megaphone,
      tone: 'violet',
      actions: [
        { label: t.slides.hearing.read, icon: Megaphone, primary: true, onClick: () => setActiveNewsId('news-hearing') },
        ...(hearingSession ? [{ label: t.addToCalendar, icon: CalendarPlus, onClick: () => addSessionToCalendar(hearingSession) }] : []),
      ],
    },
    {
      id: 'award',
      ...t.slides.award,
      icon: Award,
      tone: 'gold',
      actions: [
        { label: t.slides.award.read, icon: Award, primary: true, onClick: () => setActiveNewsId('news-lla') },
        { label: t.slides.award.meet, icon: Users, onClick: () => scrollToSection('sangguniang-bayan') },
      ],
    },
    {
      id: 'heritage',
      ...t.slides.heritage,
      icon: Landmark,
      tone: 'teal',
      actions: [
        { label: t.slides.heritage.view, icon: Eye, primary: true, onClick: () => openDoc('leg-3') },
        { label: t.tiles.ordinances.title, icon: ScrollText, onClick: () => applyQuickFilter({ classification: 'Ordinance' }) },
      ],
    },
    {
      id: 'register',
      ...t.slides.register,
      icon: UserPlus,
      tone: 'navy',
      actions: [
        { label: t.slides.register.register, icon: UserPlus, primary: true, onClick: () => scrollToSection('register') },
        { label: t.slides.register.inquiry, icon: Mail, onClick: () => scrollToSection('contact') },
      ],
    },
  ];

  const mapQuery = encodeURIComponent(LGU_PROFILE.address.replace(/ \d{4}$/, ''));
  const dateLocale = lang === 'FIL' ? 'fil-PH' : 'en-PH';

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
        {t.skipToMain}
      </a>

      {/* Top bar: Philippine time, language, and staff login */}
      <div className="bg-[#0a0f3d] text-xs text-white/70">
        <div className={cn(container, 'flex h-9 items-center justify-end gap-4')}>
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
            <img src="/lims-logo.svg" alt={t.logoAlt} className="h-10 w-10 shrink-0 rounded-full object-cover" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-tight text-slate-900">LIMS</span>
              <span className="block truncate text-xs text-slate-500">{t.systemName}</span>
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
                      'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
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
              {t.requestDocument}
            </Button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? t.closeMenu : t.openMenu}
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
                  {t.requestDocument}
                </Button>
              </li>
            </ul>
          </nav>
        ) : null}
      </header>

      <main>
        {/* Hero: rotating announcements; the search bar and the next-session card stay in place. */}
        <HeroSlider
          slides={heroSlides}
          labels={t.heroSlider}
          below={
            <>
              <div className="relative max-w-xl">
                <form
                  onSubmit={handleHeroSearch}
                  className="flex items-center gap-2 rounded-xl border border-white/20 bg-white p-1.5 shadow-lg focus-within:ring-4 focus-within:ring-[#d4a72c]/40"
                  role="search"
                >
                  <label htmlFor="hero-search" className="sr-only">
                    {t.searchPlaceholder}
                  </label>
                  <Search className="ml-2.5 h-5 w-5 shrink-0 text-slate-400" />
                  <input
                    id="hero-search"
                    value={heroKeyword}
                    onChange={(e) => {
                      setHeroKeyword(e.target.value);
                      setHeroOpen(true);
                      setHeroActive(-1);
                    }}
                    onFocus={() => setHeroOpen(true)}
                    onBlur={() => setHeroOpen(false)}
                    onKeyDown={onHeroKeyDown}
                    placeholder={t.searchPlaceholder}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={heroOpen && heroTokens.length > 0}
                    aria-controls="hero-search-results"
                    aria-autocomplete="list"
                    aria-activedescendant={heroActive >= 0 ? `hero-result-${heroActive}` : undefined}
                    className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  {heroKeyword ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setHeroKeyword('');
                        setHeroActive(-1);
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={t.clearSearch}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                  <Button type="submit" className="h-10 shrink-0 rounded-lg px-5 font-semibold">
                    {t.search}
                  </Button>
                </form>

                {heroOpen && heroTokens.length > 0 ? (
                  // Mouse-down is cancelled so the input keeps focus and the click lands on the result.
                  <div
                    className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white text-left text-slate-900 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.35)]"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {heroShown.length > 0 ? (
                      <ul id="hero-search-results" role="listbox" aria-label={t.searchSuggestions} className="max-h-[360px] overflow-y-auto py-1.5">
                        {heroShown.map((record, index) => (
                          <li
                            key={record.id}
                            id={`hero-result-${index}`}
                            role="option"
                            aria-selected={index === heroActive}
                            onClick={() => openHeroResult(record)}
                            onMouseEnter={() => setHeroActive(index)}
                            className={cn('flex cursor-pointer items-start gap-3 px-4 py-2.5', index === heroActive ? 'bg-primary/[0.06]' : 'hover:bg-slate-50')}
                          >
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10">
                              {record.classification === 'Ordinance' ? (
                                <ScrollText className="h-4 w-4" />
                              ) : record.recordType === 'Resource' ? (
                                <BookOpen className="h-4 w-4" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="font-semibold text-primary">{highlight(record.number)}</span>
                                <span aria-hidden>·</span>
                                <span>{record.classification}</span>
                              </span>
                              <span className="mt-0.5 line-clamp-2 block text-sm font-medium leading-snug text-slate-900">{highlight(record.title)}</span>
                            </span>
                            <span className="mt-0.5 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{record.status}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div id="hero-search-results" className="px-4 py-5 text-center">
                        <p className="text-sm font-medium text-slate-900">{t.noMatches(heroKeyword.trim())}</p>
                        <p className="mt-1 text-xs text-slate-500">{t.noMatchesHint}</p>
                      </div>
                    )}
                    {heroMatches.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setHeroOpen(false);
                          applyQuickFilter({ keyword: heroKeyword.trim() });
                        }}
                        className="flex w-full items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-slate-100"
                      >
                        {t.seeResults(heroMatches.length)}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-white/60">{t.quickLinks}</span>
                {[
                  { label: t.ordinances, action: () => applyQuickFilter({ classification: 'Ordinance' }) },
                  { label: t.resolutions, action: () => applyQuickFilter({ classification: 'Resolution' }) },
                  { label: t.sessionCalendar, action: () => scrollToSection('public-sessions') },
                ].map((link) => (
                  <button
                    key={link.label}
                    type="button"
                    onClick={link.action}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1 font-medium text-white/90 transition-colors hover:bg-white/15 hover:text-white"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </>
          }
          aside={
            nextSession && nextSessionDate ? (
              <motion.aside
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.45)]"
                aria-label={t.nextSession}
              >
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    {t.nextSession}
                  </p>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', sessionTypeStyle(nextSession.type))}>{t.sessionTypes[nextSession.type]}</span>
                </div>

                <div className="mt-5 flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-white">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-white/75">
                      {nextSessionDate.toLocaleDateString(dateLocale, { month: 'short' })}
                    </span>
                    <span className="text-2xl font-bold leading-none">{nextSessionDate.getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-snug text-slate-900">{nextSession.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{formatLongDate(nextSession.date, dateLocale)}</p>
                  </div>
                </div>

                <dl className="mt-5 space-y-2.5 border-t border-slate-100 pt-5 text-sm">
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                    <dt className="sr-only">{t.time}</dt>
                    <dd>{nextSession.time}</dd>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                    <dt className="sr-only">{t.venue}</dt>
                    <dd>{nextSession.location}</dd>
                  </div>
                </dl>

                <div className="mt-6 grid grid-cols-2 gap-2">
                  <Button onClick={() => setAgendaSessionId(nextSession.id)} className="rounded-lg font-semibold">
                    <Eye className="mr-2 h-4 w-4" />
                    {t.viewAgenda}
                  </Button>
                  <Button variant="outline" onClick={() => addSessionToCalendar(nextSession)} className="rounded-lg font-semibold">
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    {t.addToCalendar}
                  </Button>
                </div>
              </motion.aside>

            ) : null
          }
        />

        {/* Public services */}
        <section aria-labelledby="services-heading" className="py-16 md:py-20">
          <div className={container}>
            <div className="mb-10 max-w-3xl">
              <p className="text-sm font-semibold text-primary">{t.services}</p>
              <h2 id="services-heading" className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                {t.helpTitle}
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
            {sectionHeading(t.transparencyKicker, t.overview, t.overviewText)}
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
                  <button type="button" onClick={stat.onClick} className="mt-4 inline-flex items-center gap-1 self-start text-sm font-semibold text-primary hover:underline">
                    {stat.action}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Legislative process */}
        <section aria-labelledby="process-heading" className="border-b border-slate-200 py-16 md:py-20">
          <div className={container}>
            <div className="mb-10 max-w-3xl">
              <p className="text-sm font-semibold text-primary">{t.process.kicker}</p>
              <h2 id="process-heading" className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                {t.process.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600">{t.process.text}</p>
            </div>
            <ProcessSimulation
              copy={t.process}
              bills={mockBills}
              onViewStage={(status) => {
                resetFilters();
                setSelectedType('Legislation');
                setSelectedStatus(status);
                scrollToSection('legislation');
              }}
              onViewRecord={(billId) => openDoc(`leg-${billId}`)}
            />
          </div>
        </section>

        {/* Legislation */}
        <section id="legislation" className="scroll-mt-[65px] py-16 md:py-20">
          <div className={container}>
            {sectionHeading(t.inquiryKicker, t.legislation, t.legislationText)}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="space-y-4 border-b border-slate-200 p-4 sm:p-5">
                <div className="-mx-1 overflow-x-auto px-1">
                  <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label={t.tabsLabel}>
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

                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[2fr_1fr_1fr_1fr_auto_auto]">
                  <div className="relative sm:col-span-2 md:col-span-3 xl:col-span-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={inquiryKeyword}
                      onChange={(e) => setInquiryKeyword(e.target.value)}
                      placeholder={t.keywordPlaceholder}
                      className="pl-9"
                      aria-label={t.searchRecords}
                    />
                  </div>
                  <Select
                    options={statusOptions}
                    value={pickOption(statusOptions, selectedStatus)}
                    onChange={(opt) => setSelectedStatus(opt?.value ?? 'All')}
                    placeholder={t.filters.status}
                    aria-label={t.filters.status}
                  />
                  <Select
                    options={categoryOptions}
                    value={pickOption(categoryOptions, selectedCategory)}
                    onChange={(opt) => setSelectedCategory(opt?.value ?? 'All')}
                    placeholder={t.filters.category}
                    aria-label={t.filters.category}
                  />
                  <Select
                    options={yearOptions}
                    value={pickOption(yearOptions, selectedYear)}
                    onChange={(opt) => setSelectedYear(opt?.value ?? 'All')}
                    placeholder={t.filters.year}
                    aria-label={t.filters.year}
                    isSearchable={false}
                  />
                  <Button variant="outline" onClick={() => setShowAdvancedFilters((open) => !open)} aria-expanded={showAdvancedFilters}>
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    {showAdvancedFilters ? t.fewerFilters : t.moreFilters}
                  </Button>
                  <Button variant="outline" onClick={resetFilters} disabled={activeFilterCount === 0}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t.reset}
                  </Button>
                </div>

                {showAdvancedFilters ? (
                  <div className="grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-4">
                    <Select options={typeOptions} value={pickOption(typeOptions, selectedType)} onChange={(opt) => setSelectedType(opt?.value ?? 'All')} placeholder={t.filters.type} aria-label={t.filters.type} isSearchable={false} />
                    <Select options={subjectOptions} value={pickOption(subjectOptions, selectedSubject)} onChange={(opt) => setSelectedSubject(opt?.value ?? 'All')} placeholder={t.filters.subject} aria-label={t.filters.subject} />
                    <Select options={referralOptions} value={pickOption(referralOptions, selectedReferral)} onChange={(opt) => setSelectedReferral(opt?.value ?? 'All')} placeholder={t.filters.referral} aria-label={t.filters.referral} />
                    <Select
                      options={classificationOptions}
                      value={pickOption(classificationOptions, selectedClassification)}
                      onChange={(opt) => setSelectedClassification(opt?.value ?? 'All')}
                      placeholder={t.filters.classification}
                      aria-label={t.filters.classification}
                    />
                    <Select
                      options={actionTakenOptions}
                      value={pickOption(actionTakenOptions, selectedActionTaken)}
                      onChange={(opt) => setSelectedActionTaken(opt?.value ?? 'All')}
                      placeholder={t.filters.actionTaken}
                      aria-label={t.filters.actionTaken}
                    />
                    <Select
                      options={authorshipOptions}
                      value={pickOption(authorshipOptions, selectedAuthorship)}
                      onChange={(opt) => setSelectedAuthorship(opt?.value ?? 'All')}
                      placeholder={t.filters.authorship}
                      aria-label={t.filters.authorship}
                      isSearchable={false}
                    />
                    <Select options={sponsorOptions} value={pickOption(sponsorOptions, selectedSponsor)} onChange={(opt) => setSelectedSponsor(opt?.value ?? 'All')} placeholder={t.filters.sponsor} aria-label={t.filters.sponsor} />
                    <Select options={coAuthorOptions} value={pickOption(coAuthorOptions, selectedCoAuthor)} onChange={(opt) => setSelectedCoAuthor(opt?.value ?? 'All')} placeholder={t.filters.coAuthor} aria-label={t.filters.coAuthor} />
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    {t.recordsFound(unifiedInquiryResults.length)}
                    {activeFilterCount > 0 ? ` · ${t.filtersApplied(activeFilterCount)}` : ''}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={printResults}>
                      <Printer className="mr-1.5 h-4 w-4" />
                      {t.printList}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={exportResults}>
                      <Download className="mr-1.5 h-4 w-4" />
                      {t.exportCsv}
                    </Button>
                  </div>
                </div>
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
                labels={t.pagination}
              >
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">{t.table.number}</TableHead>
                      <TableHead className="text-left">{t.table.title}</TableHead>
                      <TableHead>{t.table.type}</TableHead>
                      <TableHead>{t.table.date}</TableHead>
                      <TableHead>{t.table.status}</TableHead>
                      <TableHead>
                        <span className="sr-only">{t.table.actions}</span>
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
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={t.actionsFor(record.number)}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-52">
                              <DropdownMenuItem onClick={() => openDoc(record.id)}>{t.view}</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadRecord(record)}>{t.downloadPublicCopy}</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printRecord(record)}>{t.printPublicCopy}</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openRequestDialog(record.number)}>{t.requestCertifiedCopy}</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedInquiryResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                          {t.noRecords}{' '}
                          <button type="button" onClick={resetFilters} className="font-semibold text-primary hover:underline">
                            {t.clearFilters}
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

        {/* Members and committees */}
        <section id="sangguniang-bayan" className="scroll-mt-[65px] border-y border-slate-200 bg-slate-50 py-16 md:py-20">
          <div className={container}>
            {sectionHeading(t.sbKicker, t.sb, t.sbText)}

            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              {[
                { label: t.councilors, value: String(mockMembers.filter((m) => m.seat === 'At-large').length), icon: Users },
                { label: t.exOfficio, value: String(mockMembers.filter((m) => m.seat === 'Ex-officio').length), icon: ShieldCheck },
                { label: t.standingCommittees, value: String(mockCommittees.length), icon: Landmark },
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
                  <h3 className="font-semibold text-slate-900">{t.compositionTitle}</h3>
                  <p className="text-sm text-slate-500">{t.compositionText(mockMembers.length)}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf6e3] px-2 py-0.5 font-semibold text-[#8a6a12]">
                    <Gavel className="h-3 w-3" /> {t.chair}
                  </span>
                  {t.chairLegend}
                </span>
              </div>
              <CompositionChart onSelect={setPublicMemberId} labels={t.composition} />
            </div>

            <div className="mt-10">
              <h3 className="text-lg font-semibold text-slate-900">{t.standingCommittees}</h3>
              <p className="mt-1 text-sm text-slate-500">{t.committeesHint}</p>
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
            {sectionHeading(t.scheduleKicker, t.sessions, t.sessionsText(LGU_PROFILE.sessionHall))}

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
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{date.toLocaleDateString(dateLocale, { month: 'short' })}</span>
                          <span className="text-2xl font-bold leading-none text-slate-900">{date.getDate()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', sessionTypeStyle(session.type))}>{t.sessionTypes[session.type]}</span>
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
                          {t.agenda}
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => addSessionToCalendar(session)} aria-label={t.addToCalendarFor(session.title)}>
                          <CalendarPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="font-semibold text-slate-900">{t.recentTitle}</h3>
                <p className="mt-1 text-sm text-slate-500">{t.recentText}</p>
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
                  {t.viewAllLegislation}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </aside>
            </div>
          </div>
        </section>

        {/* Resources */}
        <section id="resources" className="scroll-mt-[65px] border-y border-slate-200 bg-slate-50 py-16 md:py-20">
          <div className={container}>
            {sectionHeading(t.downloadsKicker, t.resources, t.resourcesText)}

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
                        {t.view}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg p-0" onClick={() => downloadRecord(record)} aria-label={`${t.download}: ${card.title}`} title={t.download}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg p-0" onClick={() => printRecord(record)} aria-label={`${t.print}: ${card.title}`} title={t.print}>
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
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{t.registerTitle}</h3>
                <p className="mt-1 text-sm text-slate-600">{t.registerText}</p>
                <form onSubmit={handlePublicRegistration} className="mt-5 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input value={publicName} onChange={(e) => setPublicName(e.target.value)} placeholder={t.fullName} aria-label={t.fullName} autoComplete="name" />
                    <Input value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} type="email" placeholder={t.emailAddress} aria-label={t.emailAddress} autoComplete="email" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={notifyUpdates} onChange={(e) => setNotifyUpdates(e.target.checked)} className="h-4 w-4 accent-primary" />
                    {t.subscribeLabel}
                  </label>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button type="submit" className="rounded-lg font-semibold">
                      {t.register}
                    </Button>
                    <button type="button" onClick={() => setPolicyDialog('privacy')} className="text-xs text-slate-500 underline hover:text-primary">
                      {t.howWeUseData}
                    </button>
                  </div>
                  {registrationNotice ? <p className="text-sm font-medium text-primary">{registrationNotice}</p> : null}
                </form>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{t.accTitle}</h3>
                <p className="mt-1 text-sm text-slate-600">{t.accText}</p>
                <form onSubmit={handleAccreditationLookup} className="mt-5 flex gap-2">
                  <Input
                    value={accreditationQuery}
                    onChange={(e) => {
                      setAccreditationQuery(e.target.value);
                      setAccreditationResult(null);
                    }}
                    placeholder={t.accPlaceholder}
                    aria-label={t.accLabel}
                  />
                  <Button type="submit" className="rounded-lg font-semibold">
                    {t.check}
                  </Button>
                </form>
                {accreditationResult ? (
                  <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-primary">{accreditationResult}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => downloadRecord(recordById('res-2'))}>
                    <Download className="mr-1.5 h-4 w-4" />
                    {t.downloadAccForm}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => openRequestDialog()}>
                    <FileSearch className="mr-1.5 h-4 w-4" />
                    {t.requestADocument}
                  </Button>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* News */}
        <section id="news" className="scroll-mt-[65px] py-16 md:py-20">
          <div className={container}>
            {sectionHeading(t.newsKicker, t.news, t.newsText)}
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
                    {t.readMore}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="scroll-mt-[65px] border-t border-slate-200 bg-slate-50 py-16 md:py-20">
          <div className={container}>
            {sectionHeading(t.contactKicker, t.contactTitle, t.contactText)}

            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <dl className="grid gap-5 p-6 sm:grid-cols-2">
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.officeAddress}</dt>
                      <dd className="mt-1 text-sm text-slate-800">
                        {t.officeName}
                        <br />
                        {LGU_PROFILE.address}
                      </dd>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.officeHours}</dt>
                      <dd className="mt-1 text-sm text-slate-800">{t.officeHoursValue}</dd>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.email}</dt>
                      <dd className="mt-1 break-words text-sm">
                        <a href={`mailto:${LGU_PROFILE.email}`} className="font-medium text-primary hover:underline">
                          {LGU_PROFILE.email}
                        </a>
                      </dd>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.viber}</dt>
                      <dd className="mt-1 text-sm">
                        <a href={`viber://chat?number=${LGU_PROFILE.viber.replace(/\s+/g, '')}`} className="font-medium text-primary hover:underline">
                          {LGU_PROFILE.viber}
                        </a>
                      </dd>
                    </div>
                  </div>
                </dl>
                <div className="relative min-h-[260px] flex-1 border-t border-slate-200 bg-slate-100">
                  <iframe
                    title={t.mapTitle}
                    src={`https://maps.google.com/maps?q=${mapQuery}&z=16&output=embed`}
                    className="absolute inset-0 h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 border-t border-slate-200 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/[0.03]"
                >
                  <MapPin className="h-4 w-4" />
                  {t.getDirections}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <article className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-inset ring-primary/10">
                  <Mail className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{t.inquiryTitle}</h3>
                <p className="mt-1 text-sm text-slate-600">{t.inquiryText}</p>
                <form onSubmit={handleContactInquiry} className="mt-5 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder={t.fullName} aria-label={t.fullName} autoComplete="name" />
                    <Input
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      type="email"
                      placeholder={t.emailAddress}
                      aria-label={t.emailAddress}
                      autoComplete="email"
                    />
                  </div>
                  <Input value={contactSubject} onChange={(e) => setContactSubject(e.target.value)} placeholder={t.subject} aria-label={t.subject} />
                  <textarea
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder={t.message}
                    aria-label={t.message}
                    rows={6}
                    maxLength={2000}
                    className="w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm text-text-main outline-none placeholder:text-slate-400 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                  {contactError ? (
                    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
                      {contactError}
                    </p>
                  ) : null}
                  {contactNotice ? (
                    <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900" role="status">
                      {contactNotice}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button type="submit" className="rounded-lg font-semibold">
                      {t.sendInquiry}
                    </Button>
                    <button type="button" onClick={() => setPolicyDialog('privacy')} className="text-xs text-slate-500 underline hover:text-primary">
                      {t.howWeUseData}
                    </button>
                  </div>
                </form>
              </article>
            </div>
          </div>
        </section>

        {/* Transparency links */}
        <section aria-labelledby="transparency-heading" className="border-t border-slate-200 bg-white py-12">
          <div className={container}>
            <h2 id="transparency-heading" className="text-sm font-semibold text-slate-900">
              {t.transparencyTitle}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TRANSPARENCY_LINKS.map((link, index) => (
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
                    <span className="mt-0.5 block text-xs text-slate-500">{t.transparencyDescriptions[index]}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* GOVPH footer */}
      <footer className="bg-[#0a0f3d] text-sm text-white/65">
        <div className={cn(container, 'grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]')}>
          <div>
            <div className="flex items-center gap-3">
              <img src="/lims-logo.svg" alt={t.logoAlt} className="h-12 w-12 rounded-full object-cover ring-2 ring-white/15" />
              <div>
                <p className="font-semibold text-white">{LGU_PROFILE.legislature}</p>
                <p className="text-xs text-white/55">
                  {LGU_PROFILE.municipality}, {LGU_PROFILE.province}
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-sm leading-relaxed">{t.publicDomain}</p>
          </div>

          <div>
            <h2 className="font-semibold text-white">{t.contactTitle}</h2>
            <ul className="mt-4 space-y-3">
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />
                <span>
                  {t.officeName}
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
                  {t.viber}: {LGU_PROFILE.viber}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <ExternalLink className="h-4 w-4 shrink-0 text-white/45" />
                <a href="https://www.capas.gov.ph" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  {t.municipalWebsite}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-white">{t.aboutGovph}</h2>
            <p className="mt-4 leading-relaxed">{t.aboutGovphText}</p>
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
            <h2 className="font-semibold text-white">{t.governmentLinks}</h2>
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
            <p>© 2026 {LGU_PROFILE.legislature}. {t.rightsReserved}</p>
            <div className="flex flex-wrap items-center justify-center gap-5">
              <button type="button" onClick={() => setPolicyDialog('privacy')} className="hover:text-white">
                {t.privacy}
              </button>
              <button type="button" onClick={() => setPolicyDialog('terms')} className="hover:text-white">
                {t.terms}
              </button>
              <button type="button" onClick={() => setPolicyDialog('accessibility')} className="hover:text-white">
                {t.accessibility}
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('home')}
                className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1 hover:bg-white/10 hover:text-white"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                {t.backToTop}
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
            <DialogTitle className="text-xl text-primary">{t.staffLogin}</DialogTitle>
            <DialogDescription>{t.loginText}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePortalLogin} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="portal-username" className="text-xs font-semibold text-text-muted">
                {t.username}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  id="portal-username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.enterUsername}
                  className="h-11 pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="portal-password" className="text-xs font-semibold text-text-muted">
                {t.password}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  id="portal-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.enterPassword}
                  className="h-11 pl-9"
                />
              </div>
            </div>
            <label htmlFor="portal-remember" className="flex items-center gap-2 text-xs text-text-muted">
              <input id="portal-remember" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 accent-primary" />
              {t.rememberMe}
            </label>
            {loginError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
                {loginError}
              </p>
            ) : null}
            <Button type="submit" className="h-11 w-full text-base font-bold">
              <LogIn className="mr-2 h-4 w-4" />
              {t.signIn}
            </Button>
            <p className="text-center text-[11px] text-text-muted">
              {t.demoAccess} <span className="font-mono font-semibold text-text-main">admin</span> /{' '}
              <span className="font-mono font-semibold text-text-main">{DEMO_PASSWORD}</span>
              <br />
              {t.otherRoles} <span className="font-mono">records</span>, <span className="font-mono">committee</span>, <span className="font-mono">encoder</span>,{' '}
              <span className="font-mono">infodesk</span> {t.samePassword}
            </p>
          </form>
        </DialogContent>
      </Dialog>

      {/* Public document viewer */}
      <Dialog open={activePublicDoc !== null} onOpenChange={(open) => !open && setActivePublicDocId(null)}>
        <DialogContent className="relative max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.viewerTitle}</DialogTitle>
            <DialogDescription>{t.viewerText}</DialogDescription>
          </DialogHeader>
          {activePublicDoc ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-col gap-3 border border-border bg-muted/20 p-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-text-main">
                    {t.recordTypes[activePublicDoc.recordType]} • {activePublicDoc.number}
                  </div>
                  <div className="text-lg font-bold text-primary">{activePublicDoc.title}</div>
                  <StatusBadge status={activePublicDoc.status} align="start" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadRecord(activePublicDoc)}>
                    <Download className="mr-1.5 h-4 w-4" />
                    {t.download}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printRecord(activePublicDoc)}>
                    <Printer className="mr-1.5 h-4 w-4" />
                    {t.print}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const number = activePublicDoc.number;
                      setActivePublicDocId(null);
                      openRequestDialog(number);
                    }}
                  >
                    {t.requestCertifiedCopy}
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
                      [t.fields.date, activePublicDoc.date],
                      [t.fields.category, activePublicDoc.category],
                      [t.fields.subject, activePublicDoc.subject],
                      [t.fields.referral, activePublicDoc.referral],
                      [t.fields.classification, activePublicDoc.classification],
                      [t.fields.actionTaken, activePublicDoc.actionTaken],
                      [t.fields.author, activePublicDoc.author],
                      [t.fields.coAuthor, activePublicDoc.coAuthor || '—'],
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
                <p className="text-xs font-bold uppercase tracking-wider text-secondary">{t.sessionTypes[agendaSession.type]}</p>
                <DialogTitle className="text-xl text-primary">{agendaSession.title}</DialogTitle>
                <DialogDescription>
                  {formatLongDate(agendaSession.date, dateLocale)} · {agendaSession.time} · {agendaSession.location}
                </DialogDescription>
              </DialogHeader>
              <h3 className="mt-5 text-sm font-bold uppercase tracking-wider text-text-muted">{t.orderOfBusiness}</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-text-main">
                {buildAgenda(agendaSession).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => printAgenda(agendaSession)}>
                  <Printer className="mr-1.5 h-4 w-4" />
                  {t.printAgenda}
                </Button>
                <Button variant="outline" onClick={() => addSessionToCalendar(agendaSession)}>
                  <CalendarPlus className="mr-1.5 h-4 w-4" />
                  {t.addToCalendar}
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
                  {t.viewRelatedDocument}
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
            <DialogTitle className="text-xl text-primary">{t.requestDocument}</DialogTitle>
            <DialogDescription>{t.requestText}</DialogDescription>
          </DialogHeader>
          {requestReference ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                <p className="font-bold">{t.requestReceivedTitle}</p>
                <p className="mt-1">{t.requestReceivedText(requestReference, requestEmail)}</p>
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
                {t.done}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleDocumentRequest} className="mt-5 space-y-3">
              <Input value={requestName} onChange={(e) => setRequestName(e.target.value)} placeholder={t.fullName} aria-label={t.fullName} autoComplete="name" />
              <Input value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} type="email" placeholder={t.emailAddress} aria-label={t.emailAddress} autoComplete="email" />
              <Input
                value={requestRecord}
                onChange={(e) => setRequestRecord(e.target.value)}
                placeholder={t.requestRecordPlaceholder}
                aria-label={t.requestRecordLabel}
              />
              <label className="block text-xs font-semibold text-text-muted">
                {t.purpose}
                <select
                  value={requestPurpose}
                  onChange={(e) => setRequestPurpose(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-normal text-text-main"
                >
                  {Object.entries(t.purposes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {requestError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
                  {requestError}
                </p>
              ) : null}
              <p className="text-[11px] text-text-muted">
                {t.consentBefore}{' '}
                <button type="button" onClick={() => setPolicyDialog('privacy')} className="underline hover:text-primary">
                  {t.privacy}
                </button>
                .
              </p>
              <Button type="submit" className="w-full">
                {t.submitRequest}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Policies */}
      <Dialog open={policyDialog !== null} onOpenChange={(open) => !open && setPolicyDialog(null)}>
        <DialogContent className="relative max-w-lg">
          <DialogHeader>
            <DialogTitle>{policyDialog ? t[policyDialog] : ''}</DialogTitle>
            <DialogDescription>{LGU_PROFILE.legislature}</DialogDescription>
          </DialogHeader>
          {policyDialog ? (
            <div className="mt-3 space-y-3 text-sm text-text-muted">
              {t.policies[policyDialog].map((paragraph) => (
                <p key={paragraph}>{paragraph.replace('{email}', LGU_PROFILE.email)}</p>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Member details: committee assignments, each linking to its referred measures. */}
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
              <h4 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t.committeeAssignments}</h4>
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
                              {t.roles[entry.role]}
                            </span>
                            <ArrowRight className="h-4 w-4 text-text-muted" />
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-text-muted">
                  {publicMember.seat === 'Presiding Officer' ? t.presidingNote : t.noAssignments}
                </p>
              )}
              <p className="mt-4 text-xs text-text-muted">{t.committeesHint}</p>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <EgovAiChat lang={lang} />
    </div>
  );
}
