import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Users,
  Calendar,
  Archive,
  BarChart3,
  ClipboardList,
  FolderKanban,
  ChevronRight,
  MonitorSmartphone,
  ShieldCheck,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  className?: string;
  compact?: boolean;
}

export function Sidebar({ activeTab, setActiveTab, className, compact = false }: SidebarProps) {
  const topItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

  const bottomItems = [
    { id: 'archive', label: 'Archives', icon: Archive },
  ];

  const manageItems = [
    { id: 'manage-legislation', label: 'Legislative Tracking System', icon: FileText },
    { id: 'manage-master-files', label: 'Files and Master Listings', icon: Users },
    { id: 'manage-transactions', label: 'Transaction Operations', icon: Calendar },
  ];
  const accessItems = [
    { id: 'access-users', label: 'Users' },
    { id: 'access-roles', label: 'Roles' },
    { id: 'access-control-panel', label: 'Control Panel' },
  ];

  const requirementItems = [
    { id: 'req-core-modules', label: 'Core Modules' },
    { id: 'req-public-inquiry', label: 'Public Inquiry' },
    { id: 'req-reports-analytics', label: 'Reports & Analytics' },
    { id: 'req-e-session-signature', label: 'E-Session & eSig' },
  ];
  const eSessionItems = [
    { id: 'esig-platform', label: 'E-Session Platform' },
    { id: 'esig-electronic-signature', label: 'Electronic Signature' },
    { id: 'esig-session-files', label: 'Session Files and Attachments' },
  ];
  const reportItems = [
    { id: 'report-search-listing', label: 'Search and Listing Reports' },
    { id: 'report-statistical-performance', label: 'Statistical and Performance' },
    { id: 'report-attendance-publication', label: 'Attendance and Publication' },
  ];
  const manageActive = manageItems.some((item) => item.id === activeTab);
  const requirementsActive = activeTab === 'requirements' || activeTab.startsWith('req-');
  const reportsActive = activeTab === 'reports' || activeTab.startsWith('report-');
  const eSessionActive = activeTab.startsWith('esig-');
  const accessActive = accessItems.some((item) => item.id === activeTab);
  const [manageOpen, setManageOpen] = useState(manageActive);
  const [accessOpen, setAccessOpen] = useState(accessActive);
  const [requirementsOpen, setRequirementsOpen] = useState(requirementsActive);
  const [reportsOpen, setReportsOpen] = useState(reportsActive);
  const [eSessionOpen, setESessionOpen] = useState(eSessionActive);

  useEffect(() => {
    if (manageActive) setManageOpen(true);
  }, [manageActive]);

  useEffect(() => {
    if (requirementsActive) setRequirementsOpen(true);
  }, [requirementsActive]);

  useEffect(() => {
    if (reportsActive) setReportsOpen(true);
  }, [reportsActive]);

  useEffect(() => {
    if (eSessionActive) setESessionOpen(true);
  }, [eSessionActive]);

  useEffect(() => {
    if (accessActive) setAccessOpen(true);
  }, [accessActive]);

  const handleMenuSelect = (tab: string) => {
    setActiveTab(tab);
    setManageOpen(false);
    setAccessOpen(false);
    setReportsOpen(false);
    setRequirementsOpen(false);
    setESessionOpen(false);
  };

  const handleManageToggle = () => {
    setManageOpen((prev) => {
      const next = !prev;
      if (next) {
        setAccessOpen(false);
        setReportsOpen(false);
        setRequirementsOpen(false);
        setESessionOpen(false);
      }
      return next;
    });
  };

  const handleRequirementsToggle = () => {
    setRequirementsOpen((prev) => {
      const next = !prev;
      if (next) {
        setManageOpen(false);
        setReportsOpen(false);
        setESessionOpen(false);
        setAccessOpen(false);
      }
      return next;
    });
  };

  const handleManageItemSelect = (tab: string) => {
    setActiveTab(tab);
    setAccessOpen(false);
    setReportsOpen(false);
    setRequirementsOpen(false);
    setESessionOpen(false);
  };

  const handleAccessToggle = () => {
    setAccessOpen((prev) => {
      const next = !prev;
      if (next) {
        setManageOpen(false);
        setReportsOpen(false);
        setRequirementsOpen(false);
        setESessionOpen(false);
      }
      return next;
    });
  };

  const handleAccessItemSelect = (tab: string) => {
    setActiveTab(tab);
    setManageOpen(false);
    setReportsOpen(false);
    setRequirementsOpen(false);
    setESessionOpen(false);
  };

  const handleRequirementItemSelect = (tab: string) => {
    setActiveTab(tab);
    setManageOpen(false);
    setReportsOpen(false);
    setESessionOpen(false);
  };

  const handleReportsToggle = () => {
    setReportsOpen((prev) => {
      const next = !prev;
      if (next) {
        setManageOpen(false);
        setRequirementsOpen(false);
        setESessionOpen(false);
        setAccessOpen(false);
      }
      return next;
    });
  };

  const handleReportItemSelect = (tab: string) => {
    setActiveTab(tab);
    setManageOpen(false);
    setRequirementsOpen(false);
    setESessionOpen(false);
    setAccessOpen(false);
  };

  const handleESessionToggle = () => {
    setESessionOpen((prev) => {
      const next = !prev;
      if (next) {
        setManageOpen(false);
        setReportsOpen(false);
        setRequirementsOpen(false);
        setAccessOpen(false);
      }
      return next;
    });
  };

  const handleESessionItemSelect = (tab: string) => {
    setActiveTab(tab);
    setManageOpen(false);
    setReportsOpen(false);
    setRequirementsOpen(false);
    setAccessOpen(false);
  };

  return (
    <div className={cn("h-full bg-primary text-white flex flex-col", className)}>
      <div
        className={cn(
          "border-b border-white/10 flex items-center",
          compact ? "py-6" : "p-6 justify-start gap-3"
        )}
      >
        <div className={cn(compact ? "w-20 flex justify-center shrink-0" : "shrink-0")}>
          <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-primary font-bold text-2xl leading-none">
            L
          </div>
        </div>
        <div
          className={cn(
            compact
              ? "pr-4 max-w-0 opacity-0 overflow-hidden whitespace-nowrap pointer-events-none group-hover:max-w-44 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200"
              : ""
          )}
        >
          <div className="font-bold text-sm tracking-wider uppercase leading-none">LMIS ONLINE</div>
          <div className="text-[10px] opacity-60 mt-1">City Legislative Council</div>
        </div>
      </div>
      
      <div className={cn("flex-1", compact ? "py-3 space-y-2" : "py-4 space-y-1")}>
        {topItems.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            className={cn(
              "w-full flex items-center text-left cursor-pointer transition-all duration-200",
              compact
                ? "h-11 px-0 text-white/75 hover:text-white hover:bg-white/5"
                : "justify-start gap-3 px-6 py-3 text-sm font-medium opacity-80 hover:opacity-100 hover:bg-white/5",
              activeTab === item.id &&
                (compact
                  ? "text-white bg-white/10"
                  : "bg-white/10 opacity-100")
            )}
            onClick={() => handleMenuSelect(item.id)}
          >
            <span className={cn(compact ? "w-20 flex justify-center shrink-0" : "shrink-0")}>
              <item.icon className={cn("shrink-0", compact ? "h-[17px] w-[17px]" : "h-4 w-4")} />
            </span>
            <span
              className={cn(
                "block flex-1 leading-snug",
                compact
                  ? "pr-4 max-w-0 opacity-0 overflow-hidden whitespace-nowrap pointer-events-none group-hover:max-w-44 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200"
                  : ""
              )}
            >
              {item.label}
            </span>
          </button>
        ))}

        <div className="relative">
          <button
            type="button"
            aria-label="Management"
            aria-expanded={manageOpen}
            className={cn(
              "w-full flex items-center text-left cursor-pointer transition-all duration-200",
              compact
                ? "h-11 px-0 text-white/75 hover:text-white hover:bg-white/5"
                : "justify-start gap-3 px-6 py-3 text-sm font-medium opacity-80 hover:opacity-100 hover:bg-white/5",
              manageActive &&
                (compact
                  ? "text-white bg-white/10"
                  : "bg-white/10 opacity-100")
            )}
            onClick={handleManageToggle}
          >
            <span className={cn(compact ? "w-20 flex justify-center shrink-0" : "shrink-0")}>
              <FolderKanban className={cn("shrink-0", compact ? "h-[17px] w-[17px]" : "h-4 w-4")} />
            </span>
            <span
              className={cn(
                "block flex-1 leading-snug",
                compact
                  ? "pr-4 max-w-0 opacity-0 overflow-hidden whitespace-nowrap pointer-events-none group-hover:max-w-44 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200"
                  : ""
              )}
            >
              Management
            </span>
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200 opacity-70",
                compact
                  ? "mr-4 max-w-0 opacity-0 overflow-hidden pointer-events-none group-hover:max-w-4 group-hover:opacity-70"
                  : "mr-2",
                manageOpen && "rotate-90"
              )}
            />
          </button>

          <div
            className={cn(
              "relative space-y-1 pt-1 overflow-hidden transition-all duration-200",
              compact
                ? cn(
                    "absolute left-full top-0 ml-2 w-64 p-2 border border-white/10 bg-primary shadow-xl max-h-[70vh] overflow-y-auto z-20",
                    manageOpen ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-4 pointer-events-none"
                  )
                : cn(
                    "ml-14 pr-4 pl-4",
                    manageOpen ? "max-h-40 opacity-100 pointer-events-auto" : "max-h-0 opacity-0 pointer-events-none"
                  )
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-1 bottom-1 left-1 w-px bg-white/40",
                compact && "hidden"
              )}
            />
            {manageItems.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                className={cn(
                  "w-full flex items-center gap-3 text-left text-xs cursor-pointer opacity-80 transition-all duration-200 hover:opacity-100 hover:bg-white/5 px-3 py-2.5",
                  activeTab === item.id && "bg-white/10 opacity-100"
                )}
                onClick={() => handleManageItemSelect(item.id)}
              >
                <span className="leading-snug">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Access"
            aria-expanded={accessOpen}
            className={cn(
              "w-full flex items-center text-left cursor-pointer transition-all duration-200",
              compact
                ? "h-11 px-0 text-white/75 hover:text-white hover:bg-white/5"
                : "justify-start gap-3 px-6 py-3 text-sm font-medium opacity-80 hover:opacity-100 hover:bg-white/5",
              accessActive &&
                (compact
                  ? "text-white bg-white/10"
                  : "bg-white/10 opacity-100")
            )}
            onClick={handleAccessToggle}
          >
            <span className={cn(compact ? "w-20 flex justify-center shrink-0" : "shrink-0")}>
              <ShieldCheck className={cn("shrink-0", compact ? "h-[17px] w-[17px]" : "h-4 w-4")} />
            </span>
            <span
              className={cn(
                "block flex-1 leading-snug",
                compact
                  ? "pr-4 max-w-0 opacity-0 overflow-hidden whitespace-nowrap pointer-events-none group-hover:max-w-44 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200"
                  : ""
              )}
            >
              Access
            </span>
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200 opacity-70",
                compact
                  ? "mr-4 max-w-0 opacity-0 overflow-hidden pointer-events-none group-hover:max-w-4 group-hover:opacity-70"
                  : "mr-2",
                accessOpen && "rotate-90"
              )}
            />
          </button>

          <div
            className={cn(
              "relative space-y-1 pt-1 overflow-hidden transition-all duration-200",
              compact
                ? cn(
                    "absolute left-full top-0 ml-2 w-64 p-2 border border-white/10 bg-primary shadow-xl max-h-[70vh] overflow-y-auto z-20",
                    accessOpen ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-4 pointer-events-none"
                  )
                : cn(
                    "ml-14 pr-4 pl-4",
                    accessOpen ? "max-h-40 opacity-100 pointer-events-auto" : "max-h-0 opacity-0 pointer-events-none"
                  )
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-1 bottom-1 left-1 w-px bg-white/40",
                compact && "hidden"
              )}
            />
            {accessItems.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                className={cn(
                  "w-full flex items-center gap-3 text-left text-xs cursor-pointer opacity-80 transition-all duration-200 hover:opacity-100 hover:bg-white/5 px-3 py-2.5",
                  activeTab === item.id && "bg-white/10 opacity-100"
                )}
                onClick={() => handleAccessItemSelect(item.id)}
              >
                <span className="leading-snug">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Reports"
            aria-expanded={reportsOpen}
            className={cn(
              "w-full flex items-center text-left cursor-pointer transition-all duration-200",
              compact
                ? "h-11 px-0 text-white/75 hover:text-white hover:bg-white/5"
                : "justify-start gap-3 px-6 py-3 text-sm font-medium opacity-80 hover:opacity-100 hover:bg-white/5",
              reportsActive &&
                (compact
                  ? "text-white bg-white/10"
                  : "bg-white/10 opacity-100")
            )}
            onClick={handleReportsToggle}
          >
            <span className={cn(compact ? "w-20 flex justify-center shrink-0" : "shrink-0")}>
              <BarChart3 className={cn("shrink-0", compact ? "h-[17px] w-[17px]" : "h-4 w-4")} />
            </span>
            <span
              className={cn(
                "block flex-1 leading-snug",
                compact
                  ? "pr-4 max-w-0 opacity-0 overflow-hidden whitespace-nowrap pointer-events-none group-hover:max-w-44 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200"
                  : ""
              )}
            >
              Reports & Analytics
            </span>
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200 opacity-70",
                compact
                  ? "mr-4 max-w-0 opacity-0 overflow-hidden pointer-events-none group-hover:max-w-4 group-hover:opacity-70"
                  : "mr-2",
                reportsOpen && "rotate-90"
              )}
            />
          </button>

          <div
            className={cn(
              "relative space-y-1 pt-1 overflow-hidden transition-all duration-200",
              compact
                ? cn(
                    "absolute left-full top-0 ml-2 w-64 p-2 border border-white/10 bg-primary shadow-xl max-h-[70vh] overflow-y-auto z-20",
                    reportsOpen ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-4 pointer-events-none"
                  )
                : cn(
                    "ml-14 pr-4 pl-4",
                    reportsOpen ? "max-h-56 opacity-100 pointer-events-auto" : "max-h-0 opacity-0 pointer-events-none"
                  )
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-1 bottom-1 left-1 w-px bg-white/40",
                compact && "hidden"
              )}
            />
            {reportItems.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                className={cn(
                  "w-full flex items-center gap-3 text-left text-xs cursor-pointer opacity-80 transition-all duration-200 hover:opacity-100 hover:bg-white/5 px-3 py-2.5",
                  activeTab === item.id && "bg-white/10 opacity-100"
                )}
                onClick={() => handleReportItemSelect(item.id)}
              >
                <span className="leading-snug">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="E-Session & eSig"
            aria-expanded={eSessionOpen}
            className={cn(
              "w-full flex items-center text-left cursor-pointer transition-all duration-200",
              compact
                ? "h-11 px-0 text-white/75 hover:text-white hover:bg-white/5"
                : "justify-start gap-3 px-6 py-3 text-sm font-medium opacity-80 hover:opacity-100 hover:bg-white/5",
              eSessionActive &&
                (compact
                  ? "text-white bg-white/10"
                  : "bg-white/10 opacity-100")
            )}
            onClick={handleESessionToggle}
          >
            <span className={cn(compact ? "w-20 flex justify-center shrink-0" : "shrink-0")}>
              <MonitorSmartphone className={cn("shrink-0", compact ? "h-[17px] w-[17px]" : "h-4 w-4")} />
            </span>
            <span
              className={cn(
                "block flex-1 leading-snug",
                compact
                  ? "pr-4 max-w-0 opacity-0 overflow-hidden whitespace-nowrap pointer-events-none group-hover:max-w-44 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200"
                  : ""
              )}
            >
              E-Session & eSig
            </span>
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200 opacity-70",
                compact
                  ? "mr-4 max-w-0 opacity-0 overflow-hidden pointer-events-none group-hover:max-w-4 group-hover:opacity-70"
                  : "mr-2",
                eSessionOpen && "rotate-90"
              )}
            />
          </button>

          <div
            className={cn(
              "relative space-y-1 pt-1 overflow-hidden transition-all duration-200",
              compact
                ? cn(
                    "absolute left-full top-0 ml-2 w-64 p-2 border border-white/10 bg-primary shadow-xl max-h-[70vh] overflow-y-auto z-20",
                    eSessionOpen ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-4 pointer-events-none"
                  )
                : cn(
                    "ml-14 pr-4 pl-4",
                    eSessionOpen ? "max-h-56 opacity-100 pointer-events-auto" : "max-h-0 opacity-0 pointer-events-none"
                  )
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-1 bottom-1 left-1 w-px bg-white/40",
                compact && "hidden"
              )}
            />
            {eSessionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                className={cn(
                  "w-full flex items-center gap-3 text-left text-xs cursor-pointer opacity-80 transition-all duration-200 hover:opacity-100 hover:bg-white/5 px-3 py-2.5",
                  activeTab === item.id && "bg-white/10 opacity-100"
                )}
                onClick={() => handleESessionItemSelect(item.id)}
              >
                <span className="leading-snug">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {bottomItems.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            className={cn(
              "w-full flex items-center text-left cursor-pointer transition-all duration-200",
              compact
                ? "h-11 px-0 text-white/75 hover:text-white hover:bg-white/5"
                : "justify-start gap-3 px-6 py-3 text-sm font-medium opacity-80 hover:opacity-100 hover:bg-white/5",
              activeTab === item.id &&
                (compact
                  ? "text-white bg-white/10"
                  : "bg-white/10 opacity-100")
            )}
            onClick={() => handleMenuSelect(item.id)}
          >
            <span className={cn(compact ? "w-20 flex justify-center shrink-0" : "shrink-0")}>
              <item.icon className={cn("shrink-0", compact ? "h-[17px] w-[17px]" : "h-4 w-4")} />
            </span>
            <span
              className={cn(
                "block flex-1 leading-snug",
                compact
                  ? "pr-4 max-w-0 opacity-0 overflow-hidden whitespace-nowrap pointer-events-none group-hover:max-w-44 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200"
                  : ""
              )}
            >
              {item.label}
            </span>
          </button>
        ))}

        <div className={cn("border-t border-white/10 relative", compact ? "pt-3 mt-3" : "pt-4 mt-4")}>
          <button
            type="button"
            aria-label="Requirements"
            aria-expanded={requirementsOpen}
            className={cn(
              "w-full flex items-center text-left cursor-pointer transition-all duration-200",
              compact
                ? "h-11 px-0 text-white/75 hover:text-white hover:bg-white/5"
                : "justify-start gap-3 px-6 py-3 text-sm font-medium opacity-80 hover:opacity-100 hover:bg-white/5",
              requirementsActive &&
                (compact
                  ? "text-white bg-white/10"
                  : "bg-white/10 opacity-100")
            )}
            onClick={handleRequirementsToggle}
          >
            <span className={cn(compact ? "w-20 flex justify-center shrink-0" : "shrink-0")}>
              <ClipboardList className={cn("shrink-0", compact ? "h-[17px] w-[17px]" : "h-4 w-4")} />
            </span>
            <span
              className={cn(
                "block flex-1 leading-snug",
                compact
                  ? "pr-4 max-w-0 opacity-0 overflow-hidden whitespace-nowrap pointer-events-none group-hover:max-w-44 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200"
                  : ""
              )}
            >
              Requirements
            </span>
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200 opacity-70",
                compact
                  ? "mr-4 max-w-0 opacity-0 overflow-hidden pointer-events-none group-hover:max-w-4 group-hover:opacity-70"
                  : "mr-2",
                requirementsOpen && "rotate-90"
              )}
            />
          </button>

          <div
            className={cn(
              "relative space-y-1 pt-1 overflow-hidden transition-all duration-200",
              compact
                ? cn(
                    "absolute left-full top-0 ml-2 w-64 p-2 border border-white/10 bg-primary shadow-xl max-h-[70vh] overflow-y-auto z-20",
                    requirementsOpen ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-4 pointer-events-none"
                  )
                : cn(
                    "ml-14 pr-4 pl-4",
                    requirementsOpen ? "max-h-56 opacity-100 pointer-events-auto" : "max-h-0 opacity-0 pointer-events-none"
                  )
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-1 bottom-1 left-1 w-px bg-white/40",
                compact && "hidden"
              )}
            />
            {requirementItems.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                className={cn(
                  "w-full flex items-center gap-3 text-left text-xs cursor-pointer opacity-80 transition-all duration-200 hover:opacity-100 hover:bg-white/5 px-3 py-2.5",
                  activeTab === item.id && "bg-white/10 opacity-100"
                )}
                onClick={() => handleRequirementItemSelect(item.id)}
              >
                <span className="leading-snug">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>

      <div
        className={cn(
          "p-6 text-[11px] opacity-50 mt-auto border-t border-white/10",
          compact
            ? "max-h-0 opacity-0 overflow-hidden group-hover:max-h-20 group-hover:opacity-50 transition-all duration-200"
            : ""
        )}
      >
        v2.4.0-Stable | 2024 System
      </div>
    </div>
  );
}
