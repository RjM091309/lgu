import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Pause, Play, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HeroSlide {
  id: string;
  kicker: string;
  title: string;
  text: string;
  icon: LucideIcon;
  tone: 'navy' | 'violet' | 'gold' | 'teal';
  /** Optional photo under /public (e.g. /hero/session-hall.jpg); a branded gradient shows until one is supplied. */
  image?: string;
  actions: { label: string; onClick: () => void; icon?: LucideIcon; primary?: boolean }[];
}

export interface HeroSliderLabels {
  carousel: string;
  slideOf: (current: number, total: number) => string;
  previous: string;
  next: string;
  pause: string;
  play: string;
  goTo: (slide: number) => string;
}

interface HeroSliderProps {
  slides: HeroSlide[];
  labels: HeroSliderLabels;
  /** Stays put while slides change (e.g. the next-session card). */
  aside?: ReactNode;
  /** Shown under the slides on every slide (e.g. the search bar). */
  below?: ReactNode;
  interval?: number;
}

const TONES: Record<HeroSlide['tone'], string> = {
  navy: 'from-[#0a0f3d] via-[#1a237e] to-[#283593]',
  violet: 'from-[#140f3d] via-[#35207a] to-[#1a237e]',
  gold: 'from-[#0a0f3d] via-[#1a237e] to-[#7a5b10]',
  teal: 'from-[#06232d] via-[#0f4c5c] to-[#1a237e]',
};

export function HeroSlider({ slides, labels, aside, below, interval = 7000 }: HeroSliderProps) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  // People who ask for reduced motion get a still hero; they can still press play.
  const [userPaused, setUserPaused] = useState(() => Boolean(reduceMotion));
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const pointerStart = useRef<number | null>(null);

  const count = slides.length;
  const paused = userPaused || hovered || focused;
  const go = (next: number) => setIndex(((next % count) + count) % count);

  useEffect(() => {
    if (reduceMotion) setUserPaused(true);
  }, [reduceMotion]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') go(index - 1);
    else if (event.key === 'ArrowRight') go(index + 1);
    else return;
    event.preventDefault();
  };

  // Swipe on touch screens; mouse drags are left alone so text stays selectable.
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointerStart.current = event.pointerType === 'touch' ? event.clientX : null;
  };
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerStart.current === null) return;
    const delta = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(delta) > 50) go(delta < 0 ? index + 1 : index - 1);
  };

  return (
    <section
      id="home"
      aria-roledescription="carousel"
      aria-label={labels.carousel}
      // Only the backgrounds are clipped, and the hero sits above the next section, so the live search results can hang over it.
      // overflow-x-clip keeps the off-screen slides (shifted 24px sideways) from widening the page on phones.
      className="relative z-10 overflow-x-clip border-b border-slate-200 bg-[#0a0f3d] text-white"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {/* Backgrounds crossfade under the content. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {slides.map((slide, i) => (
          <motion.div
            key={slide.id}
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={false}
            animate={{ opacity: i === index ? 1 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.8 }}
          >
            {slide.image ? (
              <>
                <img src={slide.image} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f3d]/95 via-[#0a0f3d]/80 to-[#0a0f3d]/40" />
              </>
            ) : (
              <div className={cn('h-full w-full bg-gradient-to-br', TONES[slide.tone])}>
                <slide.icon className="absolute -bottom-16 right-[-4rem] h-[26rem] w-[26rem] text-white/[0.05] lg:right-[30%]" strokeWidth={1} />
              </div>
            )}
          </motion.div>
        ))}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff14_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]"
          aria-hidden
        />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:px-8">
        <div className="min-w-0">
          {/* All slides share one grid cell, so the hero keeps the height of the tallest slide and never jumps. */}
          <div className="grid touch-pan-y" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} aria-live={paused ? 'polite' : 'off'}>
            {slides.map((slide, i) => {
              const active = i === index;
              const Heading = i === 0 ? 'h1' : 'h2';
              return (
                <motion.div
                  key={slide.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={labels.slideOf(i + 1, count)}
                  aria-hidden={!active}
                  inert={!active}
                  className={cn('[grid-area:1/1]', !active && 'pointer-events-none')}
                  initial={false}
                  animate={{ opacity: active ? 1 : 0, x: active || reduceMotion ? 0 : i < index ? -24 : 24 }}
                  transition={{ duration: reduceMotion ? 0 : 0.5, ease: 'easeOut' }}
                >
                  <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#d4a72c]" aria-hidden />
                    <span className="truncate">{slide.kicker}</span>
                  </p>
                  <Heading className="mt-6 max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl">{slide.title}</Heading>
                  <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">{slide.text}</p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    {slide.actions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                        className={cn(
                          'inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a72c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f3d]',
                          action.primary ? 'bg-[#d4a72c] text-[#0a0f3d] hover:bg-[#e2b93f]' : 'border border-white/25 bg-white/5 text-white hover:bg-white/15'
                        )}
                      >
                        {action.icon ? <action.icon className="h-4 w-4" /> : null}
                        {action.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Controls */}
          <div className="mt-8 flex items-center gap-3" onKeyDown={handleKeyDown}>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={labels.previous}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/15"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex flex-1 items-center gap-1.5 sm:flex-none">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={labels.goTo(i + 1)}
                  aria-current={i === index ? 'true' : undefined}
                  className="group flex h-9 flex-1 items-center sm:w-12 sm:flex-none"
                >
                  <span className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-colors group-hover:bg-white/35">
                    {i === index ? (
                      <span
                        key={`${slide.id}-${userPaused}`}
                        className="absolute inset-0 origin-left rounded-full bg-[#d4a72c]"
                        style={
                          userPaused
                            ? undefined
                            : { animation: `hero-progress ${interval}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }
                        }
                        onAnimationEnd={() => go(index + 1)}
                      />
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={labels.next}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/15"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setUserPaused((value) => !value)}
              aria-label={userPaused ? labels.play : labels.pause}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            >
              {userPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <span className="hidden text-xs tabular-nums text-white/60 sm:inline" aria-hidden>
              {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
            </span>
          </div>

          {below ? <div className="mt-8">{below}</div> : null}
        </div>

        {aside}
      </div>
    </section>
  );
}
