import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ExternalLink, Globe, Smartphone, Wifi } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSyncStatus } from '@/lib/esession-sync';
import { cn } from '@/lib/utils';

const isLoopback = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

type Mode = 'browser' | 'apk';

interface ApkInfo {
  size: number;
  builtAt: string;
}

/**
 * How phones on the same network get LIMS Mobile: in the browser (/m), or as the Android app (APK)
 * downloaded from this server, each with a QR code to scan.
 */
export function MobileAppDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const status = useSyncStatus();
  const [mode, setMode] = useState<Mode>('browser');
  // Server origins phones can reach (`http://192.168.1.10:2510`).
  const [origins, setOrigins] = useState<string[]>([]);
  const [origin, setOrigin] = useState('');
  const [apk, setApk] = useState<ApkInfo | null>(null);
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (!open) return;
    const own = window.location.origin;
    let cancelled = false;
    fetch('/api/esession/info')
      .then((res) => (res.ok ? res.json() : { mobileUrls: [], apk: null }))
      .catch(() => ({ mobileUrls: [], apk: null }))
      .then((info: { mobileUrls: string[]; apk: ApkInfo | null }) => {
        if (cancelled) return;
        // Opened on the computer itself: localhost is unreachable from a phone, so use the server's network addresses.
        const list = isLoopback(window.location.hostname) && info.mobileUrls.length ? info.mobileUrls.map((url) => new URL(url).origin) : [own];
        setOrigins(list);
        setOrigin((prev) => (list.includes(prev) ? prev : list[0]));
        setApk(info.apk);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const target = origin ? (mode === 'browser' ? `${origin}/m` : `${origin}/api/esession/apk`) : '';
  const showQr = Boolean(target) && (mode === 'browser' || apk !== null);

  useEffect(() => {
    if (!showQr) {
      setQr('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(target, { margin: 1, width: 440, color: { dark: '#1a237e', light: '#ffffff' } })
      .then((data) => !cancelled && setQr(data))
      .catch(() => !cancelled && setQr(''));
    return () => {
      cancelled = true;
    };
  }, [target, showQr]);

  const onlyLoopback = origins.length > 0 && origins.every((entry) => isLoopback(new URL(entry).hostname));
  const host = origin ? new URL(origin).host : '…';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-primary">
            <Smartphone className="h-5 w-5" />
            LIMS Mobile
          </DialogTitle>
          <DialogDescription>Members and staff see their session schedule and confirm attendance from their phones.</DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="How to open LIMS Mobile">
          {(
            [
              ['browser', 'Browser', Globe],
              ['apk', 'Android app', Smartphone],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={cn('flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold', mode === value ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text-main')}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col items-center gap-3">
          {showQr ? (
            <div className="flex h-52 w-52 items-center justify-center rounded-xl border border-border bg-white p-2">
              {qr ? <img src={qr} alt={`QR code for ${target}`} className="h-full w-full" /> : <span className="text-xs text-text-muted">Preparing QR code…</span>}
            </div>
          ) : mode === 'apk' ? (
            <div className="w-full rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-text-muted">
              The Android app has not been built on this computer yet. Run <code className="rounded bg-muted px-1 font-mono text-text-main">npm run apk</code>, then reopen this window.
            </div>
          ) : null}

          {origins.length > 1 ? (
            <div className="flex flex-wrap justify-center gap-1.5">
              {origins.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setOrigin(entry)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 font-mono text-[11px]',
                    entry === origin ? 'border-primary bg-primary text-white' : 'border-border text-text-main hover:border-primary/40'
                  )}
                >
                  {new URL(entry).host}
                </button>
              ))}
            </div>
          ) : null}

          {mode === 'browser' ? (
            <>
              <p className="text-center text-xs text-text-muted">Scan with the phone's camera, then sign in.</p>
              <p className="break-all rounded-md bg-muted px-3 py-1.5 text-center font-mono text-sm text-text-main">{target || '…'}</p>
            </>
          ) : (
            <ol className="w-full list-decimal space-y-1.5 pl-5 text-xs text-text-main">
              <li>{apk ? `Scan to download LIMS-Mobile.apk (${(apk.size / 1024 / 1024).toFixed(1)} MB).` : 'Download LIMS-Mobile.apk once it is built.'}</li>
              <li>Open the file and allow installing from this source when Android asks.</li>
              <li>
                Open <b>LIMS Mobile</b>, enter this server, then sign in:
                <span className="mt-1 block rounded-md bg-primary/[0.06] px-3 py-1.5 text-center font-mono text-base font-semibold text-primary">{host}</span>
              </li>
            </ol>
          )}
        </div>

        <ul className="mt-4 space-y-1.5 text-xs text-text-muted">
          <li className="flex items-start gap-1.5">
            <Wifi className="mt-px h-3.5 w-3.5 shrink-0 text-primary" />
            The phone must be on the same Wi-Fi as this computer.
            {origins.length > 1 ? ' If one address does not work, try the next.' : ''}
          </li>
          {onlyLoopback ? <li className="text-amber-700">No network address was found. Connect this computer to Wi-Fi and reopen this window.</li> : null}
          <li>
            Live sync:{' '}
            <span className={cn('font-semibold', status === 'live' ? 'text-green-700' : 'text-amber-700')}>
              {status === 'live' ? 'on. Replies from phones appear here at once.' : 'not connected. Start the app with npm run dev or npm start.'}
            </span>
          </li>
        </ul>

        {mode === 'browser' ? (
          <a href="/m" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            Open the mobile app in a new tab
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
