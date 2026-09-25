import { useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Database, Download, HardDrive, KeyRound, Mail, MonitorSmartphone, RotateCcw, Save, ShieldCheck, Timer, Waves, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { logActivity, useActivityLog } from '@/lib/activity-log';
import { saveSecuritySettings, useSecuritySettings, type SecuritySettings } from '@/lib/access-store';
import { mockSessionDevices } from '@/lib/mock-data';
import { saveCsv } from '@/lib/files';
import { cn } from '@/lib/utils';

// Each safeguard adds its weight to the security score when it is in place.
const CHECK_GROUPS = ['Sign-in & MFA', 'Sessions & passwords', 'Backups & records'] as const;

const CHECKS: { label: string; group: (typeof CHECK_GROUPS)[number]; weight: number; passes: (s: SecuritySettings) => boolean; fix: Partial<SecuritySettings> }[] = [
  { label: 'MFA required for administrators', group: 'Sign-in & MFA', weight: 20, passes: (s) => s.requireMfaForAdmins, fix: { requireMfaForAdmins: true } },
  { label: 'Authenticator app allowed for MFA', group: 'Sign-in & MFA', weight: 10, passes: (s) => s.mfaApp, fix: { mfaApp: true } },
  { label: 'Lockout after 5 failed attempts or fewer', group: 'Sign-in & MFA', weight: 10, passes: (s) => s.lockoutAttempts <= 5, fix: { lockoutAttempts: 5 } },
  { label: 'Session timeout of 30 minutes or less', group: 'Sessions & passwords', weight: 15, passes: (s) => s.sessionTimeout <= 30, fix: { sessionTimeout: 30 } },
  { label: 'Passwords of at least 12 characters', group: 'Sessions & passwords', weight: 15, passes: (s) => s.passwordMinLength >= 12, fix: { passwordMinLength: 12 } },
  { label: 'Passwords require a symbol', group: 'Sessions & passwords', weight: 10, passes: (s) => s.requireSymbols, fix: { requireSymbols: true } },
  { label: 'Daily automatic backup', group: 'Backups & records', weight: 10, passes: (s) => s.dailyBackup, fix: { dailyBackup: true } },
  { label: 'Audit records kept for a year or more', group: 'Backups & records', weight: 10, passes: (s) => s.auditRetentionDays >= 365, fix: { auditRetentionDays: 365 } },
];

// Half-circle gauge geometry (viewBox 0 0 220 124).
const GAUGE_R = 90;
const gaugePoint = (fraction: number) => {
  const angle = Math.PI * (1 - fraction);
  return { x: 110 + GAUGE_R * Math.cos(angle), y: 112 - GAUGE_R * Math.sin(angle) };
};
const gaugeArc = (from: number, to: number) => {
  const start = gaugePoint(from);
  const end = gaugePoint(to);
  return `M ${start.x} ${start.y} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${end.x} ${end.y}`;
};

const formatStamp = (timestamp: string) => {
  const [hour, minute] = timestamp.slice(11, 16).split(':').map(Number);
  const date = new Date(`${timestamp.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  return `${date}, ${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
};

function Segmented<T extends number>({ value, options, onChange, format }: { value: T; options: T[]; onChange: (value: T) => void; format: (value: T) => string }) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn('rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors', value === option ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main')}
        >
          {format(option)}
        </button>
      ))}
    </div>
  );
}

