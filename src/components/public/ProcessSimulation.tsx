import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { ArrowRight, BookOpen, Check, Eye, FilePlus, Megaphone, MessagesSquare, Pause, Play, RotateCcw, Stamp, Users, Vote, X } from 'lucide-react';
import { Select, type SelectOption } from '@/components/ui/select';
import type { Bill } from '@/lib/mock-data';
import type { LandingCopy } from '@/components/public/landing-copy';
import { cn } from '@/lib/utils';

type StageKey = keyof LandingCopy['process']['stages'];

// Each stage matches the tracking status a measure carries while it is there.
const STAGES: { key: StageKey; icon: typeof Check; statuses: Bill['status'][] }[] = [
  { key: 'filing', icon: FilePlus, statuses: ['Draft'] },
  { key: 'first', icon: BookOpen, statuses: ['First Reading'] },
  { key: 'committee', icon: Users, statuses: ['Committee'] },
  { key: 'second', icon: MessagesSquare, statuses: ['Second Reading'] },
  { key: 'third', icon: Vote, statuses: ['Third Reading'] },
  { key: 'approval', icon: Stamp, statuses: ['Passed', 'Vetoed'] },
  { key: 'publication', icon: Megaphone, statuses: ['Enacted'] },
];

const LAST = STAGES.length - 1;
const STEP_MS = 2800;
const END_HOLD_MS = 4500;

const stageOf = (status: Bill['status']) => Math.max(0, STAGES.findIndex((stage) => stage.statuses.includes(status)));

interface ProcessSimulationProps {
  copy: LandingCopy['process'];
  bills: Bill[];
  /** Shows the measures at a stage in the public inquiry list. */
  onViewStage: (status: Bill['status']) => void;
  onViewRecord: (billId: string) => void;
}

