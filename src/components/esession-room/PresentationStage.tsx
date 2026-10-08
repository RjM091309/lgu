import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Minus, MonitorUp, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Participant } from '@/lib/esession-room';
import { VideoView } from '@/components/esession-room/VideoTile';

// The call screen while someone else's screen share is on stage: the share fills the screen and can be zoomed,
// the others sit in a small floating box, and the bars get out of the way until the pointer moves.

const IDLE_MS = 3000;
const MAX_ZOOM = 3;

// The system's open/closed hand cursors are white with a thin outline and vanish over white paper, so dragging a
// zoomed share uses these instead: a dark hand inside a white halo, visible on light and dark pages alike.
const handCursor = (paths: string[], fallback: string) => {
  const d = paths.map((path) => `<path d="${path}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="-1 -1 26 26" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#fff" stroke-width="5">${d}</g><g stroke="#0a0f2b" stroke-width="2">${d}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, ${fallback}`;
};
const GRAB_CURSOR = handCursor(
  ['M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2', 'M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2', 'M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8', 'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'],
  'grab'
);
const GRABBING_CURSOR = handCursor(
  ['M18 11.5V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4', 'M14 10V8a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2', 'M10 9.9V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v5', 'M6 14a2 2 0 0 0-2-2a2 2 0 0 0-2 2', 'M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8 2 2 0 1 1 4 0'],
  'grabbing'
);

/**
 * True while the bars should show. When `active`, they hide after a few seconds without pointer or key activity,
 * unless `hold` (an open panel needs them) or the pointer or focus is on them. Activity inside an element marked
 * `data-no-wake` (the banners) does not count, so reading or dismissing a banner leaves the bars where they are.
 */
export function useAutoHide(active: boolean, hold: boolean) {
  const [awake, setAwake] = useState(true);
  const keep = useRef(false);
  const holdRef = useRef(hold);
  holdRef.current = hold;

  useEffect(() => {
    if (!active) {
      setAwake(true);
      return;
    }
    let timer = 0;
    const wake = () => {
      setAwake(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(function sleep() {
        if (keep.current || holdRef.current) timer = window.setTimeout(sleep, IDLE_MS);
        else setAwake(false);
      }, IDLE_MS);
    };
    wake();
    let last = { x: -1, y: -1 };
    const onActivity = (event: Event) => {
      if ((event.target as Element | null)?.closest?.('[data-no-wake]')) return;
      if (event.type === 'pointermove') {
        // Browsers send a move without motion when the page changes under a still pointer (a banner closing).
        const { clientX: x, clientY: y } = event as PointerEvent;
        if (x === last.x && y === last.y) return;
        last = { x, y };
      }
      wake();
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const;
    events.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, onActivity));
    };
  }, [active]);

  // Spread onto each bar: hovering or tabbing into one keeps them all up.
  const barProps = {
    onPointerEnter: () => (keep.current = true),
    onPointerLeave: () => (keep.current = false),
    onFocus: () => (keep.current = true),
    onBlur: () => (keep.current = false),
  };
  return { visible: !active || hold || awake, barProps };
}

type View = { s: number; x: number; y: number };

