import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockSystemRequirements } from '@/lib/system-requirements';
import { mockBills, mockSessions } from '@/lib/mock-data';

interface RequirementsViewProps {
  activeTab: string;
}

interface FlowSection {
  heading: string;
  steps: string[];
  outputs: string[];
}

const tabToGroupTitle: Record<string, string> = {
  requirements: 'Core Legislative Modules',
  'req-core-modules': 'Core Legislative Modules',
  'req-public-inquiry': 'Public Viewing and Inquiry',
  'req-reports-analytics': 'Reports and Analytics',
  'req-e-session-signature': 'E-Session and Digital Signature',
  'esig-platform': 'E-Session and Digital Signature',
  'esig-electronic-signature': 'E-Session and Digital Signature',
  'esig-session-files': 'E-Session and Digital Signature',
};

const tabToBlockHeading: Record<string, string> = {
  'esig-platform': 'E-Session Platform',
  'esig-electronic-signature': 'Electronic Signature',
  'esig-session-files': 'Session Files and Attachments',
};

const groupFlowReference: Record<string, FlowSection[]> = {
  'Core Legislative Modules': [
    {
      heading: 'Legislative Tracking System Flow',
      steps: [
        'Capture incoming and outgoing documents with tracking number and date.',
        'Route document to agenda, committee referral, hearing, or report workflow.',
        'Update measure stage from draft through approval/disapproval states.',
        'Attach ordinance/resolution full text and committee report references.',
      ],
      outputs: [
        'Traceable status history per ordinance/resolution.',
        'Searchable document repository with linked files.',
      ],
    },
    {
      heading: 'Special Files and Master Listings Flow',
      steps: [
        'Maintain per-cycle Executive Legislative Agenda and program/project listings.',
        'Update committee, committee member, and Sanggunian master records.',
        'Maintain subject matter, classification, and codification references.',
      ],
      outputs: [
        'Updated master listings reports.',
        'Codified subject and classification reference tables.',
      ],
    },
    {
      heading: 'Transaction Operations Flow',
      steps: [
        'Receive proposed SB resolutions/ordinances and incoming documents.',
        'Generate automated agenda drafts with e-session provision.',
        'Manage committee referrals, hearings/meetings, and report issuance.',
        'Prepare minutes/journals and transmittal letters.',
      ],
      outputs: [
        'Committee action logs and agenda-ready records.',
        'Transmittal and minutes/journal artifacts.',
      ],
    },
  ],
  'Public Viewing and Inquiry': [
    {
      heading: 'Public Portal and Quick Links Flow',
      steps: [
        'Display current-year weekly agenda and latest approved measures.',
        'Expose committee and council profile listings for public view.',
        'Enable view/download/print with watermark controls.',
      ],
      outputs: [
        'Public-facing agenda and approved measures feed.',
        'Watermarked downloadable public documents.',
      ],
    },
    {
      heading: 'Inquiry Engine Flow',
      steps: [
        'Filter legislation by keyword, subject, referral, classification, and category.',
        'Filter by authorship, co-authorship, sponsorship, and action taken.',
        'Run same filter set for incoming documents/transmittal letters.',
      ],
      outputs: [
        'Unified inquiry results for legislation and documents.',
        'Filter-based listing ready for export/printing.',
      ],
    },
    {
      heading: 'Account Registration Flow',
      steps: [
        'Accept simple account registration for public users.',
        'Enable updates/notification subscription for legislation.',
        'Provide accreditation form download and status reference.',
      ],
      outputs: [
        'Registered public user records.',
        'Accreditation request reference entries.',
      ],
    },
  ],
  'Reports and Analytics': [
    {
      heading: 'Search and Listing Reports Flow',
      steps: [
        'Generate approved/unapproved legislation reports by full filter criteria.',
        'Generate incoming documents/transmittal listing reports.',
        'Support per-report print/export actions.',
      ],
      outputs: [
        'Search/listing reports by keyword, subject, and committee filters.',
        'Printable and exportable report files.',
      ],
    },
    {
      heading: 'Statistical and Performance Reports Flow',
      steps: [
        'Compute yearly totals for approved measures and incoming documents.',
        'Compute committee and member productivity metrics.',
        'Produce summary of local legislation performance.',
      ],
      outputs: [
        'Statistical reports by year, category, and classification.',
        'Member and committee performance scorecards.',
      ],
    },
    {
      heading: 'Attendance and Publication Reports Flow',
      steps: [
        'Generate session attendance with and without quorum.',
        'Generate second reading publication-by-posting lists.',
        'Generate list of ordinances with penal clause and publication status.',
      ],
      outputs: [
        'Attendance report packs.',
        'Publication compliance reports.',
      ],
    },
  ],
  'E-Session and Digital Signature': [
    {
      heading: 'E-Session Platform Flow',
      steps: [
        'Connect tablets/iPads/laptops from session hall to server.',
        'Sync order of business and agenda in live session.',
        'Auto-update agenda transcription and presiding officer notes.',
      ],
      outputs: [
        'Connected device roster and live sync status.',
        'Server-linked digital agenda timeline.',
      ],
    },
    {
      heading: 'Electronic Signature Flow',
      steps: [
        'Enable real-time signature for approved ordinances/resolutions in PDF.',
        'Allow stylus/pen signature capture for present SB members.',
        'Secretary monitors and finalizes/locks signatures.',
      ],
      outputs: [
        'Signed PDF ordinance/resolution artifacts.',
        'Attendance-based signature placement records.',
      ],
    },
    {
      heading: 'Session Files and Attachments Flow',
      steps: [
        'Provide weekly agenda access for regular/special/joint sessions.',
        'Attach session audio/video files with file-size constraints.',
        'Allow browse, download, and print with watermark controls.',
      ],
      outputs: [
        'Session file repository with media attachments.',
        'Printable and downloadable watermarked files.',
      ],
    },
  ],
};

