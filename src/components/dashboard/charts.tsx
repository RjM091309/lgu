import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  const phaseTotals = phases.map((_, phase) => stages.filter((stage) => stage.phase === phase).reduce((sum, stage) => sum + stage.count, 0));

  return (
    <div>
      {/* Phase summary doubles as the legend for the step markers. */}
      <dl className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border">
        {phases.map((phase, index) => (
          <div key={phase} className="px-3 py-2">
            <dt className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PHASE_COLORS[index] }} />
              {phase}
            </dt>
            <dd className="mt-0.5 text-lg font-semibold leading-tight text-text-main">{phaseTotals[index]}</dd>
          </div>
        ))}
      </dl>

      <ol className="relative mt-3" aria-label="Measures by legislative stage">
        {/* Connector running through the step markers. */}
        <span className="absolute bottom-4 left-[15px] top-4 w-px bg-[#d5d9e2]" aria-hidden />
        {stages.map((stage, index) => (
          <motion.li
            key={stage.status}
            initial={{ opacity: reduceMotion ? 1 : 0, x: reduceMotion ? 0 : -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: reduceMotion ? 0 : index * 0.05 }}
          >
            <button
              type="button"
              onClick={() => onSelect(stage.status)}
              className="relative grid w-full grid-cols-[14px_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-background focus-visible:bg-background"
              aria-label={`${stage.status}: ${stage.count} measure${stage.count === 1 ? '' : 's'}, ${phases[stage.phase]} phase`}
            >
              <span
                className="relative z-[1] mx-auto h-3 w-3 rounded-full ring-[3px] ring-white"
                style={{ backgroundColor: stage.count > 0 ? PHASE_COLORS[stage.phase] : '#e5e7eb' }}
                aria-hidden
              />
              <span className={cn('truncate text-[13px]', stage.count > 0 ? 'text-text-main' : 'text-text-muted')}>{stage.status}</span>
              <span
                className={cn(
                  'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums',
                  stage.count > 0 ? 'bg-[#eef2fb] text-text-main' : 'bg-[#f3f4f7] text-text-muted'
                )}
              >
                {stage.count}
              </span>
            </button>
          </motion.li>
        ))}
      </ol>
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
  const hoverGrow = 6;
  // Leave room for the thicker hovered ring so it isn't clipped at the SVG edge.
  const radius = (size - stroke - hoverGrow) / 2;
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
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          className="-rotate-90 overflow-visible"
          role="img"
          aria-label={`${totalLabel} by status`}
          // Clear on leaving the whole ring, not each arc, so crossing the gaps between arcs doesn't flicker.
          onMouseLeave={() => setActive(null)}
        >
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f7" strokeWidth={stroke} />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={active === arc.label ? stroke + hoverGrow : stroke}
              strokeDasharray={`${Math.max(0, arc.length - gap)} ${circumference}`}
              strokeDashoffset={-arc.offset}
              opacity={active && active !== arc.label ? 0.35 : 1}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => setActive(arc.label)}
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
}

// Column path with a 4px rounded data-end and a square baseline.
const columnPath = (x: number, top: number, width: number, baseline: number) => {
  const h = baseline - top;
  if (h <= 0) return '';
  const r = Math.min(4, width / 2, h);
  return `M${x},${baseline} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${baseline} Z`;
};

// Optional derived column for the table view, e.g. approved ÷ filed.
export interface TrendRatio {
  label: string;
  numerator: string;
  denominator: string;
}

const percentOf = (numerator: number, denominator: number) => (denominator > 0 ? `${Math.round((numerator / denominator) * 100)}%` : '–');

