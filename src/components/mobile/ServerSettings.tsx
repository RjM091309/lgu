import { useState, type FormEvent } from 'react';
import { Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getServerAddress, normalizeServerAddress, setServerAddress, useSyncStatus } from '@/lib/esession-sync';
import { cn } from '@/lib/utils';

const hostOf = (origin: string) => (origin ? new URL(origin).host : '');

/** Android app only: the address of the LIMS computer on the local network, and whether it is reachable. */
export function ServerSettings({ dark = false, className }: { dark?: boolean; className?: string }) {
  const status = useSyncStatus();
  const saved = getServerAddress();
  const [value, setValue] = useState(hostOf(saved));
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const origin = normalizeServerAddress(value);
    if (!origin) return setError('Enter the address shown on the LIMS computer, for example 192.168.1.10:2510.');
    setError('');
    setValue(hostOf(origin));
    setServerAddress(origin);
  };

  const message = !saved
    ? { text: 'On the LIMS computer open Calendar Sessions → Mobile app, then type the address shown there.', tone: dark ? 'text-white/70' : 'text-text-muted' }
    : status === 'live'
      ? { text: `Connected to ${hostOf(saved)}.`, tone: dark ? 'text-green-300' : 'text-green-700' }
      : status === 'connecting'
        ? { text: `Connecting to ${hostOf(saved)}…`, tone: dark ? 'text-white/70' : 'text-text-muted' }
        : { text: `Cannot reach ${hostOf(saved)}. Check the address, that LIMS is running, and that this phone is on the same Wi-Fi.`, tone: dark ? 'text-amber-200' : 'text-amber-700' };

  return (
    <form onSubmit={submit} className={cn('rounded-2xl p-4', dark ? 'bg-white/10 text-white' : 'bg-white text-text-main shadow-sm ring-1 ring-border', className)} noValidate>
      <label htmlFor="lims-server" className="flex items-center gap-2 text-sm font-semibold">
        <Server className={cn('h-4 w-4', dark ? 'text-[#f1d27a]' : 'text-primary')} />
        LIMS server
        <span className={cn('ml-auto h-2 w-2 rounded-full', status === 'live' ? 'bg-green-400' : status === 'connecting' && saved ? 'bg-amber-300' : 'bg-slate-400')} aria-hidden />
      </label>
      <div className="mt-2 flex gap-2">
        <Input
          id="lims-server"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="192.168.1.10:2510"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          className="h-11 flex-1 bg-white font-mono text-base text-text-main"
        />
        <Button type="submit" className={cn('h-11 shrink-0', dark && 'bg-[#d4a72c] text-[#141b66] hover:bg-[#e0b84a]')}>
          Connect
        </Button>
      </div>
      <p className={cn('mt-2 text-xs', error ? (dark ? 'text-amber-200' : 'text-red-700') : message.tone)} role={error ? 'alert' : 'status'}>
        {error || message.text}
      </p>
    </form>
  );
}