export function RequirementsView({ activeTab }: RequirementsViewProps) {
  const selectedTitle = tabToGroupTitle[activeTab] ?? 'Core Legislative Modules';
  const selectedGroup =
    mockSystemRequirements.find((group) => group.title === selectedTitle) ?? mockSystemRequirements[0];
  const selectedBlockHeading = tabToBlockHeading[activeTab];
  const visibleBlocks = selectedBlockHeading
    ? selectedGroup.blocks.filter((block) => block.heading === selectedBlockHeading)
    : selectedGroup.blocks;
  const [keyword, setKeyword] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [signedBills, setSignedBills] = useState<string[]>([]);

  const statuses = useMemo(
    () => ['All', ...Array.from(new Set(mockBills.map((bill) => bill.status)))],
    []
  );
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(mockBills.map((bill) => bill.category)))],
    []
  );

  const inquiryResults = useMemo(() => {
    return mockBills.filter((bill) => {
      const matchesKeyword =
        keyword.trim().length === 0 ||
        bill.title.toLowerCase().includes(keyword.toLowerCase()) ||
        bill.number.toLowerCase().includes(keyword.toLowerCase()) ||
        bill.author.toLowerCase().includes(keyword.toLowerCase()) ||
        bill.description.toLowerCase().includes(keyword.toLowerCase());
      const matchesStatus = selectedStatus === 'All' || bill.status === selectedStatus;
      const matchesCategory = selectedCategory === 'All' || bill.category === selectedCategory;
      return matchesKeyword && matchesStatus && matchesCategory;
    });
  }, [keyword, selectedStatus, selectedCategory]);

  const reports = useMemo(() => {
    const byStatus = mockBills.reduce<Record<string, number>>((acc, bill) => {
      acc[bill.status] = (acc[bill.status] ?? 0) + 1;
      return acc;
    }, {});
    const byCategory = mockBills.reduce<Record<string, number>>((acc, bill) => {
      acc[bill.category] = (acc[bill.category] ?? 0) + 1;
      return acc;
    }, {});
    const byAuthor = mockBills.reduce<Record<string, number>>((acc, bill) => {
      acc[bill.author] = (acc[bill.author] ?? 0) + 1;
      return acc;
    }, {});
    return { byStatus, byCategory, byAuthor };
  }, []);

  const signBill = (id: string) => {
    setSignedBills((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const eSessionQueue = useMemo(
    () => [
      { device: 'Session Hall Tablet A', status: 'Connected', lastSync: '10:12 AM' },
      { device: 'Presiding Officer iPad', status: 'Connected', lastSync: '10:11 AM' },
      { device: 'Secretary Laptop', status: 'Pending', lastSync: '09:58 AM' },
    ],
    []
  );

  const attendanceForSignature = useMemo(
    () => [
      { member: 'Hon. Maria Santos', present: true, signed: signedBills.includes('sig-1') },
      { member: 'Sen. Robert Chen', present: true, signed: signedBills.includes('sig-2') },
      { member: 'Hon. James Wilson', present: false, signed: false },
      { member: 'Hon. Elena Rodriguez', present: true, signed: signedBills.includes('sig-4') },
    ],
    [signedBills]
  );

  const sessionAttachments = useMemo(
    () => [
      { file: 'Regular Session Agenda - Week 16.pdf', type: 'Agenda', action: 'View / Download' },
      { file: 'Committee Hearing Audio - Finance.mp3', type: 'Audio', action: 'Play / Download' },
      { file: 'Plenary Highlights - April 2024.mp4', type: 'Video', action: 'Play / Download' },
      { file: 'Session Minutes Draft.docx', type: 'Minutes', action: 'View / Print' },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">System Requirements</h1>
        <p className="text-sm text-text-muted">Document-style mock requirements aligned with the project proposal content.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {mockSystemRequirements.map((group) => (
          <div
            key={group.title}
            className={`border bg-white p-4 shadow-sm ${
              group.title === selectedGroup.title ? 'border-primary/40' : 'border-border'
            }`}
          >
            <h2 className="text-sm font-bold">{group.title}</h2>
            <p className="mt-1 text-xs text-text-muted">{group.blocks.length} requirement blocks</p>
          </div>
        ))}
      </div>

      <div className="border-l-4 border-primary bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">{selectedGroup.title}</h3>
        <p className="mt-2 text-sm text-text-muted">{selectedGroup.description}</p>
      </div>

      <div className="space-y-3">
        {groupFlowReference[selectedGroup.title]?.map((flow) => (
          <article key={flow.heading} className="border border-border bg-white p-5 shadow-sm">
            <h4 className="text-base font-bold">{flow.heading}</h4>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-text-muted font-semibold">Process Steps</div>
                <ul className="mt-2 space-y-1.5 text-sm text-text-main">
                  {flow.steps.map((step) => (
                    <li key={step}>- {step}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-text-muted font-semibold">Expected Outputs</div>
                <ul className="mt-2 space-y-1.5 text-sm text-text-main">
                  {flow.outputs.map((output) => (
                    <li key={output}>- {output}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="space-y-4">
        {visibleBlocks.map((block, index) => (
          <article key={block.heading} className="border border-border bg-white p-6 shadow-sm">
            <h4 className="text-base font-bold">
              {index + 1}. {block.heading}
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-text-main">
              {block.details.map((detail, detailIndex) => (
                <li key={detail} className="flex gap-3">
                  <span className="text-text-muted">{detailIndex + 1}.</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {selectedTitle === 'Public Viewing and Inquiry' && (
        <div className="border border-border bg-white p-6 shadow-sm space-y-4">
          <h4 className="text-lg font-bold">Inquiry Engine (Mock Logic)</h4>
          <p className="text-sm text-text-muted">Searches bills by keyword, status, and category using mock records.</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search keyword / title / bill no."
            />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-10 border border-border bg-white px-3 text-sm"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-10 border border-border bg-white px-3 text-sm"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="border border-border">
            <div className="grid grid-cols-12 bg-muted/40 px-4 py-2 text-xs font-bold uppercase">
              <div className="col-span-2">Bill No.</div>
              <div className="col-span-4">Title</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2">Author</div>
            </div>
            {inquiryResults.map((bill) => (
              <div key={bill.id} className="grid grid-cols-12 border-t border-border px-4 py-2 text-sm">
                <div className="col-span-2">{bill.number}</div>
                <div className="col-span-4">{bill.title}</div>
                <div className="col-span-2">{bill.status}</div>
                <div className="col-span-2">{bill.category}</div>
                <div className="col-span-2">{bill.author}</div>
              </div>
            ))}
            {inquiryResults.length === 0 && (
              <div className="px-4 py-4 text-sm text-text-muted">No matching records found.</div>
            )}
          </div>
        </div>
      )}

      {selectedTitle === 'Reports and Analytics' && (
        <div className="border border-border bg-white p-6 shadow-sm space-y-4">
          <h4 className="text-lg font-bold">Report Generator (Mock Logic)</h4>
          <p className="text-sm text-text-muted">Computed from current mock bills and sessions dataset.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border border-border p-4">
              <div className="text-xs uppercase text-text-muted">Total Bills</div>
              <div className="mt-2 text-3xl font-bold text-primary">{mockBills.length}</div>
            </div>
            <div className="border border-border p-4">
              <div className="text-xs uppercase text-text-muted">Total Sessions</div>
              <div className="mt-2 text-3xl font-bold text-primary">{mockSessions.length}</div>
            </div>
            <div className="border border-border p-4">
              <div className="text-xs uppercase text-text-muted">Enacted/Pased</div>
              <div className="mt-2 text-3xl font-bold text-primary">
                {(reports.byStatus.Enacted ?? 0) + (reports.byStatus.Passed ?? 0)}
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-border p-4">
              <h5 className="text-sm font-bold mb-2">By Status</h5>
              {Object.entries(reports.byStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between border-t border-border py-1 text-sm">
                  <span>{status}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
            <div className="border border-border p-4">
              <h5 className="text-sm font-bold mb-2">By Category</h5>
              {Object.entries(reports.byCategory).map(([category, count]) => (
                <div key={category} className="flex justify-between border-t border-border py-1 text-sm">
                  <span>{category}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedTitle === 'E-Session and Digital Signature' && (
        <div className="border border-border bg-white p-6 shadow-sm space-y-4">
          <h4 className="text-lg font-bold">E-Session Signature Flow (Mock Logic)</h4>
          <p className="text-sm text-text-muted">
            Simulates session signing state for approved/passed/enacted legislative items.
          </p>
          <div className="space-y-2">
            {mockBills
              .filter((bill) => ['Passed', 'Enacted'].includes(bill.status))
              .map((bill) => {
                const isSigned = signedBills.includes(bill.id);
                return (
                  <div key={bill.id} className="flex items-center justify-between border border-border p-3">
                    <div>
                      <div className="text-sm font-semibold">{bill.number} - {bill.title}</div>
                      <div className="text-xs text-text-muted">Status: {bill.status}</div>
                    </div>
                    <Button
                      size="sm"
                      variant={isSigned ? 'default' : 'outline'}
                      onClick={() => signBill(bill.id)}
                    >
                      {isSigned ? 'Signed' : 'Sign Document'}
                    </Button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {activeTab === 'esig-platform' && (
        <div className="border border-border bg-white p-6 shadow-sm space-y-4">
          <h4 className="text-lg font-bold">E-Session Platform Process (Mock)</h4>
          <p className="text-sm text-text-muted">
            Simulates live session device connectivity, agenda sync, and transcription updates.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="border border-border p-4">
              <div className="text-xs uppercase text-text-muted">Connected Devices</div>
              <div className="mt-2 text-3xl font-bold text-primary">
                {eSessionQueue.filter((item) => item.status === 'Connected').length}
              </div>
            </div>
            <div className="border border-border p-4">
              <div className="text-xs uppercase text-text-muted">Pending Sync</div>
              <div className="mt-2 text-3xl font-bold text-primary">
                {eSessionQueue.filter((item) => item.status !== 'Connected').length}
              </div>
            </div>
            <div className="border border-border p-4">
              <div className="text-xs uppercase text-text-muted">Agenda Version</div>
              <div className="mt-2 text-3xl font-bold text-primary">v2.4</div>
            </div>
          </div>
          <div className="border border-border">
            <div className="grid grid-cols-12 bg-muted/40 px-4 py-2 text-xs font-bold uppercase">
              <div className="col-span-5">Device</div>
              <div className="col-span-3">Status</div>
              <div className="col-span-4">Last Sync</div>
            </div>
            {eSessionQueue.map((item) => (
              <div key={item.device} className="grid grid-cols-12 border-t border-border px-4 py-2 text-sm">
                <div className="col-span-5">{item.device}</div>
                <div className="col-span-3">{item.status}</div>
                <div className="col-span-4">{item.lastSync}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'esig-electronic-signature' && (
        <div className="border border-border bg-white p-6 shadow-sm space-y-4">
          <h4 className="text-lg font-bold">Electronic Signature Process (Mock)</h4>
          <p className="text-sm text-text-muted">
            Demonstrates signer availability based on attendance and signature finalization flow.
          </p>
          <div className="space-y-2">
            {attendanceForSignature.map((row, idx) => (
              <div key={row.member} className="flex items-center justify-between border border-border p-3">
                <div>
                  <div className="text-sm font-semibold">{row.member}</div>
                  <div className="text-xs text-text-muted">
                    {row.present ? 'Present - eligible for signing' : 'Absent - signature disabled'}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={row.signed ? 'default' : 'outline'}
                  disabled={!row.present}
                  onClick={() => signBill(`sig-${idx + 1}`)}
                >
                  {row.signed ? 'Signed' : 'Sign Document'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'esig-session-files' && (
        <div className="border border-border bg-white p-6 shadow-sm space-y-4">
          <h4 className="text-lg font-bold">Session Files and Attachments Process (Mock)</h4>
          <p className="text-sm text-text-muted">
            Mock file browsing flow for agenda, minutes, and session media attachments.
          </p>
          <div className="border border-border">
            <div className="grid grid-cols-12 bg-muted/40 px-4 py-2 text-xs font-bold uppercase">
              <div className="col-span-6">File</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-4">Action</div>
            </div>
            {sessionAttachments.map((row) => (
              <div key={row.file} className="grid grid-cols-12 border-t border-border px-4 py-2 text-sm">
                <div className="col-span-6">{row.file}</div>
                <div className="col-span-2">{row.type}</div>
                <div className="col-span-4">{row.action}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="border border-border p-4">
              <div className="text-xs uppercase text-text-muted">Agenda Files</div>
              <div className="mt-2 text-3xl font-bold text-primary">6</div>
            </div>
            <div className="border border-border p-4">
              <div className="text-xs uppercase text-text-muted">Media Attachments</div>
              <div className="mt-2 text-3xl font-bold text-primary">9</div>
            </div>
            <div className="border border-border p-4">
              <div className="text-xs uppercase text-text-muted">Ready for Print</div>
              <div className="mt-2 text-3xl font-bold text-primary">4</div>
            </div>
          </div>
        </div>
      )}

      {selectedTitle === 'Core Legislative Modules' && (
        <div className="border border-border bg-white p-6 shadow-sm space-y-3">
          <h4 className="text-lg font-bold">Core Module Status (Mock Logic)</h4>
          <p className="text-sm text-text-muted">
            Pipeline counts reflect current dataset progression from draft to enactment.
          </p>
          <div className="grid gap-3 md:grid-cols-4">
            {['Draft', 'First Reading', 'Committee', 'Second Reading', 'Third Reading', 'Passed', 'Enacted'].map((stage) => (
              <div key={stage} className="border border-border p-3">
                <div className="text-xs uppercase text-text-muted">{stage}</div>
                <div className="mt-1 text-2xl font-bold text-primary">{reports.byStatus[stage] ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