export function GroupedBarChart({
  labels,
  series,
  showTable,
  ratio,
  periodSuffix = '',
}: {
  labels: string[];
  series: TrendSeries[];
  showTable: boolean;
  ratio?: TrendRatio;
  periodSuffix?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const height = 256;
  const pad = { top: 20, right: 8, bottom: 26, left: 30 };
  const plotWidth = Math.max(0, width - pad.left - pad.right);
  const plotHeight = height - pad.top - pad.bottom;
  const rawMax = Math.max(1, ...series.flatMap((s) => s.values));
  // About four gridlines at a round step (1, 2 or 5 × 10^n); never finer than 5.
  const roughStep = rawMax / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = Math.max(5, [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= roughStep) ?? 10 * magnitude);
  const yMax = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: yMax / step + 1 }, (_, i) => i * step);

  // Each month gets an equal band; bars are capped at 24px and separated by a 2px surface gap.
  const band = plotWidth / Math.max(1, labels.length);
  const barGap = 2;
  const barWidth = Math.max(4, Math.min(24, (band * 0.62 - barGap * (series.length - 1)) / series.length));
  const groupWidth = barWidth * series.length + barGap * (series.length - 1);
  const bandStart = (i: number) => pad.left + i * band;
  const barX = (i: number, seriesIndex: number) => bandStart(i) + (band - groupWidth) / 2 + seriesIndex * (barWidth + barGap);
  const y = (v: number) => pad.top + plotHeight - (v / yMax) * plotHeight;
  const baseline = pad.top + plotHeight;
  const last = labels.length - 1;

  const handlePointer = (clientX: number, rect: DOMRect) => {
    const index = Math.floor((clientX - rect.left - pad.left) / (band || 1));
    setHoverIndex(index >= 0 && index < labels.length ? index : null);
  };

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') setHoverIndex((prev) => Math.min(labels.length - 1, (prev ?? -1) + 1));
    if (event.key === 'ArrowLeft') setHoverIndex((prev) => Math.max(0, (prev ?? labels.length) - 1));
    if (event.key === 'Escape') setHoverIndex(null);
  };

  const totals = series.map((s) => s.values.reduce((sum, value) => sum + value, 0));
  const ratioIndexes = ratio
    ? { num: series.findIndex((s) => s.key === ratio.numerator), den: series.findIndex((s) => s.key === ratio.denominator) }
    : null;
  const rowRatio = (values: number[]) =>
    ratioIndexes && ratioIndexes.num >= 0 && ratioIndexes.den >= 0 ? percentOf(values[ratioIndexes.num], values[ratioIndexes.den]) : null;

  if (showTable) {
    return (
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              {series.map((s) => (
                <TableHead key={s.key}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
                    {s.label}
                  </span>
                </TableHead>
              ))}
              {ratio ? <TableHead>{ratio.label}</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {labels.map((label, i) => (
              <TableRow key={label}>
                <TableCell className="py-2">
                  {label}
                  {periodSuffix}
                </TableCell>
                {series.map((s) => (
                  <TableCell key={s.key} className="py-2 tabular-nums">
                    {s.values[i]}
                  </TableCell>
                ))}
                {ratio ? <TableCell className="py-2 tabular-nums text-text-muted">{rowRatio(series.map((s) => s.values[i]))}</TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="py-2.5">Total</TableCell>
              {series.map((s, index) => (
                <TableCell key={s.key} className="py-2.5 tabular-nums">
                  {totals[index]}
                </TableCell>
              ))}
              {ratio ? <TableCell className="py-2.5 tabular-nums">{rowRatio(totals)}</TableCell> : null}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    );
  }

  // Tooltip sits beside the hovered month (right side, or left when near the edge) so it never covers those bars.
  const tooltipWidth = 160;
  const tooltipLeft =
    hoverIndex === null
      ? 0
      : bandStart(hoverIndex) + band + 4 + tooltipWidth <= width
        ? bandStart(hoverIndex) + band + 4
        : Math.max(0, bandStart(hoverIndex) - tooltipWidth - 4);

  return (
    <div
      ref={containerRef}
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      tabIndex={0}
      role="img"
      aria-label={`Column chart of ${series.map((s) => s.label).join(' and ')} per month. Use the left and right arrow keys to read values.`}
      onKeyDown={handleKey}
      onPointerMove={(event) => handlePointer(event.clientX, event.currentTarget.getBoundingClientRect())}
      onPointerLeave={() => setHoverIndex(null)}
      onBlur={() => setHoverIndex(null)}
    >
      {width > 0 ? (
        <svg width={width} height={height} className="block">
          {hoverIndex !== null ? (
            <rect x={bandStart(hoverIndex) + 2} y={pad.top - 8} width={band - 4} height={plotHeight + 8} rx={6} fill="#f3f4f7" />
          ) : null}

          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={pad.left + plotWidth} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
              <text x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-text-muted text-[11px] tabular-nums">
                {tick}
              </text>
            </g>
          ))}

          {labels.map((label, i) => (
            <text
              key={label}
              x={bandStart(i) + band / 2}
              y={height - 6}
              textAnchor="middle"
              className={cn('text-[11px]', hoverIndex === i ? 'fill-text-main font-semibold' : 'fill-text-muted')}
            >
              {label}
            </text>
          ))}

          {labels.map((label, i) =>
            series.map((s, seriesIndex) => (
              <motion.path
                key={`${label}-${s.key}`}
                d={columnPath(barX(i, seriesIndex), y(s.values[i]), barWidth, baseline)}
                fill={s.color}
                opacity={hoverIndex !== null && hoverIndex !== i ? 0.45 : 1}
                style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
                initial={{ scaleY: reduceMotion ? 1 : 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.6, delay: reduceMotion ? 0 : i * 0.05 + seriesIndex * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="transition-opacity duration-150"
              />
            ))
          )}

          {/* Direct labels on the latest month only; every other value is in the tooltip and the table view. */}
          {hoverIndex === null
            ? series.map((s, seriesIndex) => (
                <text
                  key={`${s.key}-latest`}
                  x={barX(last, seriesIndex) + barWidth / 2}
                  y={y(s.values[last]) - 6}
                  textAnchor="middle"
                  className="fill-text-main text-[11px] font-semibold tabular-nums"
                >
                  {s.values[last]}
                </text>
              ))
            : null}
        </svg>
      ) : (
        <div style={{ height }} />
      )}

      {hoverIndex !== null && width > 0 ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-2 z-10 w-40 rounded-md border border-border bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltipLeft }}
        >
          <div className="mb-1 font-semibold text-text-main">
            {labels[hoverIndex]}
            {periodSuffix}
          </div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="text-text-muted">{s.label}</span>
              <span className="ml-auto font-semibold tabular-nums text-text-main">{s.values[hoverIndex]}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------- Horizontal bars */

export function BarList({
  items,
  total,
  groupCount,
  groupLabel = 'committees',
  onSelect,
}: {
  items: { label: string; value: number }[];
  total: number;
  groupCount: number;
  groupLabel?: string;
  onSelect: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div>
      <ol className="space-y-1">
        {items.map((item, index) => (
          <li key={item.label}>
            <button
              type="button"
              onClick={onSelect}
              className="grid w-full grid-cols-[24px_1fr] items-center gap-x-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-background focus-visible:bg-background"
              aria-label={`${item.label}: ${item.value} measure${item.value === 1 ? '' : 's'}`}
            >
              <span className="row-span-2 flex h-6 w-6 items-center justify-center rounded-md bg-[#f3f4f7] text-[11px] font-semibold text-text-muted">
                {index + 1}
              </span>
              <span className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate font-medium text-text-main">{item.label}</span>
                <span className="shrink-0 text-xs text-text-muted">
                  <span className="font-semibold text-text-main">{item.value}</span> · {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                </span>
              </span>
              <span className="mt-1.5 h-1.5 rounded-r-[4px] bg-[#f3f4f7]">
                <motion.span
                  className="block h-1.5 rounded-r-[4px]"
                  style={{ backgroundColor: SERIES_COLORS.blue }}
                  initial={{ width: reduceMotion ? `${(item.value / max) * 100}%` : '0%' }}
                  animate={{ width: `${(item.value / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: reduceMotion ? 0 : index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-border px-2 pt-3 text-xs text-text-muted">
        <span className="font-semibold text-text-main">{total}</span> measures across{' '}
        <span className="font-semibold text-text-main">{groupCount}</span> {groupLabel}
      </p>
    </div>
  );
}
