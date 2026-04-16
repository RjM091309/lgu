export interface RequirementBlock {
  heading: string;
  details: string[];
}

export interface RequirementGroup {
  title: string;
  description: string;
  blocks: RequirementBlock[];
}

export const mockSystemRequirements: RequirementGroup[] = [
  {
    title: "Core Legislative Modules",
    description: "Main operational modules for legislative management and document control.",
    blocks: [
      {
        heading: "Legislative Tracking System",
        details: [
          "Record incoming and outgoing letters, requests, and transmittal documents.",
          "Track proposed resolutions and ordinances by stage: draft, first reading, committee, second reading, approved/disapproved.",
          "Link full ordinance/resolution text and committee reports to each tracked record.",
          "Maintain minutes, journals, and order of business entries per session.",
        ],
      },
      {
        heading: "Special Files and Master Listings",
        details: [
          "Executive Legislative Agenda file per session cycle.",
          "Programs and project file of the Sangguniang Bayan.",
          "Master list of committees, committee members, and Sanggunian members.",
          "Subject matter listing and codification references.",
        ],
      },
      {
        heading: "Transaction Operations",
        details: [
          "Proposed SB resolutions and ordinances processing.",
          "Incoming documents receiving and routing workflow.",
          "Automated agenda preparation with E-Session support.",
          "Committee referrals, hearings, meetings, and report issuance.",
          "Transmittal letter generation and monitoring.",
        ],
      },
    ],
  },
  {
    title: "Public Viewing and Inquiry",
    description: "Public portal access, inquiry filters, and account registration capabilities.",
    blocks: [
      {
        heading: "Home Page and Quick Links",
        details: [
          "Display current year weekly agenda list.",
          "Show latest approved resolutions and ordinances.",
          "Provide current committee and council profile listings.",
          "Allow print/download for selected public documents with watermark.",
        ],
      },
      {
        heading: "Legislation and Inquiry Filters",
        details: [
          "Browse present and past legislation: resolutions and ordinances.",
          "Search by keyword, subject matter, committee referral, and classification.",
          "Search by category, status, authorship, sponsorship, and co-sponsorship.",
          "Search by action taken and complete records by selected year.",
        ],
      },
      {
        heading: "Account Registration",
        details: [
          "Simple user account registration form for public users.",
          "Account-based updates and legislative notification subscriptions.",
          "Accreditation form download and status reference for applicants.",
        ],
      },
    ],
  },
  {
    title: "Reports and Analytics",
    description: "Operational, statistical, performance, and attendance reports.",
    blocks: [
      {
        heading: "Search and Listing Reports",
        details: [
          "Approved and unapproved resolutions/ordinances by keyword and subject.",
          "Reports by authorship, co-authorship, sponsorship, and co-sponsorship.",
          "Reports by committee referral, status, classification, and category.",
          "Incoming documents/transmittal reports using the same filter set.",
        ],
      },
      {
        heading: "Statistical and Performance Reports",
        details: [
          "Total approved resolutions/ordinances per year and per committee.",
          "Total incoming documents by origin and referral totals (annual).",
          "Session totals and authored legislation summaries.",
          "Member, committee, and local legislation performance reports.",
        ],
      },
      {
        heading: "Attendance and Publication Reports",
        details: [
          "Attendance reports for sessions with quorum and without quorum.",
          "Second reading for publication-by-posting lists.",
          "List of proposed ordinances with penal clause and publication status.",
        ],
      },
    ],
  },
  {
    title: "E-Session and Digital Signature",
    description: "Electronic session, agenda sync, and real-time signature workflows.",
    blocks: [
      {
        heading: "E-Session Platform",
        details: [
          "Connect session hall devices (tablet/iPad/laptop) for paperless operation.",
          "View order of business and agenda from server-linked records.",
          "Automatic update of agenda transcription during live session.",
          "Presiding officer note support and Apple device compatibility.",
        ],
      },
      {
        heading: "Electronic Signature",
        details: [
          "Real-time e-signature on approved ordinances and resolutions in PDF format.",
          "Signature pen/stylus support for member approvals.",
          "Secretary monitoring with signature finalization and locking controls.",
          "Signature positioning based on attendance-present SB members.",
        ],
      },
      {
        heading: "Session Files and Attachments",
        details: [
          "Weekly agenda views for regular, special, and joint sessions.",
          "Audio/video attachment support for session records.",
          "Document browsing, download, and print with watermark controls.",
        ],
      },
    ],
  },
];
