import { useEffect, useRef, useState } from 'react';
import { Crown, Hand, Loader2, MicOff, MonitorUp, MoreVertical, Pin, PinOff, UserMinus, VolumeX, Mic as MicIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LinkQuality, PeerLink } from '@/lib/esession-rtc';
import type { Participant } from '@/lib/esession-room';

// One person's tile on the call screen, and the hidden audio player for each person.
// The call screen is always dark, so colours here are fixed rather than theme tokens.

/** Plays a stream in a muted video element (sound comes from RemoteAudio, so it keeps playing off-screen). */
export function VideoView({ stream, mirrored, contain, className }: { stream: MediaStream | null; mirrored?: boolean; contain?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    if (stream) void video.play().catch(() => undefined);
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn('h-full w-full bg-black', contain ? 'object-contain' : 'object-cover', mirrored && '-scale-x-100', className)}
    />
  );
}

/** Sound of one other person. `speakerId` picks the output device where the browser allows it. */
export function RemoteAudio({ stream, speakerId }: { stream: MediaStream | null; speakerId: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    if (audio.srcObject !== stream) audio.srcObject = stream;
    if (stream) void audio.play().catch(() => undefined);
  }, [stream]);
  useEffect(() => {
    const audio = ref.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (audio?.setSinkId && speakerId) void audio.setSinkId(speakerId).catch(() => undefined);
  }, [speakerId]);
  return <audio ref={ref} autoPlay playsInline />;
}

const QUALITY_BARS: Record<LinkQuality, number> = { good: 3, fair: 2, poor: 1 };

export function SignalBars({ quality, className }: { quality: LinkQuality | null; className?: string }) {
  if (!quality) return null;
  const bars = QUALITY_BARS[quality];
  const colour = quality === 'good' ? 'bg-green-400' : quality === 'fair' ? 'bg-amber-400' : 'bg-red-500';
  return (
    <span className={cn('inline-flex h-3.5 items-end gap-0.5', className)} role="img" aria-label={`Connection ${quality}`} title={`Connection: ${quality}`}>
      {[1, 2, 3].map((bar) => (
        <span key={bar} className={cn('w-1 rounded-sm', bar <= bars ? colour : 'bg-white/25')} style={{ height: `${bar * 33}%` }} />
      ))}
    </span>
  );
}

export interface TileActions {
  onMute?: () => void;
  onFloor?: () => void;
  onRemove?: () => void;
  onPin?: () => void;
  pinned?: boolean;
}

export function VideoTile({
  participant,
  stream,
  isSelf,
  speaking,
  hasFloor,
  link,
  quality,
  roleLabel,
  actions,
  large = false,
  className,
}: {
  participant: Participant;
  stream: MediaStream | null;
  isSelf: boolean;
  speaking: boolean;
  hasFloor: boolean;
  link: PeerLink | null;
  quality: LinkQuality | null;
  roleLabel: string | null;
  actions?: TileActions;
  large?: boolean;
  className?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const showVideo = (participant.video || participant.screen) && !!stream?.getVideoTracks().some((track) => track.readyState === 'live' && !track.muted);
  const connecting = !isSelf && (link === 'connecting' || link === 'reconnecting' || link === 'failed' || !participant.connected);
  const hasMenu = actions && (actions.onMute || actions.onFloor || actions.onRemove || actions.onPin);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const timer = setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
    };
  }, [menuOpen]);

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl bg-[#141c3d] ring-1 ring-white/10 transition-shadow',
        hasFloor ? 'ring-[3px] ring-[#d4a72c]' : speaking ? 'ring-[3px] ring-green-400' : '',
        className
      )}
    >
      {showVideo ? (
        <VideoView stream={stream} mirrored={isSelf && !participant.screen} contain={participant.screen} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1b2453] to-[#0e1433]">
          <span
            className={cn(
              'flex items-center justify-center rounded-full font-bold shadow-lg',
              participant.group === 'member' ? 'bg-[#d4a72c] text-[#141b66]' : 'bg-[#3949ab] text-white',
              large ? 'h-28 w-28 text-3xl' : 'h-14 w-14 text-base sm:h-16 sm:w-16 sm:text-lg',
              speaking && 'ring-4 ring-green-400/70'
            )}
          >
            {participant.abbr}
          </span>
        </div>
      )}

      {connecting ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-semibold text-white">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {!participant.connected ? 'Reconnecting…' : link === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
        </div>
      ) : null}

      {/* Top: what is happening with this person */}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start gap-1.5">
        {hasFloor ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#d4a72c] px-2 py-0.5 text-[11px] font-bold text-[#141b66]">
            <MicIcon className="h-3 w-3" />
            Has the floor
          </span>
        ) : null}
        {participant.hand ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-[#3d2a00]">
            <Hand className="h-3 w-3" />
            Hand raised
          </span>
        ) : null}
        {participant.screen ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#3949ab] px-2 py-0.5 text-[11px] font-bold text-white">
            <MonitorUp className="h-3 w-3" />
            Sharing screen
          </span>
        ) : null}
      </div>

      {/* Bottom: name, position, mic */}
      <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 text-white backdrop-blur-sm">
          {participant.audio ? null : <MicOff className="h-3.5 w-3.5 shrink-0 text-red-400" aria-label="Muted" />}
          {roleLabel ? <Crown className="h-3.5 w-3.5 shrink-0 text-[#e8c766]" aria-hidden /> : null}
          <span className="min-w-0">
            <span className={cn('block truncate font-semibold leading-tight', large ? 'text-sm' : 'text-xs')}>
              {participant.name}
              {isSelf ? ' (You)' : ''}
            </span>
            {large || roleLabel ? <span className="block truncate text-[10px] leading-tight text-white/70">{roleLabel ?? participant.detail}</span> : null}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-lg bg-black/60 px-1.5 py-1">
          <SignalBars quality={isSelf ? null : quality} />
          {hasMenu ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((open) => !open);
              }}
              className="pointer-events-auto -m-1 flex h-8 w-8 items-center justify-center rounded-md text-white hover:bg-white/15"
              aria-label={`Actions for ${participant.name}`}
              aria-expanded={menuOpen}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          ) : null}
        </span>
      </div>

      {menuOpen && actions ? (
        <div className="absolute bottom-12 right-2 z-10 w-52 overflow-hidden rounded-lg bg-[#0e1533] py-1 text-sm text-white shadow-xl ring-1 ring-white/15" role="menu">
          {actions.onPin ? (
            <MenuButton icon={actions.pinned ? PinOff : Pin} label={actions.pinned ? 'Unpin' : 'Pin for me'} onClick={actions.onPin} />
          ) : null}
          {actions.onFloor ? <MenuButton icon={MicIcon} label={hasFloor ? 'Close the floor' : 'Give the floor'} onClick={actions.onFloor} /> : null}
          {actions.onMute ? <MenuButton icon={VolumeX} label="Mute" onClick={actions.onMute} /> : null}
          {actions.onRemove ? <MenuButton icon={UserMinus} label="Remove from e-session" onClick={actions.onRemove} danger /> : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick, danger }: { icon: typeof Pin; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={cn('flex h-11 w-full items-center gap-3 px-3 text-left hover:bg-white/10', danger && 'text-red-300')}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
