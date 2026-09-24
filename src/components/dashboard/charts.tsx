import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

// Chart colors, validated with the dataviz palette checks against the white card surface:
// categorical slots 1-3 (all-pairs CVD ΔE ≥ 9.2) and a 3-step ordinal blue ramp for pipeline phases.
export const SERIES_COLORS = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
};
export const PHASE_COLORS = ['#86b6ef', '#2a78d6', '#104281'];
const GRID = '#ececec';
const DE_EMPHASIS = '#b9bcc4';

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/* ------------------------------------------------------------------ Count up */

export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduceMotion]);
  return <>{display}</>;
}

/* ------------------------------------------------------------ Area sparkline */

// Full-width trend for a stat tile: history in the de-emphasis hue, the current period in the accent.
export function AreaSparkline({ values, labels }: { values: number[]; labels: string[] }) {
  const reduceMotion = useReducedMotion();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 44;
  const pad = 4;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2 - 4);
  const last = values.length - 1;
  const history = values.slice(0, last).map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  const area = `${values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')} L${x(last)},${height} L${x(0)},${height} Z`;
  const active = hover ?? last;

  return (
    <div
      ref={ref}
      className="relative h-11"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const index = Math.round(((event.clientX - rect.left - pad) / Math.max(1, width - pad * 2)) * last);
        setHover(Math.min(last, Math.max(0, index)));
      }}
      onPointerLeave={() => setHover(null)}
    >
      {width > 0 ? (
        <svg width={width} height={height} className="block overflow-visible" aria-hidden>
          <motion.path d={area} fill={DE_EMPHASIS} initial={{ opacity: 0 }} animate={{ opacity: 0.16 }} transition={{ duration: 0.8, delay: reduceMotion ? 0 : 0.3 }} />
          <motion.path
            d={history}
            fill="none"
            stroke={DE_EMPHASIS}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: reduceMotion ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
          <motion.path
            d={`M${x(last - 1)},${y(values[last - 1])} L${x(last)},${y(values[last])}`}
            fill="none"
            stroke={SERIES_COLORS.blue}
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: reduceMotion ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: reduceMotion ? 0 : 0.85 }}
          />
          {hover !== null ? <line x1={x(active)} x2={x(active)} y1={0} y2={height} stroke="#c3c2b7" strokeWidth={1} /> : null}
          <circle cx={x(active)} cy={y(values[active])} r={4} fill={SERIES_COLORS.blue} stroke="#fff" strokeWidth={2} />
        </svg>
      ) : null}
      {hover !== null && width > 0 ? (
        <div
          className="pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded border border-border bg-white px-2 py-0.5 text-[11px] shadow"
          style={{ left: Math.min(Math.max(0, x(active) - 24), width - 64) }}
        >
          <span className="font-semibold text-text-main">{values[active]}</span> <span className="text-text-muted">{labels[active]}</span>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ Segment meter */

export function SegmentMeter({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const reduceMotion = useReducedMotion();
  return (
    <div>
      {/* Segments share the width by value; the 2px flex gap is the surface gap between fills. */}
      <motion.div
        className="flex h-2.5 origin-left gap-0.5"
        initial={{ scaleX: reduceMotion ? 1 : 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8, delay: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div
              key={segment.label}
              className="h-full first:rounded-l-[4px] last:rounded-r-[4px]"
              style={{ backgroundColor: segment.color, flexGrow: segment.value, flexBasis: 0 }}
              title={`${segment.label}: ${segment.value}`}
            />
          ))}
      </motion.div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted">
        {segments.map((segment) => (
          <span key={segment.label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: segment.color }} />
            <span className="font-semibold text-text-main">{segment.value}</span> {segment.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Pipeline chart */

export interface PipelineStage {
  status: string;
  count: number;
  phase: number;
}

export function PipelineChart({
  stages,
  phases,
  onSelect,
}: {
  stages: PipelineStage[];
  phases: string[];
  onSelect: (status: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...stages.map((stage) => stage.count));

  return (
    <div>
      <div className="flex flex-wrap gap-4 text-xs text-text-muted" aria-hidden>
        {phases.map((phase, index) => (
          <span key={phase} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PHASE_COLORS[index] }} />
            {phase}
          </span>
        ))}
      </div>
      <ul className="mt-4 space-y-1.5" aria-label="Measures by legislative stage">
        {stages.map((stage, index) => {
          const width = (stage.count / max) * 100;
          const isActive = active === stage.status;
          return (
            <li key={stage.status} className="relative">
              <button
                type="button"
                onClick={() => onSelect(stage.status)}
                onMouseEnter={() => setActive(stage.status)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(stage.status)}
                onBlur={() => setActive(null)}
                className="grid w-full grid-cols-[104px_1fr_24px] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-background focus-visible:bg-background"
                aria-label={`${stage.status}: ${stage.count} measure${stage.count === 1 ? '' : 's'}, ${phases[stage.phase]} phase`}
              >
                <span className="truncate text-xs text-text-muted">{stage.status}</span>
                <span className="relative h-2.5 rounded-r-[4px] bg-[#f3f4f7]">
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-r-[4px]"
                    style={{ backgroundColor: PHASE_COLORS[stage.phase], filter: isActive ? 'brightness(1.08)' : undefined }}
                    initial={{ width: reduceMotion ? `${width}%` : '0%' }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 0.7, delay: reduceMotion ? 0 : index * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
                <span className="text-right text-sm font-semibold tabular-nums text-text-main">{stage.count}</span>
              </button>
              {isActive ? (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute -top-9 z-10 whitespace-nowrap rounded-md border border-border bg-white px-2.5 py-1.5 text-xs shadow-lg"
                  // Track starts 124px in (padding + label column + gap) and spans the row minus 168px.
                  style={{
                    left: `calc(124px + (100% - 168px) * ${width / 100})`,
                    transform: width > 55 ? 'translateX(-100%)' : 'translateX(-12px)',
                  }}
                >
                  <span className="font-semibold text-text-main">
                    {stage.count} measure{stage.count === 1 ? '' : 's'}
                  </span>
                  <span className="text-text-muted">
                    {' '}
                    · {stage.status} · {phases[stage.phase]}
                  </span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- Donut chart */

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ segments, totalLabel, onSelect }: { segments: DonutSegment[]; totalLabel: string; onSelect?: (label: string) => void }) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const size = 168;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = 2;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;

  let offset = 0;
  const arcs = segments.map((segment) => {
    const length = (segment.value / total) * circumference;
    const arc = { ...segment, length, offset };
    offset += length;
    return arc;
  });

  const activeSegment = segments.find((segment) => segment.label === active);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90" role="img" aria-label={`${totalLabel} by status`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f7" strokeWidth={stroke} />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={active === arc.label ? stroke + 4 : stroke}
              strokeDasharray={`${Math.max(0, arc.length - gap)} ${circumference}`}
              strokeDashoffset={-arc.offset}
              opacity={active && active !== arc.label ? 0.35 : 1}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => setActive(arc.label)}
              onMouseLeave={() => setActive(null)}
              onClick={() => onSelect?.(arc.label)}
            />
          ))}
          {/* Draw-in: a surface-colored ring that retracts to reveal the segments clockwise. */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#ffffff"
            strokeWidth={stroke + 6}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: reduceMotion ? -circumference : 0 }}
            animate={{ strokeDashoffset: -circumference }}
            transition={{ duration: 1, ease: [0.65, 0, 0.35, 1] }}
            pointerEvents="none"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-bold text-text-main">{activeSegment ? activeSegment.value : total}</span>
          <span className="max-w-[96px] text-[11px] leading-tight text-text-muted">{activeSegment ? activeSegment.label : totalLabel}</span>
        </div>
      </div>

      <ul className="w-full space-y-1">
        {segments.map((segment) => (
          <li key={segment.label}>
            <button
              type="button"
              onMouseEnter={() => setActive(segment.label)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(segment.label)}
              onBlur={() => setActive(null)}
              onClick={() => onSelect?.(segment.label)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-background',
                active === segment.label && 'bg-background'
              )}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: segment.color }} />
              <span className="flex-1 text-text-main">{segment.label}</span>
              <span className="font-semibold tabular-nums text-text-main">{segment.value}</span>
              <span className="w-10 text-right text-xs tabular-nums text-text-muted">{Math.round((segment.value / total) * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- Trend chart */

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
  area?: boolean;
}

export function TrendChart({ labels, series, showTable }: { labels: string[]; series: TrendSeries[]; showTable: boolean }) {
  const reduceMotion = useReducedMotion();
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const height = 256;
  const pad = { top: 12, right: 76, bottom: 26, left: 30 };
  const plotWidth = Math.max(0, width - pad.left - pad.right);
  const plotHeight = height - pad.top - pad.bottom;
  const rawMax = Math.max(1, ...series.flatMap((s) => s.values));
  const yMax = Math.ceil(rawMax / 5) * 5;
  const ticks = Array.from({ length: yMax / 5 + 1 }, (_, i) => i * 5);

  const x = (i: number) => pad.left + (labels.length === 1 ? plotWidth / 2 : (i / (labels.length - 1)) * plotWidth);
  const y = (v: number) => pad.top + plotHeight - (v / yMax) * plotHeight;
  const linePath = (values: number[]) => values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  const areaPath = (values: number[]) => `${linePath(values)} L${x(values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  const handlePointer = (clientX: number, rect: DOMRect) => {
    const relative = clientX - rect.left - pad.left;
    const index = Math.round((relative / (plotWidth || 1)) * (labels.length - 1));
    setHoverIndex(Math.min(labels.length - 1, Math.max(0, index)));
  };

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') setHoverIndex((prev) => Math.min(labels.length - 1, (prev ?? -1) + 1));
    if (event.key === 'ArrowLeft') setHoverIndex((prev) => Math.max(0, (prev ?? labels.length) - 1));
    if (event.key === 'Escape') setHoverIndex(null);
  };

  if (showTable) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-muted">
              <th className="py-2 pr-4 font-semibold">Month</th>
              {series.map((s) => (
                <th key={s.key} className="py-2 pr-4 text-right font-semibold">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, i) => (
              <tr key={label} className="border-b border-border last:border-0">
                <td className="py-2 pr-4">{label}</td>
                {series.map((s) => (
                  <td key={s.key} className="py-2 pr-4 text-right tabular-nums">
                    {s.values[i]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      tabIndex={0}
      role="img"
      aria-label={`Line chart of ${series.map((s) => s.label).join(' and ')} per month. Use the left and right arrow keys to read values.`}
      onKeyDown={handleKey}
      onPointerMove={(event) => handlePointer(event.clientX, event.currentTarget.getBoundingClientRect())}
      onPointerLeave={() => setHoverIndex(null)}
      onBlur={() => setHoverIndex(null)}
    >
      {width > 0 ? (
        <svg width={width} height={height} className="block">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={pad.left + plotWidth} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
              <text x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-text-muted text-[11px] tabular-nums">
                {tick}
              </text>
            </g>
          ))}
          {labels.map((label, i) => (
            <text key={label} x={x(i)} y={height - 6} textAnchor="middle" className="fill-text-muted text-[11px]">
              {label}
            </text>
          ))}

          {series
            .filter((s) => s.area)
            .map((s) => (
              <motion.path
                key={`${s.key}-area`}
                d={areaPath(s.values)}
                fill={s.color}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.1 }}
                transition={{ duration: 0.8, delay: reduceMotion ? 0 : 0.5 }}
              />
            ))}

          {series.map((s, seriesIndex) => (
            <motion.path
              key={s.key}
              d={linePath(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: reduceMotion ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, delay: reduceMotion ? 0 : seriesIndex * 0.15, ease: 'easeInOut' }}
            />
          ))}

          {hoverIndex !== null ? (
            <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={pad.top} y2={pad.top + plotHeight} stroke="#c3c2b7" strokeWidth={1} />
          ) : null}

          {series.map((s) => {
            const last = s.values.length - 1;
            const index = hoverIndex ?? last;
            return (
              <g key={`${s.key}-marks`}>
                <circle cx={x(index)} cy={y(s.values[index])} r={4} fill={s.color} stroke="#ffffff" strokeWidth={2} />
                <text x={x(last) + 10} y={y(s.values[last])} dy="0.32em" className="fill-text-main text-[12px] font-semibold">
                  {s.values[last]}
                  <tspan className="fill-text-muted font-normal"> {s.label}</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <div style={{ height }} />
      )}

      {hoverIndex !== null && width > 0 ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-2 z-10 min-w-[128px] rounded-md border border-border bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(x(hoverIndex) + 12, width - 150),
          }}
        >
          <div className="mb-1 font-semibold text-text-muted">{labels[hoverIndex]} 2026</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className="h-0.5 w-3 rounded" style={{ backgroundColor: s.color }} />
              <span className="font-semibold tabular-nums text-text-main">{s.values[hoverIndex]}</span>
              <span className="text-text-muted">{s.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------- Horizontal bars */

export function BarList({ items, onSelect }: { items: { label: string; value: number }[]; onSelect: () => void }) {
  const reduceMotion = useReducedMotion();
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={item.label}>
          <button type="button" onClick={onSelect} className="w-full text-left" title={`${item.label}: ${item.value}`}>
            <div className="flex justify-between gap-2 text-xs">
              <span className="truncate font-medium text-text-main">{item.label}</span>
              <span className="tabular-nums text-text-muted">{item.value}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-r-[4px] bg-[#f3f4f7]">
              <motion.div
                className="h-2 rounded-r-[4px]"
                style={{ backgroundColor: SERIES_COLORS.blue }}
                initial={{ width: reduceMotion ? `${(item.value / max) * 100}%` : '0%' }}
                animate={{ width: `${(item.value / max) * 100}%` }}
                transition={{ duration: 0.7, delay: reduceMotion ? 0 : index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
