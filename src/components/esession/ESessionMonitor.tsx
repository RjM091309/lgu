import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Megaphone, QrCode, Send, Smartphone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { logActivity } from '@/lib/activity-log';
import { useAccess } from '@/lib/access-store';
import { useLobby } from '@/lib/esession-room';
import { nowInManila, sendAnnouncement, useCalendarSessions, useESessionState, useMobileDevices, type MobileDevice } from '@/lib/esession-sync';
import { isOfficial } from '@/lib/sessions';
import { todayInManila } from '@/lib/session-files';
import { Card } from '@/components/dashboard/widgets';
import { MobileAppDialog } from '@/components/esession/MobileAppDialog';
import { LiveSessionsList, NextSittingCard } from '@/components/esession/SessionWidgets';
import { useOpenESession } from '@/components/esession/use-open-esession';
import { cn } from '@/lib/utils';

// The Secretariat's view of E-Session from the Staff Portal. E-sessions themselves are started, run and ended in
// the E-Session app (/es); this page shows what is happening there, live and the same on every computer: the
// sittings running now and who is in them, the next sitting and its replies, the phones running LIMS Mobile, and
// notices pushed to those phones.

const clockOf = (ms: number) => new Date(ms).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const phoneLabel = (phone: MobileDevice) => (phone.account ? `${phone.account.name}'s phone (${phone.model})` : `A phone (${phone.model})`);
const stampLabel = (stamp: string) => new Date(`${stamp}:00`).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function ESessionMonitor() {
  const { user } = useAccess();
  const { account, open } = useOpenESession();
  const today = todayInManila();
  const calendar = useCalendarSessions();
  const { live } = useLobby();
  const { notices } = useESessionState();
  const phones = useMobileDevices();
  const phonesOnline = phones.filter((phone) => phone.online);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState('');

  // The sitting to watch: one live now, else the next official one, else whatever is next.
  const upcoming = calendar.filter((session) => session.date >= today);
  const next = calendar.find((session) => live.some((room) => room.sessionId === session.id)) ?? upcoming.find(isOfficial) ?? upcoming[0];
  const announcements = notices.filter((entry) => entry.kind === 'announcement').slice(0, 8);

  // Tell the Secretariat as phones connect and drop off (not for the ones already there when the page opened).
  const knownPhones = useRef<Map<string, MobileDevice> | null>(null);
  useEffect(() => {
    const previous = knownPhones.current;
    knownPhones.current = new Map(phones.map((phone) => [phone.id, phone]));
    if (!previous) return;
    phones.forEach((phone) => {
      const before = previous.get(phone.id);
      if (phone.online && (!before || !before.online)) toast('Phone connected', `${phoneLabel(phone)} · ${phone.platform === 'app' ? 'Android app' : 'browser'}`, 'info');
      else if (!phone.online && before?.online) toast('Phone offline', phoneLabel(phone), 'info');
    });
  }, [phones]);

  const pushNotice = (event: FormEvent) => {
    event.preventDefault();
    const text = notice.trim();
    if (!text || !next) return;
    sendAnnouncement(next.id, text, user.name, nowInManila());
    toast('Notice sent', phonesOnline.length ? `It shows as an alert on ${phonesOnline.length} phone${phonesOnline.length === 1 ? '' : 's'} now, and in LIMS Mobile for everyone.` : 'It shows in LIMS Mobile for everyone; no phone is connected right now.');
    logActivity({ module: 'E-Session', action: 'Published', summary: `Sent a notice to LIMS Mobile: “${text}”`, detail: next.title });
    setNotice('');
  };

  return (
    <div className="space-y-6">
      <MobileAppDialog open={mobileOpen} onOpenChange={setMobileOpen} />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">E-Session Monitor</h1>
          <p className="text-sm text-text-muted">What is happening in E-Session right now. Sittings are started and run in E-Session itself.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setMobileOpen(true)} className="bg-white">
            <QrCode className="mr-2 h-4 w-4" />
            Connect a phone
          </Button>
          {account ? (
            <Button onClick={() => open()}>
              <Video className="mr-2 h-4 w-4" />
              Open E-Session
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="E-Sessions" subtitle="Running now, with who is in each and on what device; then the ones already ended" className="xl:col-span-2">
          <LiveSessionsList sessions={calendar} onOpenESession={account ? open : undefined} detailed endedLimit={8} />
        </Card>
        <Card title="Notices to Phones" subtitle="Shown as an alert in LIMS Mobile">
          <form onSubmit={pushNotice} className="flex gap-2">
            <label htmlFor="monitor-notice" className="sr-only">
              Notice to send
            </label>
            <input
              id="monitor-notice"
              value={notice}
              onChange={(event) => setNotice(event.target.value)}
              maxLength={200}
              placeholder="e.g. Session resumes in 10 minutes"
              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <Button type="submit" size="sm" className="h-9" disabled={!notice.trim() || !next}>
              <Send className="mr-1.5 h-4 w-4" />
              Send
            </Button>
          </form>
          {next ? <p className="mt-1.5 text-[11px] text-text-muted">Filed under {next.title}.</p> : null}
          {announcements.length ? (
            <ul className="mt-4 space-y-2.5">
              {announcements.map((entry) => (
                <li key={entry.id} className="flex gap-2.5 text-sm">
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span className="min-w-0">
                    <span className="block text-text-main">{entry.text}</span>
                    <span className="block text-[11px] text-text-muted">
                      {stampLabel(entry.at)} · {entry.from}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-xs text-text-muted">No notices sent yet.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title={next && live.some((room) => room.sessionId === next.id) ? 'Sitting Now' : 'Next Sitting'} subtitle="Replies from the invitees and the quorum outlook" className="xl:col-span-2">
          <NextSittingCard session={next} room={live.find((room) => room.sessionId === next?.id)} onOpenESession={account ? open : undefined} />
        </Card>
        <Card title="Phones · LIMS Mobile" subtitle={`${phonesOnline.length} of ${phones.length} online`}>
          {phones.length === 0 ? (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-4 text-left text-xs text-text-muted transition-colors hover:border-primary/40 hover:bg-primary/[0.02]"
            >
              <QrCode className="h-8 w-8 shrink-0 text-primary/50" />
              <span>
                <span className="block text-sm font-semibold text-text-main">No phones connected yet</span>
                Scan the QR code with a phone on the same Wi-Fi (browser or Android app). It shows here as soon as it connects.
              </span>
            </button>
          ) : (
            <ul className="space-y-2">
              {[...phones]
                .sort((a, b) => Number(b.online) - Number(a.online) || b.connectedAt - a.connectedAt)
                .map((phone) => (
                  <li key={phone.id} className={cn('flex items-center gap-3 rounded-lg border p-3', phone.online ? 'border-border' : 'border-dashed border-border opacity-70')}>
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', phone.online ? 'bg-primary/[0.07] text-primary' : 'bg-muted text-text-muted')}>
                      <Smartphone className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text-main">{phone.account?.name ?? 'Not signed in yet'}</span>
                      <span className="block truncate text-[11px] text-text-muted">
                        {phone.model}
                        {phone.os ? ` · ${phone.os}` : ''} · {phone.platform === 'app' ? 'Android app' : 'Browser'}
                      </span>
                    </span>
                    <span className={cn('shrink-0 text-right text-[11px] font-semibold', phone.online ? 'text-green-700' : 'text-text-muted')}>
                      {phone.online ? 'Online' : 'Offline'}
                      <span className="block font-normal text-text-muted">{phone.online ? `since ${clockOf(phone.connectedAt)}` : `seen ${clockOf(phone.lastSeen)}`}</span>
                    </span>
                  </li>
                ))}
            </ul>
          )}
          {phones.length === 0 ? null : <EmptyHint />}
        </Card>
      </div>
    </div>
  );
}

function EmptyHint() {
  return <p className="mt-3 text-[11px] text-text-muted">Tablets and computers in a sitting show under E-Sessions above, with the device each one uses.</p>;
}

