import { useEffect, useMemo, useRef, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Overview } from '@/components/dashboard/Overview';
import { LegislativeTrackingList } from '@/components/legislation/LegislativeTrackingList';
import { MasterListingsView } from '@/components/members/MasterListingsView';
import { SessionList } from '@/components/sessions/SessionList';
import { ArchiveList } from '@/components/archive/ArchiveList';
import { ReportList } from '@/components/reports/ReportList';
import { RequirementsView } from '@/components/requirements/RequirementsView';
import { ESessionEsigView } from '@/components/esession/ESessionEsigView';
import { AccessView } from '@/components/access/AccessView';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { motion, AnimatePresence } from 'motion/react';
import { LandingPage } from '@/components/public/LandingPage';
import { Toaster } from '@/components/ui/toast';
import { ConfirmDialogHost } from '@/components/ui/confirm';
import { LandingSkeleton, PageSkeleton } from '@/components/ui/skeleton';
import { useLocation, useNavigate } from 'react-router-dom';

const SESSION_KEY = 'sb-capas-session';

// "Remember me" keeps the session in localStorage; otherwise it lasts for the browser tab (sessionStorage).
const readSession = () => {
  try {
    return localStorage.getItem(SESSION_KEY) === 'active' || sessionStorage.getItem(SESSION_KEY) === 'active';
  } catch {
    return false;
  }
};

const writeSession = (remember: boolean | null) => {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (remember !== null) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, 'active');
  } catch {
    // Storage unavailable (private mode): the session simply won't survive a refresh.
  }
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(readSession);
  const [isBooting, setIsBooting] = useState(true);
  const [loadedTab, setLoadedTab] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const tabToPath = useMemo(
    () => ({
      dashboard: '/dashboard',
      'manage-legislation': '/management/legislation',
      'manage-master-files': '/management/master-listings',
      'manage-transactions': '/management/transactions',
      'access-users': '/access/users',
      'access-roles': '/access/roles',
      'access-control-panel': '/access/control-panel',
      'report-search-listing': '/reports/search-listing',
      'report-statistical-performance': '/reports/statistical-performance',
      'report-attendance-publication': '/reports/attendance-publication',
      archive: '/archive',
      requirements: '/requirements',
      'req-core-modules': '/requirements/core-modules',
      'req-public-inquiry': '/requirements/public-inquiry',
      'req-reports-analytics': '/requirements/reports-analytics',
      'req-e-session-signature': '/requirements/e-session-esig',
      'esig-platform': '/e-session/platform',
      'esig-electronic-signature': '/e-session/electronic-signature',
      'esig-session-files': '/e-session/session-files-attachments',
    }),
    []
  );

  const pathToTab = useMemo(
    () =>
      Object.fromEntries(Object.entries(tabToPath).map(([tab, path]) => [path, tab])) as Record<
        string,
        string
      >,
    [tabToPath]
  );

  const activeTab = pathToTab[location.pathname] ?? 'dashboard';

  useEffect(() => {
    if (!isLoggedIn) return;
    if (location.pathname === '/') {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (!pathToTab[location.pathname]) {
      navigate('/dashboard', { replace: true });
    }
  }, [isLoggedIn, location.pathname, navigate, pathToTab]);

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  // Brief skeleton on first paint and on each page change; a page counts as loaded once its timer fires.
  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 700);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const timer = setTimeout(() => setLoadedTab(activeTab), 450);
    return () => clearTimeout(timer);
  }, [activeTab, isLoggedIn]);

  const showPageSkeleton = loadedTab !== activeTab;

  const setActiveTab = (tab: string) => {
    navigate(tabToPath[tab as keyof typeof tabToPath] ?? '/dashboard');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Overview onNavigate={setActiveTab} />;
      case 'manage-legislation':
        return <LegislativeTrackingList />;
      case 'manage-master-files':
        return <MasterListingsView />;
      case 'manage-transactions':
        return <SessionList />;
      case 'access-users':
      case 'access-roles':
      case 'access-control-panel':
        return <AccessView activeTab={activeTab} />;
      case 'archive':
        return <ArchiveList />;
      case 'reports':
      case 'report-search-listing':
      case 'report-statistical-performance':
      case 'report-attendance-publication':
        return <ReportList activeTab={activeTab} />;
      case 'requirements':
      case 'req-core-modules':
      case 'req-public-inquiry':
      case 'req-reports-analytics':
      case 'req-e-session-signature':
        return <RequirementsView activeTab={activeTab} />;
      case 'esig-platform':
      case 'esig-electronic-signature':
      case 'esig-session-files':
        return <ESessionEsigView activeTab={activeTab} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
            <div className="bg-muted p-6 rounded-full">
              <span className="text-4xl">🚧</span>
            </div>
            <h2 className="text-2xl font-bold">Under Construction</h2>
            <p className="text-muted-foreground max-w-md">
              The {activeTab} module is currently being developed. Please check back later for updates.
            </p>
          </div>
        );
    }
  };

  const handleLogin = (remember: boolean) => {
    writeSession(remember);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    writeSession(null);
    setIsLoggedIn(false);
    setLoadedTab(null);
    navigate('/', { replace: true });
  };

  if (!isLoggedIn) {
    return (
      <>
        {isBooting ? <LandingSkeleton /> : <LandingPage onLogin={handleLogin} />}
        <Toaster />
        <ConfirmDialogHost />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans antialiased md:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block md:w-72 md:shrink-0 md:h-screen md:sticky md:top-0">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <Navbar
          activeTab={activeTab}
          onLogout={handleLogout}
          onNavigate={setActiveTab}
          onMenuClick={() => setIsSidebarOpen(true)}
        />

        {/* Mobile Sidebar */}
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetContent side="left" className="p-0 w-72">
            <Sidebar
              activeTab={activeTab}
              setActiveTab={(tab) => {
                setActiveTab(tab);
                setIsSidebarOpen(false);
              }}
              onLogout={handleLogout}
            />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <main ref={mainScrollRef} className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-8 md:px-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${showPageSkeleton ? 'loading' : 'ready'}`}
                initial={{ opacity: 0, y: showPageSkeleton ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {showPageSkeleton ? <PageSkeleton variant={activeTab === 'dashboard' ? 'dashboard' : 'page'} /> : renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <Toaster />
      <ConfirmDialogHost />
    </div>
  );
}
