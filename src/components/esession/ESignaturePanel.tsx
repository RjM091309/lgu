import { useRef, useState } from 'react';
import { Check, FileSignature, Lock, PenLine, Printer, ShieldCheck, UserX, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { mockMembers, type Member } from '@/lib/mock-data';
import { escapeHtml, openPrintWindow } from '@/lib/files';
import { logActivity } from '@/lib/activity-log';
import { isPresent, lockDocument, presentMembers, signDocument, signableDocuments, signaturesFor, useESignatures } from '@/lib/esignatures';
import { SignaturePad, type SignaturePadHandle } from '@/components/esession/SignaturePad';

export function ESignaturePanel() {
  const all = useESignatures();
  const [selectedId, setSelectedId] = useState(() => signableDocuments.find((doc) => !signaturesFor(all, doc.id).lockedAt)?.id ?? signableDocuments[0]?.id);
  const [signer, setSigner] = useState<Member | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const padRef = useRef<SignaturePadHandle | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);

  // On narrow screens the document detail sits below the list, so bring it into view.
  const selectDocument = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 1279px)').matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const doc = signableDocuments.find((d) => d.id === selectedId) ?? signableDocuments[0];
  const record = signaturesFor(all, doc.id);
  const signedCount = presentMembers.filter((m) => record.signatures[m.id]).length;
  const complete = signedCount === presentMembers.length;
  const locked = Boolean(record.lockedAt);
  const lockedCount = signableDocuments.filter((d) => signaturesFor(all, d.id).lockedAt).length;
  const docStatus = (id: string) => {
    const r = signaturesFor(all, id);
    const count = presentMembers.filter((m) => r.signatures[m.id]).length;
    if (r.lockedAt) return { label: 'Locked', count, tone: 'bg-green-50 text-green-800 ring-green-200' };
    if (count === presentMembers.length) return { label: 'Ready to lock', count, tone: 'bg-primary/[0.07] text-primary ring-primary/15' };
    if (count > 0) return { label: 'In progress', count, tone: 'bg-amber-50 text-amber-800 ring-amber-200' };
    return { label: 'Not started', count, tone: 'bg-muted text-text-muted ring-border' };
  };

  const openSigner = (member: Member) => {
    setSigner(member);
    setHasInk(false);
    setConfirmed(false);
  };

  const applySignature = () => {
    if (!signer || !hasInk || !confirmed) return;
    const image = padRef.current?.toDataURL() ?? '';
    if (!signDocument(doc.id, signer.id, image)) {
      toast('Not signed', `${signer.name} cannot sign this document.`, 'error');
      return;
    }
    toast('Signature applied', `${signer.name} signed ${doc.number}.`);
    logActivity({ module: 'E-Session', action: 'Signed', summary: `Recorded the electronic signature of ${signer.name}`, detail: doc.number });
    setSigner(null);
  };

  const finalize = async () => {
    if (!complete) {
      toast('Signatures incomplete', `${presentMembers.length - signedCount} member(s) present have not signed yet.`, 'error');
      return;
    }
    const ok = await confirmAction({
      title: 'Finalize and lock this document?',
      description: `${doc.number} will be locked with ${signedCount} signatures. No further signatures can be added or changed.`,
      confirmLabel: 'Finalize and lock',
    });
    if (!ok) return;
    const code = lockDocument(doc.id);
    toast('Document locked', `${doc.number} is final. Verification code ${code}.`);
    logActivity({ module: 'E-Session', action: 'Approved', summary: `Finalized and locked the signatures on ${doc.number}`, detail: `Verification code ${code}` });
  };

  const printSheet = () => {
    const rows = mockMembers
      .map((member) => {
        const signature = record.signatures[member.id];
        const status = !isPresent(member.id) ? 'Absent' : signature ? 'Signed' : 'Pending';
        return `<tr><td>${escapeHtml(member.name)}</td><td>${escapeHtml(member.position)}</td><td>${status}</td><td>${signature ? escapeHtml(signature.signedAt) : ''}</td><td style="height:48px">${
          signature ? `<img src="${signature.image}" alt="" style="height:40px;max-width:180px" />` : ''
        }</td></tr>`;
      })
      .join('');
    const opened = openPrintWindow(
      `${doc.number} Signature Sheet`,
      `<div class="title">${escapeHtml(doc.number)}: ${escapeHtml(doc.title)}</div>
       <div class="rows">Status: ${locked ? `Locked ${escapeHtml(record.lockedAt!)} · Verification code ${escapeHtml(record.verificationCode ?? '')}` : `Not yet finalized (${signedCount} of ${presentMembers.length} signed)`}</div>
       <table><thead><tr><th>Member</th><th>Position</th><th>Status</th><th>Signed</th><th>Signature</th></tr></thead><tbody>${rows}</tbody></table>`
    );
    if (!opened) toast('Could not open print view', 'Allow pop-ups for this site and try again.', 'error');
  };

  const steps = [
    { title: 'Attendance validated', detail: `${presentMembers.length} of ${mockMembers.length} present`, done: true },
    { title: 'Members sign', detail: `${signedCount} of ${presentMembers.length} signed`, done: complete },
    { title: 'Secretary locks', detail: locked ? `Locked ${record.lockedAt}` : 'Finalize once all have signed', done: locked },
  ];

  const stats = [
    { label: 'For signature', value: String(signableDocuments.length), icon: FileSignature, hint: 'Passed and enacted measures' },
    { label: 'Finalized', value: `${lockedCount}/${signableDocuments.length}`, icon: Lock, progress: lockedCount / signableDocuments.length },
    { label: 'Signed on this document', value: `${signedCount}/${presentMembers.length}`, icon: PenLine, progress: signedCount / presentMembers.length },
    { label: 'Members present', value: `${presentMembers.length}/${mockMembers.length}`, icon: Users, hint: 'Only present members can sign' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Electronic Signature</h1>
          <p className="text-sm text-text-muted">Collect the signatures of members present on approved measures, then finalize and lock them.</p>
        </div>
        <Button variant="outline" onClick={printSheet} className="bg-white">
          <Printer className="mr-2 h-4 w-4" />
          Print signature sheet
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-text-muted">{stat.label}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                <stat.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-text-main">{stat.value}</p>
            {stat.progress !== undefined ? (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.round(stat.progress * 100)}%` }} />
              </div>
            ) : null}
            {stat.hint ? <p className="mt-2 text-xs text-text-muted">{stat.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[340px_1fr]">
        {/* Documents */}
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-text-main">Documents</h2>
            <p className="text-xs text-text-muted">Select a measure to collect signatures</p>
          </header>
          <ul className="divide-y divide-border">
            {signableDocuments.map((d) => {
              const status = docStatus(d.id);
              const active = d.id === doc.id;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => selectDocument(d.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn('relative w-full px-5 py-4 text-left transition-colors', active ? 'bg-primary/[0.04]' : 'hover:bg-muted/50')}
                  >
                    {active ? <span className="absolute inset-y-3 left-0 w-1 rounded-r bg-primary" aria-hidden /> : null}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-primary">{d.number}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', status.tone)}>{status.label}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-medium text-text-main">{d.title}</p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', status.label === 'Locked' ? 'bg-green-600' : 'bg-primary')}
                          style={{ width: `${Math.round((status.count / presentMembers.length) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-text-muted">
                        {status.count}/{presentMembers.length}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Selected document */}
        <section ref={detailRef} className="scroll-mt-4 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <header className="flex flex-col gap-4 border-b border-border px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-primary">{doc.number}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-text-muted">{doc.classification ?? 'Ordinance'}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', docStatus(doc.id).tone)}>{docStatus(doc.id).label}</span>
              </div>
              <h2 className="mt-1.5 text-lg font-bold leading-snug text-text-main">{doc.title}</h2>
              <p className="mt-1 text-xs text-text-muted">{doc.actionTaken}</p>
            </div>
            {locked ? (
              <div className="shrink-0 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-xs text-green-900">
                <p className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  Locked {record.lockedAt}
                </p>
                <p className="mt-0.5 font-mono">{record.verificationCode}</p>
              </div>
            ) : (
              <Button onClick={finalize} disabled={!complete} className="shrink-0" title={complete ? undefined : 'All members present must sign first'}>
                <Lock className="mr-2 h-4 w-4" />
                Finalize and lock
              </Button>
            )}
          </header>

          {/* Workflow */}
          <ol className="grid gap-3 border-b border-border bg-muted/30 px-5 py-4 sm:grid-cols-3">
            {steps.map((step, index) => {
              const active = !step.done && steps.slice(0, index).every((s) => s.done);
              return (
                <li key={step.title} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      step.done ? 'bg-green-600 text-white' : active ? 'bg-primary text-white ring-4 ring-primary/15' : 'bg-white text-text-muted ring-1 ring-border'
                    )}
                  >
                    {step.done ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={cn('text-sm font-semibold', step.done || active ? 'text-text-main' : 'text-text-muted')}>{step.title}</p>
                    <p className="truncate text-xs text-text-muted">{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Signers */}
          <div className="grid gap-3 p-5 sm:grid-cols-2 2xl:grid-cols-3">
            {mockMembers.map((member) => {
              const signature = record.signatures[member.id];
              const present = isPresent(member.id);
              return (
                <article
                  key={member.id}
                  className={cn(
                    'flex flex-col rounded-lg border p-4',
                    signature ? 'border-green-200 bg-green-50/30' : present ? 'border-border bg-white' : 'border-dashed border-border bg-muted/40'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        present ? 'bg-gradient-to-br from-[#1a237e] to-[#0d1452] text-white ring-2 ring-[#d4a72c]/70' : 'bg-muted text-text-muted'
                      )}
                    >
                      {member.abbr}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-main">{member.name}</p>
                      <p className="truncate text-xs text-text-muted">{member.seat === 'Presiding Officer' ? 'Presiding Officer' : member.role}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex h-14 items-center justify-center rounded-md border border-border bg-white">
                    {signature ? (
                      <img src={signature.image} alt={`Signature of ${member.name}`} className="max-h-12 max-w-[85%] object-contain" />
                    ) : present ? (
                      <span className="text-xs text-text-muted">Awaiting signature</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                        <UserX className="h-3.5 w-3.5" />
                        Absent, not eligible
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex min-h-8 items-center justify-between gap-2">
                    {signature ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
                        <Check className="h-3.5 w-3.5" />
                        Signed {signature.signedAt}
                      </span>
                    ) : present ? (
                      <>
                        <span className="text-xs text-text-muted">Present</span>
                        {locked ? null : (
                          <Button size="sm" variant="outline" className="h-8" onClick={() => openSigner(member)}>
                            <PenLine className="mr-1.5 h-4 w-4" />
                            Sign
                          </Button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-text-muted">Absent</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {/* Signature capture */}
      <Dialog open={signer !== null} onOpenChange={(open) => !open && setSigner(null)}>
        <DialogContent className="max-w-xl" closeOnOverlayClick={false}>
          {signer ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl text-primary">Sign {doc.number}</DialogTitle>
                <DialogDescription>
                  Signing as <span className="font-semibold text-text-main">{signer.name}</span> · {signer.position}
                </DialogDescription>
              </DialogHeader>
              <p className="mt-3 line-clamp-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-text-main">{doc.title}</p>
              <div className="mt-4">
                <SignaturePad key={signer.id} ref={padRef} onChange={setHasInk} label={`Signature pad for ${signer.name}`} />
                <div className="mt-2 flex justify-end">
                  <button type="button" onClick={() => padRef.current?.clear()} disabled={!hasInk} className="text-xs font-semibold text-primary hover:underline disabled:opacity-40">
                    Clear
                  </button>
                </div>
              </div>
              <label className="mt-2 flex items-start gap-2 text-sm text-text-main">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                <span>
                  I confirm that I am the {signer.position.toLowerCase()} named above and I sign this document. A signature cannot be withdrawn once applied.
                </span>
              </label>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSigner(null)}>
                  Cancel
                </Button>
                <Button onClick={applySignature} disabled={!hasInk || !confirmed}>
                  <PenLine className="mr-2 h-4 w-4" />
                  Apply signature
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
