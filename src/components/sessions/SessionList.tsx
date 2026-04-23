import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { mockSessions } from '@/lib/mock-data';
import { Calendar as CalendarIcon, Clock, MapPin, Users2, Video, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SessionList() {
  const [routingQueue, setRoutingQueue] = useState([
    { id: 'TR-001', item: 'Incoming document receiving and routing workflow', status: 'In Routing' },
    { id: 'TR-002', item: 'Committee referrals and report issuance', status: 'For Committee' },
    { id: 'TR-003', item: 'Automated agenda preparation with E-Session support', status: 'For Agenda Build' },
    { id: 'TR-004', item: 'Transmittal letter generation and monitoring', status: 'Ready to Transmit' },
  ]);
  const statusFlow = ['In Routing', 'For Committee', 'For Agenda Build', 'Ready to Transmit', 'Completed'];
  const assessmentQueue = [
    { refNo: 'APP-2026-011', applicant: 'Barangay ICT Council', compliance: '8/10', evaluation: 'For Revision' },
    { refNo: 'APP-2026-014', applicant: 'Public Safety Office', compliance: '10/10', evaluation: 'Ready for Approval' },
    { refNo: 'APP-2026-016', applicant: 'Citizen Transport Coalition', compliance: '6/10', evaluation: 'Incomplete Requirements' },
  ];
  const approvalQueue = [
    { docNo: 'ORD-2026-021', title: 'Traffic Signal Compliance Ordinance', stage: 'For Mayor Review', action: 'Approve / Return / Disapprove' },
    { docNo: 'RES-2026-078', title: 'Resolution Adopting Digital Minutes Workflow', stage: 'For Issuance', action: 'Issue Signed Copy' },
  ];
  const notificationMatrix = [
    { event: 'Approval', channel: 'System + Email', recipients: 'Author, Secretariat, Concerned Office' },
    { event: 'Disapproval', channel: 'System + Email', recipients: 'Author, Committee Chair' },
    { event: 'Returned/Incomplete', channel: 'System', recipients: 'Originating Office' },
    { event: 'Publication/Posting', channel: 'System + Email', recipients: 'Public Subscribers, PIO' },
  ];

  const advanceQueue = (id: string) => {
    setRoutingQueue((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) return entry;
        const idx = statusFlow.indexOf(entry.status);
        if (idx < 0 || idx === statusFlow.length - 1) return entry;
        return { ...entry, status: statusFlow[idx + 1] };
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Transaction Operations</h1>
          <p className="text-sm text-text-muted">Processing queue for routing, agenda preparation, committee action, and transmittals.</p>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary-light">
          <CalendarIcon className="mr-2 h-4 w-4" />
          Create Transaction
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {routingQueue.map((entry) => (
          <div key={entry.id} className="border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-text-muted">{entry.id}</div>
                <div className="text-sm font-semibold">{entry.item}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase">{entry.status}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  onClick={() => advanceQueue(entry.id)}
                  disabled={entry.status === 'Completed'}
                >
                  Advance
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border border-border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-primary">Assessment and Evaluation Queue</h3>
          <div className="mt-3 space-y-2">
            {assessmentQueue.map((item) => (
              <div key={item.refNo} className="rounded border border-border px-3 py-2 text-xs">
                <div className="font-semibold">{item.refNo} - {item.applicant}</div>
                <div className="text-text-muted">Compliance: {item.compliance} | Status: {item.evaluation}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-primary">Approval and Issuance Queue</h3>
          <div className="mt-3 space-y-2">
            {approvalQueue.map((item) => (
              <div key={item.docNo} className="rounded border border-border px-3 py-2 text-xs">
                <div className="font-semibold">{item.docNo} - {item.title}</div>
                <div className="text-text-muted">Stage: {item.stage} | Action: {item.action}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border border-border bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-primary">Notifications and Alerts Matrix</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {notificationMatrix.map((item) => (
            <div key={item.event} className="rounded border border-border px-3 py-2 text-xs">
              <div className="font-semibold">{item.event}</div>
              <div className="text-text-muted">Channel: {item.channel}</div>
              <div className="text-text-muted">Recipients: {item.recipients}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6">
        {mockSessions.map((session) => (
          <Card key={session.id} className="border border-border shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 group">
            <div className="flex flex-col md:flex-row">
              <div className="bg-primary/5 p-8 flex flex-col items-center justify-center md:w-40 border-b md:border-b-0 md:border-r border-border group-hover:bg-primary/10 transition-colors">
                <span className="text-sm font-bold text-primary uppercase tracking-wider">{new Date(session.date).toLocaleString('default', { month: 'short' })}</span>
                <span className="text-4xl font-black text-primary my-1">{session.date.split('-')[2]}</span>
                <span className="text-xs font-semibold text-text-muted">{session.date.split('-')[0]}</span>
              </div>
              <div className="flex-1 p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px] font-bold uppercase border-none",
                          session.type === 'Regular' ? "bg-success/10 text-success" : 
                          session.type === 'Special' ? "bg-secondary/10 text-secondary" : 
                          "bg-primary/10 text-primary"
                        )}
                      >
                        {session.type}
                      </Badge>
                      <span className="text-[11px] font-mono text-text-muted">REF: {session.id.toUpperCase()}</span>
                    </div>
                    <CardTitle className="text-xl text-primary font-bold">{session.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="border-border text-text-muted hover:text-primary hover:border-primary">
                      <FileText className="mr-2 h-3.5 w-3.5" />
                      View Agenda
                    </Button>
                    <Button variant="outline" size="sm" className="border-border text-text-muted hover:text-primary hover:border-primary">
                      <Video className="mr-2 h-3.5 w-3.5" />
                      Join Stream
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 pt-6 border-t border-border">
                  <div className="flex items-center gap-3 text-[13px] text-text-muted">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-primary">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-text-main">Time</div>
                      <div>{session.time}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[13px] text-text-muted">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-primary">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-text-main">Location</div>
                      <div>{session.location}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[13px] text-text-muted">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-primary">
                      <Users2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-text-main">Attendance</div>
                      <div>Open to Public</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