/** The shared screen, fitted to the space, with zoom (double-click, Ctrl + scroll, pinch) and pan (drag). */
export function ShareStage({ sharer, stream, chrome, insetTop, insetBottom }: { sharer: Participant; stream: MediaStream | null; chrome: boolean; insetTop: number; insetBottom: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [grabbing, setGrabbing] = useState(false);
  const gesture = useRef<{ view: View; x: number; y: number; dist: number } | null>(null);

  // Keeps the zoomed picture covering the box, so it never drifts off screen.
  const clamp = useCallback((s: number, x: number, y: number): View => {
    const el = box.current;
    const scale = Math.min(MAX_ZOOM, Math.max(1, s));
    if (!el || scale === 1) return { s: 1, x: 0, y: 0 };
    const mx = ((scale - 1) * el.clientWidth) / 2;
    const my = ((scale - 1) * el.clientHeight) / 2;
    return { s: scale, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  }, []);

  /** Zooms to `s` keeping the point under (clientX, clientY) still; the centre when no point is given. */
  const zoomAt = useCallback(
    (s: number, clientX?: number, clientY?: number, from: View = viewRef.current) => {
      const el = box.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = clientX === undefined ? 0 : clientX - r.left - r.width / 2;
      const py = clientY === undefined ? 0 : clientY - r.top - r.height / 2;
      const next = Math.min(MAX_ZOOM, Math.max(1, s));
      const k = next / from.s;
      setView(clamp(next, px - (px - from.x) * k, py - (py - from.y) * k));
    },
    [clamp]
  );

  // Ctrl + scroll zooms (instead of zooming the whole page); plain scroll pans while zoomed in.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const v = viewRef.current;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        zoomAt(v.s * Math.exp(-event.deltaY * 0.0025), event.clientX, event.clientY);
      } else if (v.s > 1) {
        event.preventDefault();
        setView(clamp(v.s, v.x - event.deltaX, v.y - event.deltaY));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clamp, zoomAt]);

  // A resize changes how far the picture may move.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setView((v) => clamp(v.s, v.x, v.y)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [clamp]);

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const [a, b] = pts;
    gesture.current = b
      ? { view: viewRef.current, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) }
      : a
        ? { view: viewRef.current, x: a.x, y: a.y, dist: 0 }
        : null;
  };
  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    box.current?.setPointerCapture(event.pointerId);
    setGrabbing(true);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    startGesture();
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (!g) return;
    const [a, b] = [...pointers.current.values()];
    if (b && g.dist > 0) {
      // Pinch: scale by the change in finger distance around where the fingers started, and follow their midpoint.
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const el = box.current!;
      const r = el.getBoundingClientRect();
      const px = g.x - r.left - r.width / 2;
      const py = g.y - r.top - r.height / 2;
      const s = Math.min(MAX_ZOOM, Math.max(1, (g.view.s * dist) / g.dist));
      const k = s / g.view.s;
      setView(clamp(s, px - (px - g.view.x) * k + (mid.x - g.x), py - (py - g.view.y) * k + (mid.y - g.y)));
    } else if (g.view.s > 1) {
      setView(clamp(g.view.s, g.view.x + a.x - g.x, g.view.y + a.y - g.y));
    }
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (!pointers.current.size) setGrabbing(false);
    startGesture();
  };

  const zoomed = view.s > 1.001;
  const step = (factor: number) => zoomAt(view.s * factor);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div
        ref={box}
        className={cn('absolute inset-0 touch-none select-none', !zoomed && (chrome ? 'cursor-zoom-in' : 'cursor-none'))}
        style={zoomed ? { cursor: grabbing ? GRABBING_CURSOR : GRAB_CURSOR } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(event) => (zoomed ? setView({ s: 1, x: 0, y: 0 }) : zoomAt(2, event.clientX, event.clientY))}
        aria-label={`${sharer.name}'s shared screen. Double-click to zoom.`}
        role="img"
      >
        <div className="h-full w-full origin-center will-change-transform" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}>
          <VideoView stream={stream} contain className="bg-black" />
        </div>
      </div>

      {/* Who is sharing; fades with the bars. */}
      <div className={cn('pointer-events-none absolute left-3 transition-[opacity,top] duration-300', chrome ? 'opacity-100' : 'opacity-0')} style={{ top: insetTop + 12 }}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3949ab] px-2.5 py-1 text-xs font-bold text-white shadow-lg">
          <MonitorUp className="h-3.5 w-3.5" />
          {sharer.name} is presenting
        </span>
      </div>

      {/* Zoom controls; stay up while zoomed in so the way back is always visible. */}
      <div
        className={cn('absolute left-3 flex items-center gap-1 rounded-xl bg-black/70 p-1 text-white shadow-lg ring-1 ring-white/15 transition-[opacity,bottom] duration-300', chrome || zoomed ? 'opacity-100' : 'pointer-events-none opacity-0')}
        style={{ bottom: insetBottom + 12 }}
      >
        <button type="button" onClick={() => step(1 / 1.25)} disabled={!zoomed} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15 disabled:opacity-40" aria-label="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-12 text-center text-xs font-semibold tabular-nums" aria-live="polite">
          {Math.round(view.s * 100)}%
        </span>
        <button type="button" onClick={() => step(1.25)} disabled={view.s >= MAX_ZOOM} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15 disabled:opacity-40" aria-label="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
        {zoomed ? (
          <button type="button" onClick={() => setView({ s: 1, x: 0, y: 0 })} className="ml-1 h-9 rounded-lg bg-white/15 px-3 text-xs font-bold hover:bg-white/25">
            Fit
          </button>
        ) : null}
      </div>
    </div>
  );
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';
type FloatSize = 'pill' | 'focus' | 'all';

