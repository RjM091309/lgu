import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronDown, Mic, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudioLevels, supportsSpeakerChoice } from '@/lib/esession-rtc';
import type { LocalMedia } from '@/components/esession-room/use-local-media';

// Microphone meter and device pickers, used before joining and in the call's settings.

/** A bar that moves with the microphone, so people can see they are heard before joining. */
export function MicMeter({ track, enabled, dark = false, className }: { track: MediaStreamTrack | null; enabled: boolean; dark?: boolean; className?: string }) {
  const [level, setLevel] = useState(0);
  const levels = useRef<AudioLevels | null>(null);

  useEffect(() => {
    if (!track) {
      setLevel(0);
      return;
    }
    const meter = new AudioLevels();
    levels.current = meter;
    meter.track('self', new MediaStream([track]));
    const timer = setInterval(() => setLevel(Math.min(1, (meter.levels().get('self') ?? 0) * 8)), 100);
    return () => {
      clearInterval(timer);
      meter.close();
    };
  }, [track]);

  const bars = 12;
  const lit = enabled ? Math.round(level * bars) : 0;
  return (
    <span className={cn('flex h-4 items-end gap-0.5', className)} role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={bars} aria-valuenow={lit}>
      {Array.from({ length: bars }, (_, index) => (
        <span
          key={index}
          className={cn('w-1.5 rounded-sm transition-colors', index < lit ? (index > 9 ? 'bg-amber-400' : 'bg-green-400') : dark ? 'bg-white/20' : 'bg-[#d5d9e2]')}
          style={{ height: `${40 + (index / bars) * 60}%` }}
        />
      ))}
    </span>
  );
}

const labelOf = (device: MediaDeviceInfo, index: number, kind: string) => device.label || `${kind} ${index + 1}`;

export function DeviceSelects({ media, dark = false }: { media: LocalMedia; dark?: boolean }) {
  const field = cn(
    // The browser's own arrow cannot be padded, so it is hidden and drawn below with room around it.
    'h-12 w-full min-w-0 appearance-none rounded-lg border pl-3 pr-10 text-base outline-none sm:text-sm',
    dark ? 'border-white/15 bg-white/10 text-white focus:border-[#d4a72c] [&>option]:text-[#212121]' : 'border-border bg-white text-text-main focus:border-primary focus:ring-2 focus:ring-primary/15'
  );
  const label = cn('flex items-center gap-2 text-xs font-semibold', dark ? 'text-white/70' : 'text-text-muted');
  const rows = [
    { id: 'es-cam', icon: Camera, title: 'Camera', list: media.devices.cams, value: media.camId, onChange: media.chooseCam, kind: 'Camera' },
    { id: 'es-mic', icon: Mic, title: 'Microphone', list: media.devices.mics, value: media.micId, onChange: media.chooseMic, kind: 'Microphone' },
    ...(supportsSpeakerChoice() && media.devices.speakers.length
      ? [{ id: 'es-speaker', icon: Volume2, title: 'Speaker', list: media.devices.speakers, value: media.speakerId, onChange: media.chooseSpeaker, kind: 'Speaker' }]
      : []),
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <label key={row.id} htmlFor={row.id} className="block space-y-1.5">
          <span className={label}>
            <row.icon className="h-3.5 w-3.5" />
            {row.title}
          </span>
          <span className="relative block">
          <select id={row.id} value={row.value} onChange={(e) => row.onChange(e.target.value)} className={field} disabled={row.list.length === 0}>
            <option value="">{row.list.length ? 'Default' : `No ${row.kind.toLowerCase()} found`}</option>
            {row.list.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {labelOf(device, index, row.kind)}
              </option>
            ))}
          </select>
          <ChevronDown className={cn('pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2', dark ? 'text-white/70' : 'text-text-muted', row.list.length === 0 && 'opacity-50')} aria-hidden />
          </span>
        </label>
      ))}
    </div>
  );
}
