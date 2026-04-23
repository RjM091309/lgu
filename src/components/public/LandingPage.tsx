import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { DataTable } from '@/components/ui/DataTable';
import { mockBills } from '@/lib/mock-data';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Search,
  ArrowRight,
  Shield,
  Globe,
  ScrollText,
  Monitor,
  CalendarDays,
  Gavel,
  Lock,
  User,
  LogIn,
  MoreHorizontal,
  Sparkles,
  Users,
  Landmark,
} from 'lucide-react';
import { motion } from 'motion/react';
import { LegislativeOrgChart } from '@/components/public/LegislativeOrgChart';

interface LandingPageProps {
  onLogin: () => void;
}

export function LandingPage({ onLogin }: LandingPageProps) {
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
  const [selectedClassification, setSelectedClassification] = useState('All');
  const [selectedAuthorship, setSelectedAuthorship] = useState('All');
  const [selectedActionTaken, setSelectedActionTaken] = useState('All');
  const [selectedSponsor, setSelectedSponsor] = useState('All');
  const [selectedCoAuthor, setSelectedCoAuthor] = useState('All');
  const [publicName, setPublicName] = useState('');
  const [publicEmail, setPublicEmail] = useState('');
  const [notifyUpdates, setNotifyUpdates] = useState(true);
  const [registrationNotice, setRegistrationNotice] = useState('');
  const [activePublicDocId, setActivePublicDocId] = useState<string | null>(null);
  const [publicDocDialogOpen, setPublicDocDialogOpen] = useState(false);
  const [inquiryPage, setInquiryPage] = useState(1);
  const inquiryPageSize = 8;

  const handlePortalLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    if (username.trim() === 'admin' && password === 'admin123') {
      onLogin();
      return;
    }
    setLoginError('Invalid username or password. Please try again.');
  };

  const handlePublicRegistration = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!publicName.trim() || !publicEmail.trim()) {
      setRegistrationNotice('Please provide your full name and email address.');
      return;
    }
    setRegistrationNotice(
      notifyUpdates
        ? 'Registration saved. You are now subscribed to legislative updates.'
        : 'Registration saved. You may enable updates anytime.'
    );
    setPublicName('');
    setPublicEmail('');
    setNotifyUpdates(true);
  };

  const publicStats = [
    {
      label: 'Total Ordinances',
      value: '39',
      subtitle: 'Ordinances',
      description:
        'Regulations enacted by local government to address community standards and local policy implementation.',
      icon: ScrollText,
    },
    {
      label: 'Total Resolutions',
      value: '356',
      subtitle: 'Resolutions',
      description:
        'Formal legislative expressions used for declarations, policy direction, and institutional decisions.',
      icon: Monitor,
    },
    {
      label: 'Total Sessions',
      value: '35',
      subtitle: 'Legislative Sessions',
      description:
        'Official meetings where legislators deliberate on bills, resolutions, and council actions.',
      icon: CalendarDays,
    },
    {
      label: 'Total Committee Hearing',
      value: '98',
      subtitle: 'Committee Hearings',
      description:
        'Hearings conducted for expert input and public consultation before committee recommendations.',
      icon: Gavel,
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

  const publicLegislationRecords: PublicInquiryRecord[] = useMemo(() => {
    const byId: Record<string, Partial<PublicInquiryRecord>> = {
      '1': {
        subject: 'ICT Modernization',
        referral: 'Committee on ICT and Innovation',
        classification: 'Ordinance',
        actionTaken: 'For committee hearing',
        authorshipType: 'Author',
        sponsor: 'Hon. Maria Santos',
        coAuthor: 'Hon. Elena Rodriguez',
      },
      '2': {
        subject: 'Agriculture Support',
        referral: 'Committee on Environment and Agriculture',
        classification: 'Resolution',
        actionTaken: 'For second reading publication',
        authorshipType: 'Sponsor',
        sponsor: 'Sen. Robert Chen',
        coAuthor: 'Hon. Maria Santos',
      },
      '3': {
        subject: 'Public Health',
        referral: 'Committee on Health and Social Services',
        classification: 'Ordinance',
        actionTaken: 'Approved / Passed',
        authorshipType: 'Author',
        sponsor: 'Hon. James Wilson',
        coAuthor: 'Sen. Sarah Thompson',
      },
      '4': {
        subject: 'Transport Modernization',
        referral: 'Committee on Public Works and Transportation',
        classification: 'Ordinance',
        actionTaken: 'Filed / For first reading',
        authorshipType: 'Co-author',
        sponsor: 'Hon. Elena Rodriguez',
        coAuthor: 'Hon. James Wilson',
      },
      '5': {
        subject: 'Education Funding',
        referral: 'Committee on Education',
        classification: 'Ordinance',
        actionTaken: 'Enacted',
        authorshipType: 'Sponsor',
        sponsor: 'Sen. Sarah Thompson',
        coAuthor: 'Hon. Maria Santos',
      },
    };

    return mockBills.map((bill) => {
      const extra = byId[bill.id] ?? {};
      return {
        id: `leg-${bill.id}`,
        recordType: 'Legislation',
        number: bill.number,
        title: bill.title,
        status: bill.status,
        category: bill.category,
        author: bill.author,
        subject: extra.subject ?? bill.category,
        referral: extra.referral ?? 'Committee Secretariat',
        classification: extra.classification ?? 'Ordinance',
        actionTaken: extra.actionTaken ?? 'Under review',
        authorshipType: extra.authorshipType ?? 'Author',
        sponsor: extra.sponsor ?? bill.author,
        coAuthor: extra.coAuthor ?? '',
        date: bill.dateFiled,
        bodyPreview: `Public summary for ${bill.number}: ${bill.description}`,
      };
    });
  }, []);

  const publicInquiryDocs: PublicInquiryRecord[] = [
    {
      id: 'doc-1',
      number: 'TR-2026-014',
      title: 'Transmittal: Committee Report on Transport Modernization',
      status: 'Received',
      category: 'Transmittal',
      author: 'Office of the City Secretary',
      recordType: 'Incoming Document',
      subject: 'Transport Modernization',
      referral: 'Committee on Public Works and Transportation',
      classification: 'Transmittal Letter',
      actionTaken: 'Acknowledged / For filing',
      authorshipType: 'Sponsor',
      sponsor: 'Office of the City Secretary',
      coAuthor: '',
      date: '2026-04-10',
      bodyPreview: 'Transmittal cover letter and committee report attachments for public reference.',
    },
    {
      id: 'doc-2',
      number: 'IN-2026-032',
      title: 'Incoming Letter: Request for Public Hearing Schedule',
      status: 'Referred',
      category: 'Citizen Inquiry',
      author: 'Citizens Transport Coalition',
      recordType: 'Incoming Document',
      subject: 'Public Participation',
      referral: 'Office of the City Secretary',
      classification: 'Incoming Letter',
      actionTaken: 'Referred to committee secretariat',
      authorshipType: 'Author',
      sponsor: 'N/A',
      coAuthor: '',
      date: '2026-04-12',
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
      author: 'Office of the City Secretary',
      subject: 'Accreditation',
      referral: 'Office of the City Secretary',
      classification: 'Form',
      actionTaken: 'Downloadable',
      authorshipType: 'Author',
      sponsor: 'Office of the City Secretary',
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
      bodyPreview: 'Archive index includes ordinance numbers, titles, year enacted, and public download references (mock).',
    },
    {
      id: 'res-4',
      recordType: 'Resource',
      number: 'RES-MINUTES-2026',
      title: 'Session Minutes (Approved)',
      status: 'Available',
      category: 'Minutes',
      author: 'Office of the City Secretary',
      subject: 'Session Minutes',
      referral: 'Office of the City Secretary',
      classification: 'Minutes',
      actionTaken: 'Viewable / Printable',
      authorshipType: 'Author',
      sponsor: 'Office of the City Secretary',
      coAuthor: '',
      date: '2026-04-05',
      bodyPreview: 'Approved session minutes summary with attendance, quorum confirmation, agenda items, and actions taken (mock).',
    },
  ];

  const statuses = useMemo(
    () =>
      [
        'All',
        ...Array.from(
          new Set([
            ...publicLegislationRecords.map((r) => r.status),
            ...publicInquiryDocs.map((doc) => doc.status),
            ...publicResources.map((r) => r.status),
          ])
        ),
      ],
    []
  );

  const categories = useMemo(
    () =>
      [
        'All',
        ...Array.from(
          new Set([
            ...publicLegislationRecords.map((r) => r.category),
            ...publicInquiryDocs.map((doc) => doc.category),
            ...publicResources.map((r) => r.category),
          ])
        ),
      ],
    []
  );

  const subjects = useMemo(() => ['All', ...Array.from(new Set([...publicLegislationRecords, ...publicInquiryDocs, ...publicResources].map((r) => r.subject)))], [publicLegislationRecords]);
  const referrals = useMemo(() => ['All', ...Array.from(new Set([...publicLegislationRecords, ...publicInquiryDocs, ...publicResources].map((r) => r.referral)))], [publicLegislationRecords]);
  const classifications = useMemo(
    () => ['All', ...Array.from(new Set([...publicLegislationRecords, ...publicInquiryDocs, ...publicResources].map((r) => r.classification)))],
    [publicLegislationRecords]
  );
  const actionTakens = useMemo(
    () => ['All', ...Array.from(new Set([...publicLegislationRecords, ...publicInquiryDocs, ...publicResources].map((r) => r.actionTaken)))],
    [publicLegislationRecords]
  );
  const authorships = useMemo(
    () => ['All', ...Array.from(new Set([...publicLegislationRecords, ...publicInquiryDocs, ...publicResources].map((r) => r.authorshipType)))],
    [publicLegislationRecords]
  );
  const sponsors = useMemo(
    () => ['All', ...Array.from(new Set([...publicLegislationRecords, ...publicInquiryDocs, ...publicResources].map((r) => r.sponsor).filter(Boolean) as string[]))],
    [publicLegislationRecords]
  );
  const coAuthors = useMemo(
    () => ['All', ...Array.from(new Set([...publicLegislationRecords, ...publicInquiryDocs, ...publicResources].map((r) => r.coAuthor).filter(Boolean) as string[]))],
    [publicLegislationRecords]
  );

  const asOptions = (values: string[]): SelectOption[] => values.map((value) => ({ value, label: value }));

  const statusOptions = useMemo(() => asOptions(statuses), [statuses]);
  const categoryOptions = useMemo(() => asOptions(categories), [categories]);
  const typeOptions = useMemo(() => asOptions(['All', 'Legislation', 'Incoming Document', 'Resource']), []);
  const subjectOptions = useMemo(() => asOptions(subjects), [subjects]);
  const referralOptions = useMemo(() => asOptions(referrals), [referrals]);
  const classificationOptions = useMemo(() => asOptions(classifications), [classifications]);
  const actionTakenOptions = useMemo(() => asOptions(actionTakens), [actionTakens]);
  const authorshipOptions = useMemo(() => asOptions(authorships), [authorships]);
  const sponsorOptions = useMemo(() => asOptions(sponsors), [sponsors]);
  const coAuthorOptions = useMemo(() => asOptions(coAuthors), [coAuthors]);

  const pickOption = (options: SelectOption[], value: string) => options.find((o) => o.value === value) ?? null;

  const unifiedInquiryResults = useMemo(() => {
    const mergedRecords: PublicInquiryRecord[] = [...publicLegislationRecords, ...publicInquiryDocs, ...publicResources];
    return mergedRecords.filter((record) => {
      const keyword = inquiryKeyword.trim().toLowerCase();
      const matchesKeyword =
        keyword.length === 0 ||
        record.title.toLowerCase().includes(keyword) ||
        record.number.toLowerCase().includes(keyword) ||
        record.author.toLowerCase().includes(keyword);
      const matchesStatus = selectedStatus === 'All' || record.status === selectedStatus;
      const matchesCategory = selectedCategory === 'All' || record.category === selectedCategory;
      const matchesType = selectedType === 'All' || record.recordType === selectedType;
      const matchesSubject = selectedSubject === 'All' || record.subject === selectedSubject;
      const matchesReferral = selectedReferral === 'All' || record.referral === selectedReferral;
      const matchesClassification = selectedClassification === 'All' || record.classification === selectedClassification;
      const matchesAuthorship = selectedAuthorship === 'All' || record.authorshipType === selectedAuthorship;
      const matchesActionTaken = selectedActionTaken === 'All' || record.actionTaken === selectedActionTaken;
      const matchesSponsor = selectedSponsor === 'All' || record.sponsor === selectedSponsor;
      const matchesCoAuthor = selectedCoAuthor === 'All' || record.coAuthor === selectedCoAuthor;
      return (
        matchesKeyword &&
        matchesStatus &&
        matchesCategory &&
        matchesType &&
        matchesSubject &&
        matchesReferral &&
        matchesClassification &&
        matchesAuthorship &&
        matchesActionTaken &&
        matchesSponsor &&
        matchesCoAuthor
      );
    });
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
    publicInquiryDocs,
    publicLegislationRecords,
    publicResources,
  ]);

  const inquiryTotalPages = useMemo(
    () => Math.max(1, Math.ceil(unifiedInquiryResults.length / inquiryPageSize)),
    [unifiedInquiryResults.length]
  );

  useEffect(() => {
    setInquiryPage(1);
  }, [unifiedInquiryResults.length]);

  useEffect(() => {
    setInquiryPage((prev) => Math.min(Math.max(1, prev), inquiryTotalPages));
  }, [inquiryTotalPages]);

  const paginatedInquiryResults = useMemo(() => {
    const start = (inquiryPage - 1) * inquiryPageSize;
    return unifiedInquiryResults.slice(start, start + inquiryPageSize);
  }, [inquiryPage, unifiedInquiryResults]);

  const activePublicDoc = useMemo(() => {
    if (!activePublicDocId) return null;
    const merged = [...publicLegislationRecords, ...publicInquiryDocs, ...publicResources];
    return merged.find((r) => r.id === activePublicDocId) ?? null;
  }, [activePublicDocId, publicInquiryDocs, publicLegislationRecords, publicResources]);

  const watermarkText = 'LMIS - PUBLIC COPY';

  const downloadMock = (record: PublicInquiryRecord) => {
    const content = [
      watermarkText,
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

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.number}-public.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printMock = (record: PublicInquiryRecord) => {
    const content = `
      <html>
        <head>
          <title>${record.number}</title>
          <style>
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 24px; }
            .meta { margin: 0 0 12px; color: #1a237e; font-weight: 700; }
            .card { border: 1px solid #ddd; padding: 16px; position: relative; }
            .watermark {
              position: absolute; inset: 0; display:flex; align-items:center; justify-content:center;
              font-size: 48px; font-weight: 800; color: rgba(26, 35, 126, 0.10);
              transform: rotate(-18deg); pointer-events:none; user-select:none;
            }
            .rows { font-size: 12px; color: #333; line-height: 1.6; }
            .title { font-size: 18px; font-weight: 800; margin: 12px 0; }
            .body { white-space: pre-wrap; margin-top: 12px; }
          </style>
        </head>
        <body>
          <div class="meta">${watermarkText}</div>
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
              <div><b>Authorship</b>: ${record.authorshipType}</div>
              <div><b>Sponsor</b>: ${record.sponsor ?? ''}</div>
              <div><b>Co-author</b>: ${record.coAuthor ?? ''}</div>
              <div><b>Date</b>: ${record.date}</div>
            </div>
            <div class="title">${record.title}</div>
            <div class="body">${record.bodyPreview}</div>
          </div>
        </body>
      </html>
    `.trim();

    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    w.document.open();
    w.document.write(content);
    w.document.close();
    w.focus();
    w.print();
  };

  const weeklyAgenda = useMemo(
    () => [
      { week: 'Week 16', date: 'April 22, 2026', session: 'Regular Session', reference: 'AGENDA-2026-W16' },
      { week: 'Week 16', date: 'April 24, 2026', session: 'Committee Hearing', reference: 'HEARING-2026-APR24' },
    ],
    []
  );

  const latestApprovedMeasures = useMemo(
    () => publicLegislationRecords.filter((r) => ['Passed', 'Enacted'].includes(r.status)).slice(0, 4),
    [publicLegislationRecords]
  );

  return (
    <div className="min-h-screen bg-white font-sans">
      <Dialog open={publicDocDialogOpen} onOpenChange={setPublicDocDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Public Document Viewer</DialogTitle>
            <DialogDescription>Mock preview with watermark controls (view / download / print).</DialogDescription>
          </DialogHeader>
          {activePublicDoc ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-col gap-3 border border-border bg-muted/20 p-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-primary">{watermarkText}</div>
                  <div className="text-sm font-semibold text-text-main">
                    {activePublicDoc.recordType} • {activePublicDoc.number}
                  </div>
                  <div className="text-lg font-bold text-primary">{activePublicDoc.title}</div>
                  <div className="text-xs text-text-muted">
                    Subject: <span className="font-semibold text-text-main">{activePublicDoc.subject}</span> • Referral:{' '}
                    <span className="font-semibold text-text-main">{activePublicDoc.referral}</span>
                  </div>
                  <div className="text-xs text-text-muted">
                    Classification: <span className="font-semibold text-text-main">{activePublicDoc.classification}</span> • Action taken:{' '}
                    <span className="font-semibold text-text-main">{activePublicDoc.actionTaken}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadMock(activePublicDoc)}>
                    Download
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printMock(activePublicDoc)}>
                    Print
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setPublicDocDialogOpen(false);
                      setActivePublicDocId(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>

              <div className="relative overflow-hidden border border-border bg-white p-5">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
                  <div className="text-5xl font-extrabold tracking-widest text-primary/10 rotate-[-18deg]">{watermarkText}</div>
                </div>
                <div className="relative">
                  <div className="grid gap-2 text-xs text-text-muted md:grid-cols-2">
                    <div>
                      Type: <span className="font-semibold text-text-main">{activePublicDoc.recordType}</span>
                    </div>
                    <div>
                      Date: <span className="font-semibold text-text-main">{activePublicDoc.date}</span>
                    </div>
                    <div>
                      Status: <span className="font-semibold text-text-main">{activePublicDoc.status}</span>
                    </div>
                    <div>
                      Category: <span className="font-semibold text-text-main">{activePublicDoc.category}</span>
                    </div>
                    <div>
                      Authorship: <span className="font-semibold text-text-main">{activePublicDoc.authorshipType}</span>
                    </div>
                    <div>
                      Sponsor: <span className="font-semibold text-text-main">{activePublicDoc.sponsor ?? ''}</span>
                    </div>
                    <div>
                      Co-author: <span className="font-semibold text-text-main">{activePublicDoc.coAuthor ?? ''}</span>
                    </div>
                    <div>
                      Author: <span className="font-semibold text-text-main">{activePublicDoc.author}</span>
                    </div>
                  </div>
                  <div className="mt-4 whitespace-pre-wrap text-sm text-text-main">{activePublicDoc.bodyPreview}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-text-muted">No document selected.</div>
          )}
        </DialogContent>
      </Dialog>
      {/* Public Header */}
      <header className="border-b border-border bg-white sticky top-0 z-50">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl">
              L
            </div>
            <div>
              <h1 className="font-bold text-lg text-primary leading-none tracking-tight">LEGISLATIVE INFORMATION SYSTEM</h1>
              <p className="text-[10px] text-text-muted mt-1 uppercase tracking-widest font-semibold">Official Government Portal</p>
            </div>
          </div>
          
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-text-main">
            <a href="#legislation" className="hover:text-primary transition-colors">Legislation</a>
            <a href="#city-council" className="hover:text-primary transition-colors">City Council</a>
            <a href="#public-sessions" className="hover:text-primary transition-colors">Public Sessions</a>
            <a href="#resources" className="hover:text-primary transition-colors">Resources</a>
          </nav>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="hidden sm:flex text-text-muted">
              <Globe className="mr-2 h-4 w-4" />
              EN
            </Button>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-sm font-semibold text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-colors"
            >
              Sign in
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-white/80" />
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#1a237e_1px,transparent_1px)] [background-size:40px_40px]"></div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid gap-12 lg:grid-cols-[1.05fr_minmax(320px,380px)] lg:items-center lg:gap-16">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-6">
                <Shield className="h-3 w-3" />
                TRANSPARENCY & ACCOUNTABILITY
              </div>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-primary leading-tight mb-6">
                Empowering Citizens Through <span className="text-secondary">Legislative Transparency</span>
              </h2>
              <p className="text-lg text-text-muted mb-10 leading-relaxed">
                Access real-time information on city ordinances, resolutions, and legislative proceedings.
                Our digital portal ensures every citizen has a voice in the local government process.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search for bills, ordinances..."
                    className="w-full h-14 pl-12 pr-4 rounded-lg border border-border bg-white shadow-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <Button className="h-14 px-8 bg-secondary hover:bg-secondary/90 text-white font-bold text-lg">
                  Search Database
                </Button>
              </div>
            </div>

            <motion.div
              id="portal-login"
              className="relative will-change-transform"
              initial={{ opacity: 0, y: 28, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 42,
                mass: 1,
                delay: 0.1,
              }}
            >
              <div
                className="absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/40 via-primary/10 to-secondary/30 opacity-80 blur-sm"
                aria-hidden
              />
              <div className="relative rounded-2xl border border-white/80 bg-white/95 p-8 shadow-[0_24px_60px_-12px_rgba(26,35,126,0.25)] backdrop-blur-sm">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/80">Secure portal</p>
                    <h3 className="mt-1 text-xl font-bold text-primary">Sign in to LMIS</h3>
                    <p className="mt-1 text-sm text-text-muted">Internal access for authorized personnel.</p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Lock className="h-6 w-6" />
                  </div>
                </div>

                <form onSubmit={handlePortalLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="portal-username" className="text-xs font-semibold text-text-muted">
                      Username
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                      <Input
                        id="portal-username"
                        name="username"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter username"
                        className="h-11 border-border pl-9"
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
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="h-11 border-border pl-9"
                      />
                    </div>
                  </div>
                  <label htmlFor="portal-remember" className="flex items-center gap-2 text-xs text-text-muted">
                    <input
                      id="portal-remember"
                      name="remember"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    Remember me
                  </label>

                  {loginError ? (
                    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
                      {loginError}
                    </p>
                  ) : null}

                  <Button type="submit" className="h-11 w-full bg-primary text-base font-bold hover:bg-primary-light">
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign in to Admin
                  </Button>

                  <p className="text-center text-[11px] text-text-muted">
                    Demo access: <span className="font-mono font-semibold text-text-main">admin</span> /{' '}
                    <span className="font-mono font-semibold text-text-main">admin123</span>
                  </p>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Public Legislative Totals */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="mb-10">
            <h3 className="text-3xl font-bold text-primary">Legislative Overview</h3>
            <p className="text-text-muted mt-2">High-level public counts from current council records.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {publicStats.map((stat) => (
              <article
                key={stat.label}
                className="group border border-border/80 rounded-b-xl bg-white/95 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/20"
              >
                <div className="h-1 w-full bg-gradient-to-r from-primary/70 via-primary/30 to-transparent" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{stat.label}</p>
                    <div className="flex h-10 w-10 items-center justify-center bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                      <stat.icon className="h-4 w-4" />
                    </div>
                  </div>

                  <p className="mt-4 text-4xl font-light leading-none text-primary">{stat.value}</p>
                  <p className="mt-2 text-sm font-bold text-foreground">{stat.subtitle}</p>
                  <p className="mt-2 min-h-20 text-xs leading-5 text-text-muted">{stat.description}</p>
                </div>
                <div className="border-t border-border/80 bg-gradient-to-r from-muted/30 to-transparent px-5 py-3">
                  <Button variant="outline" size="sm" className="h-8 rounded-none text-xs font-semibold group-hover:border-primary/40">
                    View list <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Key Public Features */}
      <section className="relative py-20 border-y border-border overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-white/88" />
        <div className="container relative z-10 mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex gap-5">
              <div className="w-14 h-14 shrink-0 bg-primary/5 rounded-2xl flex items-center justify-center text-primary">
                <ScrollText className="h-7 w-7" />
              </div>
              <div>
                <h3 className="font-bold text-xl mb-2">Track Legislation</h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  Follow the progress of bills from filing to enactment. Stay informed on every legislative step.
                </p>
              </div>
            </div>
            
            <div className="flex gap-5">
              <div className="w-14 h-14 shrink-0 bg-primary/5 rounded-2xl flex items-center justify-center text-primary">
                <CalendarDays className="h-7 w-7" />
              </div>
              <div>
                <h3 className="font-bold text-xl mb-2">Session Schedules</h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  View upcoming council sessions and committee hearings. Access agendas and meeting minutes.
                </p>
              </div>
            </div>

            <div className="flex gap-5">
              <div className="w-14 h-14 shrink-0 bg-primary/5 rounded-2xl flex items-center justify-center text-primary">
                <Monitor className="h-7 w-7" />
              </div>
              <div>
                <h3 className="font-bold text-xl mb-2">Council Directory</h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  Connect with your representatives. View profiles, voting records, and contact information.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Legislation */}
      <section id="legislation" className="scroll-mt-24 py-20 bg-white border-y border-border">
        <div className="container mx-auto px-6">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-primary">Legislation</h2>
            <p className="mt-2 text-text-muted">Browse key legislative instruments currently tracked by the city council.</p>
          </div>
          <div className="mb-8 border border-border bg-muted/20 p-5">
            <h3 className="text-lg font-bold text-primary">Public Inquiry Engine</h3>
            <p className="mt-1 text-sm text-text-muted">
              Search and filter legislation plus incoming/transmittal records in one public listing.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Input
                value={inquiryKeyword}
                onChange={(e) => setInquiryKeyword(e.target.value)}
                placeholder="Keyword, bill no., author..."
              />
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
              <Select
                options={typeOptions}
                value={pickOption(typeOptions, selectedType)}
                onChange={(opt) => setSelectedType(opt?.value ?? 'All')}
                placeholder="Type"
                isSearchable={false}
              />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
              <Select
                options={subjectOptions}
                value={pickOption(subjectOptions, selectedSubject)}
                onChange={(opt) => setSelectedSubject(opt?.value ?? 'All')}
                placeholder="Subject"
              />
              <Select
                options={referralOptions}
                value={pickOption(referralOptions, selectedReferral)}
                onChange={(opt) => setSelectedReferral(opt?.value ?? 'All')}
                placeholder="Referral"
              />
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
              <Select
                options={sponsorOptions}
                value={pickOption(sponsorOptions, selectedSponsor)}
                onChange={(opt) => setSelectedSponsor(opt?.value ?? 'All')}
                placeholder="Sponsor"
              />
              <Select
                options={coAuthorOptions}
                value={pickOption(coAuthorOptions, selectedCoAuthor)}
                onChange={(opt) => setSelectedCoAuthor(opt?.value ?? 'All')}
                placeholder="Co-author"
              />
            </div>
            <div className="mt-4 bg-white rounded-lg border border-border shadow-sm">
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
                  <TableHeader className="bg-[#fafafa]">
                    <TableRow className="border-border">
                      <TableHead className="px-4 text-[12px] font-semibold text-text-muted">TYPE</TableHead>
                      <TableHead className="px-4 text-[12px] font-semibold text-text-muted">RECORD NO.</TableHead>
                      <TableHead className="px-4 text-[12px] font-semibold text-text-muted">TITLE</TableHead>
                      <TableHead className="px-4 text-[12px] font-semibold text-text-muted">CATEGORY</TableHead>
                      <TableHead className="px-4 text-[12px] font-semibold text-text-muted">SUBJECT</TableHead>
                      <TableHead className="px-4 text-[12px] font-semibold text-text-muted">STATUS</TableHead>
                      <TableHead className="px-4 text-[12px] font-semibold text-text-muted">ACTION TAKEN</TableHead>
                      <TableHead className="px-4 text-[12px] font-semibold text-text-muted text-right">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInquiryResults.map((record) => (
                      <TableRow key={`${record.recordType}-${record.id}`} className="hover:bg-muted/5 border-border transition-colors">
                        <TableCell className="px-4 py-3.5 text-[13px]">{record.recordType}</TableCell>
                        <TableCell className="px-4 py-3.5 text-[13px] font-mono text-text-muted">{record.number}</TableCell>
                        <TableCell className="px-4 py-3.5 text-[13px] font-medium">{record.title}</TableCell>
                        <TableCell className="px-4 py-3.5 text-[13px]">{record.category}</TableCell>
                        <TableCell className="px-4 py-3.5 text-[13px]">{record.subject}</TableCell>
                        <TableCell className="px-4 py-3.5 text-[13px]">{record.status}</TableCell>
                        <TableCell className="px-4 py-3.5 text-[13px]">{record.actionTaken}</TableCell>
                        <TableCell className="relative px-4 py-3.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Row actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-48">
                              <DropdownMenuItem
                                onClick={() => {
                                  setActivePublicDocId(record.id);
                                  setPublicDocDialogOpen(true);
                                }}
                              >
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadMock(record)}>Download</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printMock(record)}>Print</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedInquiryResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="px-4 py-6 text-sm text-text-muted">
                          No matching public records found.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </DataTable>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <article className="border border-border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">Ordinances</h3>
              <p className="mt-2 text-sm text-text-muted">Local laws focused on public safety, zoning, environment, and local governance.</p>
              <Button variant="outline" size="sm" className="mt-4">View Ordinances</Button>
            </article>
            <article className="border border-border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">Resolutions</h3>
              <p className="mt-2 text-sm text-text-muted">Council expressions and policy directions supporting institutional programs.</p>
              <Button variant="outline" size="sm" className="mt-4">View Resolutions</Button>
            </article>
            <article className="border border-border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">Committee Reports</h3>
              <p className="mt-2 text-sm text-text-muted">Summaries of deliberations, recommendations, and technical findings per committee.</p>
              <Button variant="outline" size="sm" className="mt-4">View Reports</Button>
            </article>
          </div>
        </div>
      </section>

      {/* City Council */}
      <section id="city-council" className="relative scroll-mt-24 overflow-hidden border-y border-white/10 py-24">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1600&q=80')",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-primary/88" aria-hidden />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_60%)]" aria-hidden />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.28),transparent_45%,rgba(96,165,250,0.22))]" aria-hidden />

        <div className="container relative z-10 mx-auto px-6">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/90">
            <Sparkles className="h-3.5 w-3.5" />
            Representative Directory
          </div>

          <div className="mb-10 grid gap-6 lg:grid-cols-[1.05fr_minmax(300px,0.95fr)] lg:items-end">
            <div>
              <h2 className="text-4xl font-bold leading-tight text-white">City Council</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75 md:text-base">
                Know your elected representatives, council leadership, and support structure in one interactive organizational view.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                  <Users className="h-4 w-4" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Council Members</p>
                <p className="mt-1 text-2xl font-bold text-white">8</p>
              </article>
              <article className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                  <Landmark className="h-4 w-4" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Legislative Units</p>
                <p className="mt-1 text-2xl font-bold text-white">4</p>
              </article>
              <article className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                  <Shield className="h-4 w-4" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Leadership Office</p>
                <p className="mt-1 text-2xl font-bold text-white">1</p>
              </article>
            </div>
          </div>

          <LegislativeOrgChart />

          <p className="mt-4 text-xs text-white/65">
            Tip: Use the zoom controls and drag interaction to inspect each office and staff cluster.
          </p>

        </div>
      </section>

      {/* Public Sessions */}
      <section id="public-sessions" className="scroll-mt-24 py-20 bg-white border-y border-border">
        <div className="container mx-auto px-6">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-primary">Public Sessions</h2>
            <p className="mt-2 text-text-muted">Stay updated on upcoming schedules and official council proceedings.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <article className="border border-border bg-white p-6 shadow-sm">
              <div className="text-xs uppercase tracking-wider text-secondary font-semibold">Regular Session</div>
              <h3 className="mt-2 text-lg font-bold">April 22, 2026 - 9:00 AM</h3>
              <p className="mt-2 text-sm text-text-muted">Session Hall, City Legislative Building</p>
              <Button variant="outline" size="sm" className="mt-4">View Agenda</Button>
            </article>
            <article className="border border-border bg-white p-6 shadow-sm">
              <div className="text-xs uppercase tracking-wider text-secondary font-semibold">Committee Hearing</div>
              <h3 className="mt-2 text-lg font-bold">April 24, 2026 - 2:00 PM</h3>
              <p className="mt-2 text-sm text-text-muted">Public consultation on transport modernization ordinance.</p>
              <Button variant="outline" size="sm" className="mt-4">View Hearing Notice</Button>
            </article>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <article className="border border-border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-primary">Current-Year Weekly Agenda</h3>
              <p className="mt-1 text-sm text-text-muted">Mock agenda feed for public viewing and download.</p>
              <div className="mt-4 space-y-2">
                {weeklyAgenda.map((row) => (
                  <div key={row.reference} className="flex flex-col gap-2 border border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold">{row.session}</div>
                      <div className="text-xs text-text-muted">
                        {row.week} • {row.date} • Ref: <span className="font-mono font-semibold text-text-main">{row.reference}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActivePublicDocId('res-4');
                          setPublicDocDialogOpen(true);
                        }}
                      >
                        View
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadMock(publicResources.find((r) => r.id === 'res-4')!)}>
                        Download
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => printMock(publicResources.find((r) => r.id === 'res-4')!)}>
                        Print
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <article className="border border-border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-primary">Latest Approved Measures</h3>
              <p className="mt-1 text-sm text-text-muted">Mock feed of recently approved / enacted legislation.</p>
              <div className="mt-4 space-y-2">
                {latestApprovedMeasures.map((row) => (
                  <div key={row.id} className="flex flex-col gap-2 border border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold">{row.number}</div>
                      <div className="text-xs text-text-muted">{row.title}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActivePublicDocId(row.id);
                          setPublicDocDialogOpen(true);
                        }}
                      >
                        View
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadMock(row)}>
                        Download
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => printMock(row)}>
                        Print
                      </Button>
                    </div>
                  </div>
                ))}
                {latestApprovedMeasures.length === 0 ? (
                  <div className="text-sm text-text-muted">No approved measures yet.</div>
                ) : null}
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section id="resources" className="relative scroll-mt-24 overflow-hidden border-y border-border py-20">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-white/88" />
        <div className="container relative z-10 mx-auto px-6">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-primary">Resources</h2>
            <p className="mt-2 text-text-muted">Download references, forms, and official guides for public access.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-4">
            <article className="border border-border bg-white/95 p-5 shadow-sm">
              <h3 className="font-bold">Citizen Guidebook</h3>
              <p className="mt-2 text-xs text-text-muted">How to participate in hearings and legislative consultations.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setActivePublicDocId('res-1');
                    setPublicDocDialogOpen(true);
                  }}
                >
                  View
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadMock(publicResources.find((r) => r.id === 'res-1')!)}>
                  Download (Watermarked)
                </Button>
                <Button size="sm" variant="outline" onClick={() => printMock(publicResources.find((r) => r.id === 'res-1')!)}>
                  Print (Watermarked)
                </Button>
              </div>
            </article>
            <article className="border border-border bg-white/95 p-5 shadow-sm">
              <h3 className="font-bold">Ordinance Archive</h3>
              <p className="mt-2 text-xs text-text-muted">Historical local ordinances in searchable and downloadable format.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setActivePublicDocId('res-3');
                    setPublicDocDialogOpen(true);
                  }}
                >
                  View
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadMock(publicResources.find((r) => r.id === 'res-3')!)}>
                  Download (Watermarked)
                </Button>
              </div>
            </article>
            <article className="border border-border bg-white/95 p-5 shadow-sm">
              <h3 className="font-bold">Session Minutes</h3>
              <p className="mt-2 text-xs text-text-muted">Approved minutes from regular and special council sessions.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setActivePublicDocId('res-4');
                    setPublicDocDialogOpen(true);
                  }}
                >
                  View
                </Button>
                <Button size="sm" variant="outline" onClick={() => printMock(publicResources.find((r) => r.id === 'res-4')!)}>
                  Print (Watermarked)
                </Button>
              </div>
            </article>
            <article className="border border-border bg-white/95 p-5 shadow-sm">
              <h3 className="font-bold">Request Forms</h3>
              <p className="mt-2 text-xs text-text-muted">Document request and records verification forms for public service.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setActivePublicDocId('res-2');
                    setPublicDocDialogOpen(true);
                  }}
                >
                  View
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadMock(publicResources.find((r) => r.id === 'res-2')!)}>
                  Download Accreditation Form
                </Button>
              </div>
            </article>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <article className="border border-border bg-white/95 p-5 shadow-sm">
              <h3 className="font-bold text-primary">Public Account Registration</h3>
              <p className="mt-1 text-xs text-text-muted">Register to receive legislation updates and inquiry references.</p>
              <form onSubmit={handlePublicRegistration} className="mt-4 space-y-3">
                <Input
                  value={publicName}
                  onChange={(e) => setPublicName(e.target.value)}
                  placeholder="Full name"
                />
                <Input
                  value={publicEmail}
                  onChange={(e) => setPublicEmail(e.target.value)}
                  type="email"
                  placeholder="Email address"
                />
                <label className="flex items-center gap-2 text-xs text-text-muted">
                  <input
                    type="checkbox"
                    checked={notifyUpdates}
                    onChange={(e) => setNotifyUpdates(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Subscribe to ordinance/resolution updates
                </label>
                <Button type="submit" size="sm" className="bg-primary hover:bg-primary-light">Register</Button>
                {registrationNotice ? <p className="text-xs text-primary">{registrationNotice}</p> : null}
              </form>
            </article>
            <article className="border border-border bg-white/95 p-5 shadow-sm">
              <h3 className="font-bold text-primary">Accreditation Status Reference</h3>
              <p className="mt-1 text-xs text-text-muted">Reference statuses for submitted public accreditation requests.</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between border border-border px-3 py-2">
                  <span>ACC-2026-008</span>
                  <span className="font-semibold text-amber-700">For Verification</span>
                </div>
                <div className="flex items-center justify-between border border-border px-3 py-2">
                  <span>ACC-2026-005</span>
                  <span className="font-semibold text-green-700">Approved</span>
                </div>
                <div className="flex items-center justify-between border border-border px-3 py-2">
                  <span>ACC-2026-002</span>
                  <span className="font-semibold text-blue-700">Submitted</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Latest Updates Section */}
      <section className="py-20 bg-white border-y border-border">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold text-primary">Latest Legislative Updates</h2>
              <p className="text-text-muted mt-2">Recent actions taken by the City Council</p>
            </div>
            <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">
              View All News <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row gap-6 hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500 text-white text-[10px] font-bold animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  LIVE NOW
                </div>
              </div>
              <div className="w-full sm:w-40 h-40 bg-muted rounded-lg shrink-0 overflow-hidden">
                <img src="https://picsum.photos/seed/city1/400/400" alt="News" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-secondary mb-2 uppercase tracking-wider">Environment</div>
                <h4 className="font-bold text-xl mb-3 leading-tight">City Council Passes New Green Building Ordinance</h4>
                <p className="text-text-muted text-sm mb-4 line-clamp-2">
                  The council unanimously approved Ordinance No. 2024-45, requiring all new commercial developments to incorporate solar energy...
                </p>
                <div className="text-[11px] text-text-muted font-medium uppercase">April 12, 2024</div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row gap-6 hover:shadow-md transition-shadow">
              <div className="w-full sm:w-40 h-40 bg-muted rounded-lg shrink-0 overflow-hidden">
                <img src="https://picsum.photos/seed/city2/400/400" alt="News" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-secondary mb-2 uppercase tracking-wider">Infrastructure</div>
                <h4 className="font-bold text-xl mb-3 leading-tight">Public Hearing Scheduled for Smart City Initiative</h4>
                <p className="text-text-muted text-sm mb-4 line-clamp-2">
                  Citizens are invited to participate in the upcoming public hearing regarding the proposed $50M Smart City Infrastructure project...
                </p>
                <div className="text-[11px] text-text-muted font-medium uppercase">April 10, 2024</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-white py-16">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-primary font-bold">L</div>
                <h5 className="font-bold text-lg tracking-tight">LEGISLATIVE INFORMATION SYSTEM</h5>
              </div>
              <p className="text-white/60 text-sm max-w-md leading-relaxed">
                The official legislative portal of the City Government. We are committed to providing transparent, 
                accessible, and efficient government services to all our constituents.
              </p>
            </div>
            
            <div>
              <h6 className="font-bold mb-6 uppercase text-xs tracking-widest text-white/40">Quick Links</h6>
              <ul className="space-y-4 text-sm text-white/70">
                <li><a href="#" className="hover:text-white transition-colors">Search Legislation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Council Members</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Public Notices</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
              </ul>
            </div>

            <div>
              <h6 className="font-bold mb-6 uppercase text-xs tracking-widest text-white/40">Contact</h6>
              <ul className="space-y-4 text-sm text-white/70">
                <li>City Hall, Main Building</li>
                <li>Legislative Wing, 2nd Floor</li>
                <li>(555) 123-4567</li>
                <li>info@citylegislature.gov</li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/40">
            <p>© 2026 City Government. All Rights Reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Use</a>
              <a href="#" className="hover:text-white transition-colors">Accessibility</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
