import { useId } from 'react';
import { cn } from '@/lib/utils';

// The "Ask the Sanggunian" mascot: a friendly robot head in the Capas navy and seal gold.
export function RobotMark({ className }: { className?: string }) {
  // Unique gradient ids so several robots on one page never share (and lose) a definition.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const headId = `capasbot-head-${uid}`;
  const glowId = `capasbot-glow-${uid}`;
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={headId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe3f5" />
        </linearGradient>
        <radialGradient id={glowId}>
          <stop offset="0" stopColor="#fff4c7" />
          <stop offset="1" stopColor="#d4a72c" />
        </radialGradient>
      </defs>
      {/* Antenna */}
      <line x1="24" y1="5.5" x2="24" y2="11" stroke="#e8c766" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="5" r="2.8" fill={`url(#${glowId})`} className="capasbot-antenna" />
      {/* Ears */}
      <rect x="4.5" y="19" width="4.5" height="10" rx="2.25" fill="#d4a72c" />
      <rect x="39" y="19" width="4.5" height="10" rx="2.25" fill="#d4a72c" />
      {/* Head */}
      <rect x="8.5" y="11" width="31" height="26" rx="10" fill={`url(#${headId})`} />
      {/* Visor */}
      <rect x="12.5" y="16.5" width="23" height="12" rx="6" fill="#0a0f3d" />
      <g className="capasbot-eyes" fill="#e8c766">
        <rect x="16.5" y="20" width="5" height="5" rx="2.5" />
        <rect x="26.5" y="20" width="5" height="5" rx="2.5" />
      </g>
      {/* Smile */}
      <path d="M20 31.5q4 3 8 0" fill="none" stroke="#18237f" strokeWidth="2" strokeLinecap="round" />
      {/* Collar */}
      <rect x="16" y="37.5" width="16" height="4" rx="2" fill="#d4a72c" />
    </svg>
  );
}

const SIZES = {
  sm: { orb: 'h-7 w-7', robot: 'h-5 w-5' },
  md: { orb: 'h-10 w-10', robot: 'h-7 w-7' },
  lg: { orb: 'h-16 w-16', robot: 'h-12 w-12' },
} as const;

interface BotAvatarProps {
  size?: keyof typeof SIZES;
  /** Rotating gold ring, for the floating launcher. */
  animated?: boolean;
  online?: boolean;
  className?: string;
}

export function BotAvatar({ size = 'md', animated = false, online = false, className }: BotAvatarProps) {
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center rounded-full', SIZES[size].orb, className)}>
      <span
        className={cn(
          'absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#d4a72c,transparent_35%,#e8c766_55%,transparent_80%,#d4a72c)]',
          animated && 'motion-safe:animate-[spin_5s_linear_infinite]'
        )}
        aria-hidden
      />
      <span
        className={cn(
          'absolute rounded-full bg-gradient-to-b from-[#232f9a] via-[#18237f] to-[#0a0f3d]',
          size === 'lg' ? 'inset-[3px]' : 'inset-[1.5px]'
        )}
        aria-hidden
      />
      <RobotMark className={cn('relative', SIZES[size].robot)} />
      {online && (
        <span
          className={cn(
            'absolute right-0 top-0 rounded-full bg-[#22c55e] ring-2 ring-white',
            size === 'lg' ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'
          )}
          aria-hidden
        />
      )}
    </span>
  );
}