/**
 * The others while a share fills the stage: one tile (whoever has the floor or spoke last), all of them, or just
 * a count. Drag the header to move it to another corner.
 */
export function PeopleFloat({
  people,
  focus,
  renderTile,
  insetTop,
  insetBottom,
}: {
  people: Participant[];
  focus: Participant | undefined;
  renderTile: (p: Participant, className: string, style?: CSSProperties) => ReactNode;
  insetTop: number;
  insetBottom: number;
}) {
  const [size, setSize] = useState<FloatSize>('focus');
  const [corner, setCorner] = useState<Corner>('br');
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  if (!people.length) return null;
  const shown = size === 'all' ? people : focus ? [focus] : people.slice(0, 1);

  const onPointerDown = (event: ReactPointerEvent) => {
    if ((event.target as HTMLElement).closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, y: event.clientY };
    setDrag({ dx: 0, dy: 0 });
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (!start.current) return;
    setDrag({ dx: event.clientX - start.current.x, dy: event.clientY - start.current.y });
  };
  const onPointerUp = () => {
    const el = ref.current;
    const parent = el?.offsetParent?.getBoundingClientRect();
    start.current = null;
    setDrag(null);
    if (!el || !parent) return;
    // Snap to the corner nearest to where it was let go.
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2 - parent.left;
    const cy = r.top + r.height / 2 - parent.top;
    setCorner(`${cy < parent.height / 2 ? 't' : 'b'}${cx < parent.width / 2 ? 'l' : 'r'}` as Corner);
  };

  const position: CSSProperties = {
    [corner[0] === 't' ? 'top' : 'bottom']: (corner[0] === 't' ? insetTop : insetBottom) + 12,
    [corner[1] === 'l' ? 'left' : 'right']: 12,
    transform: drag ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
  };

  if (size === 'pill') {
    return (
      <div ref={ref} className="absolute z-10 transition-[top,bottom] duration-300" style={position}>
        <button
          type="button"
          onClick={() => setSize('focus')}
          className="flex h-10 items-center gap-2 rounded-full bg-[#121a3d] px-4 text-sm font-semibold text-white shadow-xl ring-1 ring-white/15 hover:bg-[#1b2453]"
        >
          <Users className="h-4 w-4" />
          {people.length} {people.length === 1 ? 'person' : 'people'}
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn('absolute z-10 flex w-[150px] flex-col overflow-hidden rounded-xl bg-[#121a3d] shadow-2xl ring-1 ring-white/15 sm:w-[220px]', !drag && 'transition-[top,bottom] duration-300')}
      style={position}
    >
      <div className="flex h-9 cursor-move touch-none items-center gap-1 pl-3 pr-1 text-xs font-semibold text-white/80" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <Users className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {people.length} {people.length === 1 ? 'person' : 'people'}
        </span>
        {people.length > 1 ? (
          <button
            type="button"
            onClick={() => setSize(size === 'all' ? 'focus' : 'all')}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/15"
            aria-label={size === 'all' ? 'Show only the speaker' : 'Show everyone'}
            title={size === 'all' ? 'Show only the speaker' : 'Show everyone'}
          >
            {size === 'all' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        ) : null}
        <button type="button" onClick={() => setSize('pill')} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/15" aria-label="Minimise" title="Minimise">
          <Minus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex max-h-[min(60vh,520px)] flex-col gap-1.5 overflow-y-auto px-1.5 pb-1.5">{shown.map((p) => renderTile(p, 'aspect-video w-full shrink-0'))}</div>
    </div>
  );
}