export function ProcessSimulation({ copy, bills, onViewStage, onViewRecord }: ProcessSimulationProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Plays only while on screen, so it starts from the top when a visitor scrolls to it.
  const inView = useInView(rootRef, { amount: 0.35 });
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(() => !reduceMotion);
  const [followId, setFollowId] = useState<string | null>(null);

  const followed = followId ? bills.find((bill) => bill.id === followId) ?? null : null;
  const current = followed ? stageOf(followed.status) : step;
  const autoplay = playing && inView && !followed;

  useEffect(() => {
    if (reduceMotion) setPlaying(false);
  }, [reduceMotion]);

  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(() => setStep((value) => (value + 1) % STAGES.length), step === LAST ? END_HOLD_MS : STEP_MS);
    return () => clearTimeout(timer);
  }, [autoplay, step]);

  const selectStage = (index: number) => {
    setFollowId(null);
    setPlaying(false);
    setStep(index);
  };

  const replay = () => {
    setFollowId(null);
    setStep(0);
    setPlaying(true);
  };

  const measureOptions: SelectOption[] = bills.map((bill) => ({ value: bill.id, label: `${bill.number} — ${bill.title}` }));
  const stage = STAGES[current];
  const stageCopy = copy.stages[stage.key];
  const countAt = (index: number) => bills.filter((bill) => STAGES[index].statuses.includes(bill.status)).length;
  const progress = (current / LAST) * 100;

  return (
    <div ref={rootRef} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-md">
          <Select
            options={measureOptions}
            value={measureOptions.find((option) => option.value === followId) ?? null}
            onChange={(option) => {
              setFollowId(option?.value ?? null);
              if (!option) setPlaying(false);
            }}
            placeholder={copy.followPlaceholder}
            aria-label={copy.followLabel}
          />
        </div>
        <div className="flex items-center gap-2">
          {followed ? (
            <button
              type="button"
              onClick={() => setFollowId(null)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              {copy.stopFollowing}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? copy.pause : copy.play}
            </button>
          )}
          <button
            type="button"
            onClick={replay}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            {copy.replay}
          </button>
        </div>
      </div>

      {/* Stepper: a track that fills as the measure moves from stage to stage. */}
      <div className="px-4 pb-2 pt-8 sm:px-8">
        <ol className="relative grid grid-cols-7">
          <span className="absolute left-[7.14%] right-[7.14%] top-[18px] h-1 -translate-y-1/2 rounded-full bg-slate-200 md:top-[22px]" aria-hidden />
          <span className="absolute left-[7.14%] right-[7.14%] top-[18px] h-1 -translate-y-1/2 md:top-[22px]" aria-hidden>
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-[#3949ab]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.7, ease: 'easeInOut' }}
            />
            {/* The "document" riding the track. */}
            <motion.span
              className="absolute top-1/2 hidden h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-white shadow-[0_0_0_4px_rgba(26,35,126,0.18)] md:block"
              initial={false}
              animate={{ left: `${progress}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.7, ease: 'easeInOut' }}
            />
          </span>

          {STAGES.map((item, index) => {
            const done = index < current;
            const active = index === current;
            const Icon = done ? Check : item.icon;
            return (
              <li key={item.key} className="relative flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => selectStage(index)}
                  aria-current={active ? 'step' : undefined}
                  aria-label={`${copy.stepOf(index + 1, STAGES.length)}: ${copy.stages[item.key].label}`}
                  className="group flex flex-col items-center gap-2 focus-visible:outline-none"
                >
                  <span className="relative">
                    {active && !reduceMotion ? (
                      <motion.span
                        key={`${item.key}-${current}`}
                        className="absolute inset-0 rounded-full bg-primary/30"
                        initial={{ scale: 1, opacity: 0.7 }}
                        animate={{ scale: 1.7, opacity: 0 }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className={cn(
                        'relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors duration-300 group-focus-visible:ring-4 group-focus-visible:ring-primary/20 md:h-11 md:w-11',
                        done && 'border-primary bg-primary text-white',
                        active && 'border-primary bg-white text-primary shadow-[0_6px_18px_-6px_rgba(26,35,126,0.5)]',
                        !done && !active && 'border-slate-200 bg-white text-slate-400 group-hover:border-primary/40 group-hover:text-primary'
                      )}
                    >
                      <Icon className="h-4 w-4 md:h-5 md:w-5" />
                    </span>
                  </span>
                  <span
                    className={cn(
                      'hidden max-w-[8rem] text-center text-xs font-semibold leading-tight md:block',
                      active ? 'text-primary' : done ? 'text-slate-700' : 'text-slate-500'
                    )}
                  >
                    {copy.stages[item.key].label}
                  </span>
                  <span className="hidden text-[11px] tabular-nums text-slate-400 md:block">{copy.stageCount(countAt(index))}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Detail of the current stage */}
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.4fr_1fr]" aria-live={autoplay ? 'off' : 'polite'}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stage.key}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
            className="rounded-xl bg-slate-50 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {copy.stepOf(current + 1, STAGES.length)} · {stageCopy.label}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">{stageCopy.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{stageCopy.description}</p>
            <ul className="mt-4 space-y-2">
              {stageCopy.points.map((point) => (
                <li key={point} className="flex gap-2 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {point}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>

        <div className="flex flex-col rounded-xl border border-slate-200 p-5">
          {followed ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.currentStage}</p>
              <p className="mt-1 text-sm font-semibold text-primary">{followed.number}</p>
              <p className="mt-1 text-sm font-medium leading-snug text-slate-900">{followed.title}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{copy.filed}</dt>
                  <dd className="text-right font-medium text-slate-800">{followed.dateFiled}</dd>
                </div>
                {followed.actionTaken ? (
                  <div className="flex justify-between gap-4">
                    <dt className="shrink-0 text-slate-500">{copy.latestAction}</dt>
                    <dd className="text-right font-medium text-slate-800">{followed.actionTaken}</dd>
                  </div>
                ) : null}
              </dl>
              <button
                type="button"
                onClick={() => onViewRecord(followed.id)}
                className="mt-auto inline-flex items-center gap-1.5 self-start pt-4 text-sm font-semibold text-primary hover:underline"
              >
                <Eye className="h-4 w-4" />
                {copy.viewRecord}
              </button>
            </>
          ) : (
            <>
              <p className="text-4xl font-bold tracking-tight text-slate-900">{countAt(current)}</p>
              <p className="mt-1 text-sm text-slate-600">{copy.measuresHere(countAt(current))}</p>
              <ul className="mt-3 space-y-1.5">
                {bills
                  .filter((bill) => stage.statuses.includes(bill.status))
                  .slice(0, 3)
                  .map((bill) => (
                    <li key={bill.id}>
                      <button type="button" onClick={() => onViewRecord(bill.id)} className="text-left text-sm leading-snug text-slate-700 hover:text-primary hover:underline">
                        <span className="font-semibold text-primary">{bill.number}</span> · {bill.title}
                      </button>
                    </li>
                  ))}
              </ul>
              {countAt(current) > 0 ? (
                <button
                  type="button"
                  onClick={() => onViewStage(stage.statuses[0])}
                  className="mt-auto inline-flex items-center gap-1 self-start pt-4 text-sm font-semibold text-primary hover:underline"
                >
                  {copy.viewMeasures}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-6">{copy.legalBasis}</p>
    </div>
  );
}
