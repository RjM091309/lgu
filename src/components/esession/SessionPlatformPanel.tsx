import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Check,
  Clock,
  FolderOpen,
  Laptop,
  ListChecks,
  MapPin,
  MonitorSmartphone,
  Play,
  Radio,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
  Square,
  Tablet,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { mockMembers, mockSessionDevices, mockSessions, type SessionDevice } from '@/lib/mock-data';
import { buildAgenda, formatLongDate } from '@/lib/sessions';
import { useSessionFiles } from '@/lib/session-files';
import { logActivity } from '@/lib/activity-log';
import { useAccess } from '@/lib/access-store';
import { nowInManila, sendAnnouncement, useMobileDevices, type MobileDevice } from '@/lib/esession-sync';
import { MobileAppDialog } from '@/components/esession/MobileAppDialog';

interface PlatformDevice extends SessionDevice {
  agendaSynced: boolean;
}

interface FeedEntry {
  id: number;
  time: string;
  text: string;
  tone: 'info' | 'success' | 'warning' | 'live';
}

const STATUS_STYLE: Record<SessionDevice['status'], { pill: string; dot: string; label: string }> = {
  Connected: { pill: 'bg-green-50 text-green-800 ring-green-200', dot: 'bg-green-500', label: 'Connected' },
  Pending: { pill: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500', label: 'Awaiting approval' },
  Disconnected: { pill: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500', label: 'Offline' },
};

const FEED_DOT: Record<FeedEntry['tone'], string> = {
  info: 'bg-slate-400',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  live: 'bg-red-500',
};

const nowLabel = () => new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

const formatElapsed = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
};

const clockOf = (ms: number) => new Date(ms).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
const phoneLabel = (phone: MobileDevice) => (phone.account ? `${phone.account.name}'s phone (${phone.model})` : `A phone (${phone.model})`);

const DeviceIcon = ({ type, className }: { type: string; className?: string }) =>
  type === 'Laptop' ? <Laptop className={className} /> : type === 'Tablet' || type === 'iPad' ? <Tablet className={className} /> : <MonitorSmartphone className={className} />;

export function SessionPlatformPanel() {
  const session = mockSessions[0];
  const agendaItems = buildAgenda(session);
  const sessionFiles = useSessionFiles();

  // Everyone except one sample absentee is present; quorum is a majority of all members.
  const presentCount = mockMembers.length - 1;
  const quorum = Math.floor(mockMembers.length / 2) + 1;
  const hasQuorum = presentCount >= quorum;

  const [devices, setDevices] = useState<PlatformDevice[]>(() =>
    mockSessionDevices.map((device) => ({ ...device, agendaSynced: device.status === 'Connected' && device.type !== 'iPad' }))
  );
  const [liveSince, setLiveSince] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState('');
  const [feed, setFeed] = useState<FeedEntry[]>(() => [
    { id: 3, time: '10:12 AM', text: 'Session Hall Tablet A synced the order of business.', tone: 'success' },
    { id: 2, time: '09:58 AM', text: 'Secretary Console requested to join the session.', tone: 'warning' },
    { id: 1, time: '09:41 AM', text: 'Session Hall Tablet B lost connection.', tone: 'warning' },
  ]);

  const isLive = liveSince !== null;
  const { user } = useAccess();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Phones running LIMS Mobile (Android app or browser) that connected to this server.
  const phones = useMobileDevices();
  const phonesOnline = phones.filter((phone) => phone.online);

  // Tell the Secretariat as phones connect, sign in, and drop off (not for the list already there on load).
  const knownPhones = useRef<Map<string, MobileDevice> | null>(null);
  useEffect(() => {
    const previous = knownPhones.current;
    knownPhones.current = new Map(phones.map((phone) => [phone.id, phone]));
    if (!previous) return;
    phones.forEach((phone) => {
      const before = previous.get(phone.id);
      const where = phone.platform === 'app' ? 'Android app' : 'browser';
      if (phone.online && (!before || !before.online)) {
        addFeed(`${phoneLabel(phone)} connected through the ${where}.`, 'success');
        toast('Phone connected', `${phone.model} · ${phone.account?.name ?? 'not signed in yet'}`, 'info');
      } else if (!phone.online && before?.online) {
        addFeed(`${phoneLabel(phone)} went offline.`, 'warning');
      } else if (phone.online && phone.account && before?.account?.inviteeId !== phone.account.inviteeId) {
        addFeed(`${phone.account.name} signed in on ${phone.model}.`, 'info');
      }
    });
  }, [phones]);

  useEffect(() => {
    if (liveSince === null) return;
    const tick = () => setElapsed(Date.now() - liveSince);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [liveSince]);

  const connected = devices.filter((d) => d.status === 'Connected');
  const pending = devices.filter((d) => d.status === 'Pending');
  const offline = devices.filter((d) => d.status === 'Disconnected');
  const synced = connected.filter((d) => d.agendaSynced);
  const allSynced = connected.length > 0 && synced.length === connected.length;
  // Phones read the order of business live from LIMS, so a connected phone is always up to date.
  const connectedCount = connected.length + phonesOnline.length;
  const deviceCount = devices.length + phones.length;
  const syncedCount = synced.length + phonesOnline.length;

  const addFeed = (text: string, tone: FeedEntry['tone']) =>
    setFeed((current) => [{ id: (current[0]?.id ?? 0) + 1, time: nowLabel(), text, tone }, ...current].slice(0, 12));

  const updateDevice = (name: string, patch: Partial<PlatformDevice>) =>
    setDevices((current) => current.map((d) => (d.name === name ? { ...d, ...patch, lastSync: nowLabel() } : d)));

  const connectDevice = (device: PlatformDevice) => {
    const approving = device.status === 'Pending';
    updateDevice(device.name, { status: 'Connected', agendaSynced: false });
    addFeed(`${device.name} ${approving ? 'was approved and joined' : 'reconnected to'} the session.`, 'success');
    toast(approving ? 'Device approved' : 'Device reconnected', `${device.name} is now connected. Sync the agenda to bring it up to date.`);
    logActivity({ module: 'E-Session', action: approving ? 'Approved' : 'Updated', summary: `${approving ? 'Approved' : 'Reconnected'} session device ${device.name}` });
  };

  const syncDevice = (device: PlatformDevice) => {
    updateDevice(device.name, { agendaSynced: true });
    addFeed(`${device.name} synced the order of business.`, 'success');
    toast('Agenda synced', `${device.name} has the latest order of business.`);
  };

  const syncAll = () => {
    if (!connected.length) {
      toast('Nothing to sync', 'Connect at least one device first.', 'error');
      return;
    }
    const time = nowLabel();
    setDevices((current) => current.map((d) => (d.status === 'Connected' ? { ...d, agendaSynced: true, lastSync: time } : d)));
    addFeed(`Order of business pushed to ${connected.length} connected device${connected.length === 1 ? '' : 's'}.`, 'success');
    toast('Agenda synced', `${connected.length} device${connected.length === 1 ? '' : 's'} now have the latest order of business.`);
    logActivity({ module: 'E-Session', action: 'Published', summary: `Synced the order of business for the ${session.title}`, detail: `${connected.length} devices` });
  };

  const startSession = async () => {
    if (!hasQuorum) {
      toast('Cannot start session', `A quorum of ${quorum} members is required.`, 'error');
      return;
    }
    if (!allSynced) {
      toast('Agenda not synced', 'Sync the order of business to every connected device before going live.', 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Start the live session?',
      description: `The ${session.title} will go live on ${connected.length} connected device${connected.length === 1 ? '' : 's'}. Updates will be pushed to all participants.`,
      confirmLabel: 'Go live',
    });
    if (!confirmed) return;
    setLiveSince(Date.now());
    addFeed(`${session.title} is now live.`, 'live');
    toast('Session is live', `${session.title} started.`);
    logActivity({ module: 'E-Session', action: 'Updated', summary: `Started the live session: ${session.title}` });
  };

  const endSession = async () => {
    const confirmed = await confirmAction({
      title: 'End the live session?',
      description: `Participants will stop receiving live updates. Duration so far: ${formatElapsed(elapsed)}.`,
      confirmLabel: 'End session',
    });
    if (!confirmed) return;
    setLiveSince(null);
    setElapsed(0);
    addFeed(`${session.title} was adjourned.`, 'info');
    toast('Session ended', `${session.title} has been adjourned.`);
    logActivity({ module: 'E-Session', action: 'Updated', summary: `Ended the live session: ${session.title}` });
  };

  const pushNotice = (event: FormEvent) => {
    event.preventDefault();
    const text = notice.trim();
    if (!text) return;
    if (!connectedCount) {
      toast('No devices connected', 'Connect a device before pushing updates.', 'error');
      return;
    }
    // Phones get it as an alert (and a notification in the Android app).
    sendAnnouncement(session.id, text, user.name, nowInManila());
    addFeed(`Update pushed: “${text}”`, isLive ? 'live' : 'info');
    const phoneNote = phonesOnline.length ? `, including ${phonesOnline.length} phone${phonesOnline.length === 1 ? '' : 's'}` : '';
    toast('Update pushed', `Sent to ${connectedCount} connected device${connectedCount === 1 ? '' : 's'}${phoneNote}.`);
    setNotice('');
  };

  const steps = [
    { title: 'Connect devices', detail: `${connectedCount} of ${deviceCount} connected`, done: pending.length === 0 && connected.length > 0 },
    { title: 'Sync agenda', detail: `${syncedCount} of ${connectedCount} devices up to date`, done: allSynced },
    { title: 'Go live', detail: isLive ? `Live for ${formatElapsed(elapsed)}` : 'Push live updates to participants', done: isLive },
  ];
  const currentStep = steps.findIndex((step) => !step.done);

  const stats = [
    {
      label: 'Devices online',
      value: `${connectedCount}/${deviceCount}`,
      icon: Wifi,
      progress: connectedCount / deviceCount,
      hint: phones.length ? `${phonesOnline.length} of ${phones.length} phone${phones.length === 1 ? '' : 's'} online` : undefined,
    },
    { label: 'Agenda synced', value: `${syncedCount}/${connectedCount || 0}`, icon: RefreshCw, progress: connectedCount ? syncedCount / connectedCount : 0 },
    { label: 'Members present', value: `${presentCount}/${mockMembers.length}`, icon: Users, progress: presentCount / mockMembers.length, hint: hasQuorum ? 'Quorum met' : `Quorum is ${quorum}` },
    { label: 'Session files', value: String(sessionFiles.length), icon: FolderOpen, hint: 'Agenda, minutes, recordings' },
  ];

  return (
    <div className="space-y-6">
      <MobileAppDialog open={mobileOpen} onOpenChange={setMobileOpen} />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Session Platform</h1>
          <p className="text-sm text-text-muted">Connect session devices, sync the order of business, and push live updates to participants.</p>
        </div>
        <Button variant="outline" onClick={syncAll} className="bg-white">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync agenda to all
        </Button>
      </div>

      {/* Current session */}
      <section
        className={cn(
          'relative overflow-hidden rounded-xl border p-5 shadow-sm md:p-6',
          isLive ? 'border-red-200 bg-gradient-to-br from-white to-red-50/60' : 'border-border bg-white'
        )}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', isLive ? 'bg-red-600 text-white' : 'bg-primary/[0.07] text-primary')}>
              <Radio className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:hidden" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    Live · {formatElapsed(elapsed)}
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">Standby</span>
                )}
                <span className="rounded-full bg-primary/[0.07] px-2.5 py-0.5 text-[11px] font-semibold text-primary">{session.type}</span>
              </div>
              <h2 className="mt-2 text-lg font-bold text-text-main">{session.title}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatLongDate(session.date)}, {session.time}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {session.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ListChecks className="h-3.5 w-3.5" />
                  {agendaItems.length} agenda items
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold',
                hasQuorum ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'
              )}
            >
              <Users className="h-4 w-4" />
              {hasQuorum ? 'Quorum met' : 'No quorum'} · {presentCount}/{mockMembers.length}
            </span>
            {isLive ? (
              <Button onClick={endSession} className="bg-red-600 hover:bg-red-700 hover:opacity-100">
                <Square className="mr-2 h-4 w-4 fill-current" />
                End session
              </Button>
            ) : (
              <Button onClick={startSession}>
                <Play className="mr-2 h-4 w-4 fill-current" />
                Start live session
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">{stat.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
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

      <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* Devices */}
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <header className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-text-main">Session Devices</h2>
              <p className="text-xs text-text-muted">Tablets, consoles, and members' phones connected to the session</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-800">{connectedCount} connected</span>
              <span className={cn('rounded-full px-2.5 py-1', pending.length ? 'bg-amber-50 text-amber-800' : 'bg-muted text-text-muted')}>{pending.length} pending</span>
              <span className={cn('rounded-full px-2.5 py-1', offline.length + phones.length - phonesOnline.length ? 'bg-red-50 text-red-700' : 'bg-muted text-text-muted')}>
                {offline.length + phones.length - phonesOnline.length} offline
              </span>
              <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => setMobileOpen(true)}>
                <QrCode className="mr-1.5 h-3.5 w-3.5" />
                Connect a phone
              </Button>
            </div>
          </header>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {/* Phones running LIMS Mobile */}
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-text-muted md:col-span-2">
              <Smartphone className="h-3.5 w-3.5" />
              Phones · LIMS Mobile
              <span className="font-semibold normal-case tracking-normal">
                {phonesOnline.length} of {phones.length} online
              </span>
            </p>
            {phones.length === 0 ? (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-left text-xs text-text-muted transition-colors hover:border-primary/40 hover:bg-primary/[0.02] md:col-span-2"
              >
                <QrCode className="h-8 w-8 shrink-0 text-primary/50" />
                <span>
                  <span className="block text-sm font-semibold text-text-main">No phones connected yet</span>
                  Scan the QR code with a phone on the same Wi-Fi (browser or Android app). It appears here as soon as it connects.
                </span>
              </button>
            ) : (
              [...phones]
                .sort((a, b) => Number(b.online) - Number(a.online) || b.connectedAt - a.connectedAt)
                .map((phone) => {
                  const style = STATUS_STYLE[phone.online ? 'Connected' : 'Disconnected'];
                  return (
                    <article
                      key={phone.id}
                      className={cn('flex flex-col rounded-lg border p-4', phone.online ? 'border-border bg-white' : 'border-red-200 bg-red-50/30')}
                    >
                      <div className="flex items-start gap-3">
                        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', phone.online ? 'bg-primary/[0.07] text-primary' : 'bg-muted text-text-muted')}>
                          <Smartphone className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-text-main">{phone.account?.name ?? 'Not signed in yet'}</p>
                          <p className="truncate text-xs text-text-muted">
                            {phone.model}
                            {phone.os ? ` · ${phone.os}` : ''}
                          </p>
                        </div>
                        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', style.pill)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', style.dot, phone.online && 'animate-pulse')} />
                          {style.label}
                        </span>
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md bg-muted/60 px-2.5 py-2">
                          <dt className="text-text-muted">{phone.online ? 'Connected since' : 'Last seen'}</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-text-main">{clockOf(phone.online ? phone.connectedAt : phone.lastSeen)}</dd>
                        </div>
                        <div className="rounded-md bg-muted/60 px-2.5 py-2">
                          <dt className="text-text-muted">Agenda</dt>
                          <dd className={cn('mt-0.5 font-semibold', phone.online ? 'text-green-700' : 'text-text-muted')}>{phone.online ? 'Live' : '—'}</dd>
                        </div>
                      </dl>

                      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/[0.07] px-2 py-0.5 font-semibold text-primary">
                          {phone.platform === 'app' ? 'Android app' : 'Browser'}
                        </span>
                        <span className="truncate text-text-muted">{phone.account ? phone.account.detail : 'Waiting for sign-in'}</span>
                      </div>
                    </article>
                  );
                })
            )}

            <p className="flex items-center gap-2 pt-2 text-[11px] font-bold uppercase tracking-wide text-text-muted md:col-span-2">
              <Tablet className="h-3.5 w-3.5" />
              Session hall devices
            </p>
            {devices.map((device) => {
              const style = STATUS_STYLE[device.status];
              const isConnected = device.status === 'Connected';
              return (
                <article
                  key={device.name}
                  className={cn('flex flex-col rounded-lg border p-4', device.status === 'Disconnected' ? 'border-red-200 bg-red-50/30' : 'border-border bg-white')}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        isConnected ? 'bg-primary/[0.07] text-primary' : 'bg-muted text-text-muted'
                      )}
                    >
                      <DeviceIcon type={device.type} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-main">{device.name}</p>
                      <p className="text-xs text-text-muted">{device.type}</p>
                    </div>
                    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', style.pill)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
                      {style.label}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-muted/60 px-2.5 py-2">
                      <dt className="text-text-muted">Last sync</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-text-main">{device.lastSync}</dd>
                    </div>
                    <div className="rounded-md bg-muted/60 px-2.5 py-2">
                      <dt className="text-text-muted">Agenda</dt>
                      <dd className={cn('mt-0.5 font-semibold', isConnected && device.agendaSynced ? 'text-green-700' : isConnected ? 'text-amber-700' : 'text-text-muted')}>
                        {isConnected ? (device.agendaSynced ? 'Up to date' : 'Needs sync') : '—'}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex justify-end">
                    {device.status === 'Pending' ? (
                      <Button size="sm" className="h-8" onClick={() => connectDevice(device)}>
                        <Check className="mr-1.5 h-4 w-4" />
                        Approve device
                      </Button>
                    ) : device.status === 'Disconnected' ? (
                      <Button size="sm" variant="outline" className="h-8 bg-white" onClick={() => connectDevice(device)}>
                        <WifiOff className="mr-1.5 h-4 w-4" />
                        Reconnect
                      </Button>
                    ) : device.agendaSynced ? (
                      <span className="inline-flex h-8 items-center gap-1.5 text-xs font-semibold text-green-700">
                        <Check className="h-4 w-4" />
                        Ready
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => syncDevice(device)}>
                        <RefreshCw className="mr-1.5 h-4 w-4" />
                        Sync agenda
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div className="space-y-6">
          {/* Workflow */}
          <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-text-main">Session Workflow</h2>
            <p className="text-xs text-text-muted">Complete each step before going live</p>
            <ol className="mt-4 space-y-0">
              {steps.map((step, index) => {
                const active = index === currentStep;
                return (
                  <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
                    {index < steps.length - 1 ? (
                      <span className={cn('absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-px', step.done ? 'bg-green-300' : 'bg-border')} aria-hidden />
                    ) : null}
                    <span
                      className={cn(
                        'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        step.done ? 'bg-green-600 text-white' : active ? 'bg-primary text-white ring-4 ring-primary/15' : 'bg-muted text-text-muted'
                      )}
                    >
                      {step.done ? <Check className="h-4 w-4" /> : index + 1}
                    </span>
                    <div className="pt-0.5">
                      <p className={cn('text-sm font-semibold', step.done || active ? 'text-text-main' : 'text-text-muted')}>{step.title}</p>
                      <p className="text-xs text-text-muted">{step.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Live updates */}
          <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <header className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-text-main">Live Updates</h2>
              <p className="text-xs text-text-muted">Push a notice to every connected device, phones included</p>
            </header>
            <form onSubmit={pushNotice} className="flex gap-2 border-b border-border p-4">
              <label htmlFor="platform-notice" className="sr-only">
                Update to push
              </label>
              <input
                id="platform-notice"
                value={notice}
                onChange={(e) => setNotice(e.target.value)}
                maxLength={200}
                placeholder="e.g. Session resumes in 10 minutes"
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <Button type="submit" size="sm" className="h-9" disabled={!notice.trim()}>
                <Send className="mr-1.5 h-4 w-4" />
                Push
              </Button>
            </form>
            <ul className="max-h-72 divide-y divide-border overflow-y-auto" aria-live="polite">
              {feed.map((entry) => (
                <li key={entry.id} className="flex gap-3 px-5 py-3">
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', FEED_DOT[entry.tone])} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-main">{entry.text}</p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-text-muted">{entry.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