function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-text-main">{title}</div>
        <div className="text-xs text-text-muted">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function ControlPanelPage({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const saved = useSecuritySettings();
  const [draft, setDraft] = useState(saved);
  const activity = useActivityLog();

  const set = <K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) => setDraft((prev) => ({ ...prev, [key]: value }));
  const dirty = (Object.keys(saved) as (keyof SecuritySettings)[]).some((key) => saved[key] !== draft[key]);

  const score = CHECKS.reduce((sum, check) => sum + (check.passes(draft) ? check.weight : 0), 0);
  const savedScore = CHECKS.reduce((sum, check) => sum + (check.passes(saved) ? check.weight : 0), 0);
  const grade =
    score >= 90
      ? { label: 'Strong', chip: 'bg-emerald-400/15 text-emerald-200', arc: '#4ade80' }
      : score >= 70
        ? { label: 'Fair', chip: 'bg-amber-400/15 text-amber-200', arc: '#fbbf24' }
        : { label: 'Weak', chip: 'bg-rose-400/15 text-rose-200', arc: '#f87171' };
  const failing = CHECKS.filter((check) => !check.passes(draft));
  const applyFixes = (checks: typeof CHECKS) => setDraft((prev) => checks.reduce((next, check) => ({ ...next, ...check.fix }), prev));

  const disconnected = mockSessionDevices.filter((device) => device.status !== 'Connected');
  const services = [
    { name: 'Web portal', detail: 'Public site and staff portal', icon: Globe, ok: true },
    { name: 'Database', detail: 'Legislative records', icon: Database, ok: true },
    { name: 'Document storage', detail: 'Session files and attachments', icon: HardDrive, ok: true },
    { name: 'Speech-to-text', detail: 'Transcripts of recordings', icon: Waves, ok: true },
    { name: 'Email notifications', detail: 'Activation and reset links', icon: Mail, ok: true },
    {
      name: 'Session device sync',
      detail: disconnected.length > 0 ? `${disconnected.length} device${disconnected.length === 1 ? '' : 's'} not connected` : 'All devices connected',
      icon: MonitorSmartphone,
      ok: disconnected.length === 0,
      tab: 'esig-platform',
    },
  ];

  const securityEvents = activity.filter((entry) => entry.module === 'Authentication' || entry.module === 'Administration').slice(0, 6);

  const save = async () => {
    if (!Number.isInteger(draft.sessionTimeout) || draft.sessionTimeout < 5) {
      toast('Settings not saved', 'Session timeout must be at least 5 minutes.', 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Save security settings?',
      description: `The security score changes from ${savedScore} to ${score}. Users are signed out after ${draft.sessionTimeout} minutes of inactivity.`,
      confirmLabel: 'Save settings',
    });
    if (!confirmed) return;
    saveSecuritySettings(draft);
    toast('Security settings saved', `Security score: ${score}/100.`);
    logActivity({ module: 'Administration', action: 'Updated', summary: 'Saved security settings', detail: `Session timeout: ${draft.sessionTimeout} minutes · score ${score}/100.` });
  };

  const runBackup = async () => {
    const confirmed = await confirmAction({ title: 'Run a backup now?', description: 'A full backup of records and session files starts immediately.', confirmLabel: 'Run backup' });
    if (!confirmed) return;
    const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .format(new Date())
      .replace(', ', 'T');
    // Record the backup without touching settings still being edited.
    saveSecuritySettings({ ...saved, lastBackup: now });
    setDraft((prev) => ({ ...prev, lastBackup: now }));
    toast('Backup completed', 'Records and session files were backed up.');
    logActivity({ module: 'Administration', action: 'Exported', summary: 'Ran a manual backup', detail: 'Records and session files.' });
  };

  const exportEvents = () => {
    const ok = saveCsv('sb-capas-security-events.csv', ['Time', 'User', 'Module', 'Action', 'Summary'], securityEvents.map((entry) => [entry.timestamp.replace('T', ' '), entry.user, entry.module, entry.action, entry.summary]));
    if (!ok) {
      toast('Export failed', 'The CSV file could not be created. Please try again.', 'error');
      return;
    }
    toast('Security events exported');
    logActivity({ module: 'Administration', action: 'Exported', summary: 'Exported security events' });
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Control Panel</h1>
          <p className="text-sm text-text-muted">Security policies, backups, and the health of system services.</p>
        </div>
        <Button onClick={save} disabled={!dirty}>
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Security score: sticks while the settings beside it scroll. */}
        <section className="self-start overflow-hidden rounded-xl border border-border bg-white shadow-sm xl:sticky xl:top-4">
          <div className="relative bg-gradient-to-br from-[#1a237e] via-[#16207a] to-[#0d1452] px-5 pb-5 pt-4 text-white">
            <span className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/[0.06]" aria-hidden />
            <div className="relative flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8c766]">Security Score</h2>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', grade.chip)}>{grade.label}</span>
            </div>

            <div className="relative mx-auto mt-2 w-full max-w-[260px]">
              <svg viewBox="0 0 220 124" className="w-full" role="img" aria-label={`Security score ${score} of 100, ${grade.label}`}>
                {/* Zones: weak below 70, fair to 90, strong above. */}
                <path d={gaugeArc(0, 0.7)} fill="none" stroke="rgba(248,113,113,0.28)" strokeWidth="14" />
                <path d={gaugeArc(0.7, 0.9)} fill="none" stroke="rgba(251,191,36,0.28)" strokeWidth="14" />
                <path d={gaugeArc(0.9, 1)} fill="none" stroke="rgba(74,222,128,0.28)" strokeWidth="14" />
                {score > 0 ? (
                  <path
                    d={gaugeArc(0, score / 100)}
                    fill="none"
                    stroke={grade.arc}
                    strokeWidth="14"
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                ) : null}
                {[0.7, 0.9].map((mark) => {
                  const inner = { x: 110 + (GAUGE_R - 12) * Math.cos(Math.PI * (1 - mark)), y: 112 - (GAUGE_R - 12) * Math.sin(Math.PI * (1 - mark)) };
                  const label = { x: 110 + (GAUGE_R - 24) * Math.cos(Math.PI * (1 - mark)), y: 112 - (GAUGE_R - 24) * Math.sin(Math.PI * (1 - mark)) };
                  const outer = gaugePoint(mark);
                  return (
                    <g key={mark}>
                      <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
                      <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" className="fill-white/60 text-[9px] font-semibold">
                        {mark * 100}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className="absolute inset-x-0 bottom-0 text-center">
                <div className="text-5xl font-bold leading-none tabular-nums">{score}</div>
                <div className="mt-1 text-[11px] text-white/65">out of 100</div>
              </div>
            </div>

            <div className="relative mt-4 flex items-center justify-between text-[11px] text-white/70">
              <span>
                <b className="text-white">{CHECKS.length - failing.length}</b> of {CHECKS.length} safeguards in place
              </span>
              {dirty ? (
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold text-white">
                  Saved {savedScore} → {score}
                </span>
              ) : (
                <span>All changes saved</span>
              )}
            </div>
          </div>

          <div className="divide-y divide-border">
            {CHECK_GROUPS.map((group) => {
              const checks = CHECKS.filter((check) => check.group === group);
              const possible = checks.reduce((sum, check) => sum + check.weight, 0);
              const earned = checks.reduce((sum, check) => sum + (check.passes(draft) ? check.weight : 0), 0);
              return (
                <div key={group} className="px-5 py-3.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {group}
                    <span className="tabular-nums text-text-main">
                      {earned}/{possible}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-[#eef0f4]">
                    <div
                      className={cn('h-full rounded-full transition-[width] duration-500', earned === possible ? 'bg-green-500' : 'bg-amber-500')}
                      style={{ width: `${(earned / possible) * 100}%` }}
                    />
                  </div>
                  <ul className="mt-2.5 space-y-1.5">
                    {checks.map((check) => {
                      const ok = check.passes(draft);
                      return (
                        <li key={check.label} className="flex items-center gap-2 text-[12px]">
                          {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <Circle className="h-4 w-4 shrink-0 text-amber-500" />}
                          <span className={cn('min-w-0 flex-1', ok ? 'text-text-main' : 'font-medium text-text-main')}>{check.label}</span>
                          {ok ? (
                            <span className="text-[11px] tabular-nums text-text-muted">+{check.weight}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => applyFixes([check])}
                              className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                            >
                              Fix +{check.weight}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border bg-muted/30 px-5 py-3">
            {failing.length > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-text-muted">
                  {failing.length} safeguard{failing.length === 1 ? '' : 's'} missing · +{failing.reduce((sum, check) => sum + check.weight, 0)} points
                </span>
                <Button size="sm" variant="outline" onClick={() => applyFixes(failing)}>
                  Apply all fixes
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-green-700">
                <ShieldCheck className="h-4 w-4" />
                All recommended safeguards are in place.
              </div>
            )}
          </div>
        </section>

        {/* Settings */}
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm xl:col-span-2">
          <header className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-text-main">
            <KeyRound className="h-3.5 w-3.5" />
            Sign-in &amp; multi-factor authentication
          </header>
          <div className="divide-y divide-border">
            <SettingRow title="Require MFA for administrators" description="Administrator accounts must confirm every sign-in with a second factor.">
              <Switch checked={draft.requireMfaForAdmins} onChange={(value) => set('requireMfaForAdmins', value)} label="Require MFA for administrators" />
            </SettingRow>
            <SettingRow title="Allowed second factors" description="Methods staff can use to confirm a sign-in.">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['mfaSms', 'SMS code'],
                    ['mfaApp', 'Authenticator app'],
                    ['mfaToken', 'Security key'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set(key, !draft[key])}
                    aria-pressed={draft[key]}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                      draft[key] ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:text-text-main'
                    )}
                  >
                    {draft[key] ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    {label}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow title="Lock account after failed attempts" description="Temporarily locks an account after repeated wrong passwords.">
              <Segmented value={draft.lockoutAttempts} options={[3, 5, 10]} onChange={(value) => set('lockoutAttempts', value)} format={(value) => `${value} tries`} />
            </SettingRow>
          </div>

          <header className="flex items-center gap-2 border-y border-border bg-muted/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-text-main">
            <Timer className="h-3.5 w-3.5" />
            Sessions &amp; passwords
          </header>
          <div className="divide-y divide-border">
            <SettingRow title="Session timeout" description="Signs users out after this much inactivity.">
              <Segmented value={draft.sessionTimeout} options={[15, 30, 60, 120]} onChange={(value) => set('sessionTimeout', value)} format={(value) => `${value} min`} />
            </SettingRow>
            <SettingRow title="Minimum password length" description="Longer passwords are harder to guess.">
              <Segmented value={draft.passwordMinLength} options={[8, 10, 12, 16]} onChange={(value) => set('passwordMinLength', value)} format={(value) => `${value}`} />
            </SettingRow>
            <SettingRow title="Require a symbol" description="Passwords must include at least one symbol, such as ! or #.">
              <Switch checked={draft.requireSymbols} onChange={(value) => set('requireSymbols', value)} label="Require a symbol" />
            </SettingRow>
          </div>

          <header className="flex items-center gap-2 border-y border-border bg-muted/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-text-main">
            <ShieldCheck className="h-3.5 w-3.5" />
            Backups &amp; records
          </header>
          <div className="divide-y divide-border">
            <SettingRow title="Daily automatic backup" description={`Last backup: ${formatStamp(saved.lastBackup)}`}>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={runBackup}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Back up now
                </Button>
                <Switch checked={draft.dailyBackup} onChange={(value) => set('dailyBackup', value)} label="Daily automatic backup" />
              </div>
            </SettingRow>
            <SettingRow title="Keep audit records for" description="How long the activity log is retained before archiving.">
              <Segmented value={draft.auditRetentionDays} options={[90, 180, 365, 1825]} onChange={(value) => set('auditRetentionDays', value)} format={(value) => (value >= 365 ? `${value / 365} yr${value > 365 ? 's' : ''}` : `${value} days`)} />
            </SettingRow>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Service health */}
        <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-main">System Health</h2>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', services.every((service) => service.ok) ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
              {services.filter((service) => service.ok).length}/{services.length} operational
            </span>
          </div>
          <ul className="mt-4 space-y-2">
            {services.map((service) => (
              <li key={service.name}>
                <button
                  type="button"
                  onClick={service.tab ? () => onNavigate(service.tab!) : undefined}
                  className={cn('flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left', service.tab ? 'hover:border-primary/40' : 'cursor-default')}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-text-muted">
                    <service.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-text-main">{service.name}</span>
                    <span className="block text-[11px] text-text-muted">{service.detail}</span>
                  </span>
                  <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold', service.ok ? 'text-green-700' : 'text-amber-700')}>
                    <span className="relative flex h-2 w-2">
                      {service.ok ? null : <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />}
                      <span className={cn('relative inline-flex h-2 w-2 rounded-full', service.ok ? 'bg-green-500' : 'bg-amber-500')} />
                    </span>
                    {service.ok ? 'Operational' : 'Degraded'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Security events */}
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm xl:col-span-2">
          <header className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-text-main">Security Events</h2>
              <p className="text-xs text-text-muted">Latest sign-ins and administration changes from the Activity Log</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportEvents}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => onNavigate('activity-log')}>
                Open Activity Log
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </header>
          <ol className="divide-y divide-border">
            {securityEvents.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-5 py-3">
                <span
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                    entry.module === 'Authentication' ? 'bg-blue-50 text-blue-700' : entry.action === 'Deleted' ? 'bg-red-50 text-red-700' : 'bg-violet-50 text-violet-700'
                  )}
                >
                  {entry.module === 'Authentication' ? <KeyRound className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] leading-snug text-text-main">{entry.summary}</div>
                  <div className="mt-0.5 text-[11px] text-text-muted">
                    <span className="rounded bg-[#f3f4f7] px-1.5 py-px font-mono">{entry.user}</span> · {entry.action}
                    {entry.detail ? ` · ${entry.detail}` : ''}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-text-muted">{formatStamp(entry.timestamp)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {dirty ? (
        <div className="sticky bottom-4 z-10 mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-xl bg-[#0f1650] px-5 py-3 text-white shadow-2xl">
          <span className="text-sm">
            Unsaved security settings · score <b>{savedScore}</b> → <b>{score}</b>
          </span>
          <span className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => setDraft(saved)}>
              Discard
            </Button>
            <Button size="sm" className="bg-white text-primary hover:bg-white/90" onClick={save}>
              Save settings
            </Button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
