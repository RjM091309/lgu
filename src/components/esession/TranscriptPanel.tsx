import { useEffect, useMemo, useRef, useState } from 'react';
import { Captions, Check, Download, FileDown, FileText, Loader2, Pencil, RotateCcw, Sparkles, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { confirmAction } from '@/components/ui/confirm';
import { downloadUrl } from '@/lib/files';
import {
  STT_LANGUAGES,
  STT_MODELS,
  cancelTranscription,
  correctLine,
  deleteTranscript,
  formatClock,
  startTranscription,
  toPlainText,
  toVtt,
  transcriptKey,
  transcriptPdf,
  useTranscript,
  type SttModel,
  type TranscriptSegment,
} from '@/lib/transcripts';
import type { SessionFile } from '@/lib/session-files';
import { getCurrentUser } from '@/lib/access-store';
import { useCalendarSessions } from '@/lib/esession-sync';
import { formatLongDate } from '@/lib/sessions';
import { cn } from '@/lib/utils';

/** Which speech models the LIMS server already keeps (so they work without internet); null until known. */
let speechStatus: Promise<Record<string, number> | null> | null = null;
const fetchSpeechStatus = () =>
  (speechStatus ??= fetch('/api/speech/status', { cache: 'no-store' })
    .then((res) => (res.ok ? (res.json() as Promise<{ models: Record<string, number> }>) : null))
    .then((body) => body?.models ?? null)
    .catch(() => null));

interface TranscriptPanelProps {
  file: SessionFile;
  url: string;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

const selectClass = 'h-8 rounded-md border border-border bg-white px-2 text-xs text-text-main';

// The caption on screen: the segment being spoken, or the last one if we are in a short pause after it.
const findActiveIndex = (segments: TranscriptSegment[], time: number) => {
  let active = -1;
  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i].start <= time) active = i;
    else break;
  }
  if (active >= 0 && time > segments[active].end + 2) return -1;
  return active;
};

const saveText = (content: string, fileName: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const ok = downloadUrl(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return ok;
};

export function TranscriptPanel({ file, url, currentTime, onSeek }: TranscriptPanelProps) {
  const key = transcriptKey(file);
  const state = useTranscript(key, file.transcriptSrc);
  const hasGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  const [model, setModel] = useState<SttModel>(hasGpu ? 'standard' : 'fast');
  const [language, setLanguage] = useState<string>('english');
  const listRef = useRef<HTMLDivElement>(null);
  const sessions = useCalendarSessions();
  const session = sessions.find((entry) => entry.id === file.sessionId);
  // A line being corrected: its index and the text so far.
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  const [savingLine, setSavingLine] = useState(false);
  const [kept, setKept] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    void fetchSpeechStatus().then(setKept);
  }, []);
  const modelKept = (kept?.[STT_MODELS[model].id] ?? 0) > 1_000_000;

  const segments = state?.segments ?? [];
  const activeIndex = useMemo(() => findActiveIndex(segments, currentTime), [segments, currentTime]);
  const running = state?.status === 'preparing' || state?.status === 'model' || state?.status === 'transcribing';
  const baseName = file.name.replace(/\.[^.]+$/, '');

  // Keep the spoken line in view without moving the rest of the dialog.
  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-segment="${activeIndex}"]`);
    if (!list || !item) return;
    const target = item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2;
    list.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [activeIndex]);

  const start = async () => {
    const confirmed = await confirmAction({
      title: 'Transcribe this recording?',
      description:
        'Speech-to-text runs on this computer. The first time, the speech model is downloaded once and kept for later. A long recording can take several minutes; you can keep working while it runs.',
      confirmLabel: 'Start transcription',
    });
    if (!confirmed) return;
    void startTranscription(key, file.name, url, model, language, getCurrentUser().name);
  };

  const redo = async () => {
    const confirmed = await confirmAction({
      title: 'Replace the saved transcript?',
      description: 'The current transcript will be deleted and the recording transcribed again with the options you choose.',
      confirmLabel: 'Transcribe again',
      tone: 'destructive',
    });
    if (!confirmed) return;
    const error = await deleteTranscript(key);
    if (error) {
      toast('Transcript not replaced', error, 'error');
      return;
    }
    void startTranscription(key, file.name, url, model, language, getCurrentUser().name);
  };

  const cancel = async () => {
    const confirmed = await confirmAction({
      title: 'Cancel transcription?',
      description: 'Captions produced so far will be discarded.',
      confirmLabel: 'Cancel transcription',
      cancelLabel: 'Keep going',
      tone: 'destructive',
    });
    if (!confirmed) return;
    cancelTranscription(key);
    toast('Transcription cancelled', file.name, 'info');
  };

  const saveLine = async () => {
    if (!editing) return;
    setSavingLine(true);
    const error = await correctLine(key, editing.index, editing.text, getCurrentUser().name);
    setSavingLine(false);
    if (error) return toast('Line not saved', error, 'error');
    setEditing(null);
  };

  const downloadPdf = () => {
    const pdf = transcriptPdf({
      fileName: file.name,
      session: session ? { title: session.title, when: `${formatLongDate(session.date)} - ${session.time}`, where: session.location } : undefined,
      segments,
      note: 'Generated by speech-to-text and checked by the Secretariat; times are from the start of the recording.',
    });
    const pdfUrl = URL.createObjectURL(pdf);
    const ok = downloadUrl(pdfUrl, `${baseName} - Transcript.pdf`);
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
    if (ok) toast('Transcript downloaded', `${baseName} - Transcript.pdf`);
    else toast('Download failed', 'The transcript could not be downloaded. Please try again.', 'error');
  };

  const download = (format: 'vtt' | 'txt') => {
    const ok =
      format === 'vtt'
        ? saveText(toVtt(segments), `${baseName}.vtt`, 'text/vtt;charset=utf-8')
        : saveText(toPlainText(file.name, segments), `${baseName} - Transcript.txt`, 'text/plain;charset=utf-8');
    if (ok) toast('Transcript downloaded', `${baseName}.${format === 'vtt' ? 'vtt' : 'txt'}`);
    else toast('Download failed', 'The transcript could not be downloaded. Please try again.', 'error');
  };

  const options = (
    <div className="flex flex-wrap items-center gap-2">
      <select value={model} onChange={(e) => setModel(e.target.value as SttModel)} className={selectClass} aria-label="Speech model">
        {(Object.keys(STT_MODELS) as SttModel[]).map((option) => (
          <option key={option} value={option}>
            {STT_MODELS[option].label}
          </option>
        ))}
      </select>
      <select value={language} onChange={(e) => setLanguage(e.target.value)} className={selectClass} aria-label="Spoken language">
        {STT_LANGUAGES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const activeText = activeIndex >= 0 ? segments[activeIndex].text : null;
  const correctedCount = segments.filter((segment) => segment.edited).length;
  const progressPercent = Math.round((state?.progress ?? 0) * 100);

  return (
    <div className="rounded-lg border border-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Captions className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-bold text-primary">Live Transcript</h4>
          <span className="text-[11px] text-text-muted">
            {state?.status === 'done'
              ? `${
                  state.source === 'bundled'
                    ? 'Prepared transcript'
                    : state.source === 'local'
                      ? 'Saved on this device only (the LIMS server could not be reached)'
                      : `Saved for every device${state.savedBy ? ` by ${state.savedBy}` : ''}`
                } · ${correctedCount ? `${correctedCount} line${correctedCount === 1 ? '' : 's'} corrected` : 'auto-generated, may contain errors'}`
              : 'Speech-to-text'}
          </span>
        </div>
        {state?.status === 'done' ? (
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => download('vtt')} title="Caption file for video players">
              <Download className="mr-1 h-3.5 w-3.5" />
              Captions (.vtt)
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => download('txt')}>
              <FileText className="mr-1 h-3.5 w-3.5" />
              Text (.txt)
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={downloadPdf} title="Laid out for the minutes, with the session and times">
              <FileDown className="mr-1 h-3.5 w-3.5" />
              For minutes (.pdf)
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={redo}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Redo
            </Button>
          </div>
        ) : null}
      </div>

      {state?.status === 'loading' ? (
        <p className="px-4 py-6 text-center text-xs text-text-muted">Checking for a saved transcript…</p>
      ) : null}

      {state?.status === 'idle' || state?.status === 'error' ? (
        <div className="space-y-3 px-4 py-4">
          {state.status === 'error' ? (
            <p className="rounded-md border border-[#ef9a9a] bg-[#fde0e0] px-3 py-2 text-xs text-[#b71c1c]">
              Transcription failed: {state.message}
            </p>
          ) : null}
          <p className="text-xs text-text-muted">
            Turn this recording into text that follows along while it plays. Speech-to-text runs on this device; the transcript is then saved on the LIMS server for every device, and each line can be corrected.
          </p>
          <p className={cn('flex items-start gap-1.5 text-[11px]', modelKept ? 'text-green-700' : 'text-text-muted')}>
            {modelKept ? <Check className="mt-px h-3.5 w-3.5 shrink-0" /> : <WifiOff className="mt-px h-3.5 w-3.5 shrink-0" />}
            {kept === null
              ? 'Checking the speech model…'
              : modelKept
                ? 'This speech model is kept on the LIMS server: it works without internet.'
                : 'The first time, the LIMS server downloads this speech model from the internet and keeps it; after that it works without internet.'}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {options}
            <Button size="sm" onClick={start}>
              <Sparkles className="mr-1.5 h-4 w-4" />
              {state.status === 'error' ? 'Try again' : 'Transcribe'}
            </Button>
          </div>
          {!hasGpu ? (
            <p className="text-[11px] text-[#8a4b08]">This browser can't use the graphics card, so transcription runs slower. "Fast" is recommended.</p>
          ) : null}
        </div>
      ) : null}

      {running ? (
        <div className="space-y-2 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 font-medium text-text-main">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {state?.status === 'model'
                ? `Downloading the speech model… ${progressPercent}%`
                : state?.status === 'transcribing'
                  ? `Transcribing… ${progressPercent}%`
                  : state?.message}
            </span>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-[#c62828] hover:bg-[#ffebee]" onClick={cancel}>
              <X className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${state?.status === 'preparing' ? 5 : progressPercent}%` }} />
          </div>
          <p className="text-[11px] text-text-muted">
            {state?.device === 'webgpu' ? 'Using the graphics card. ' : state?.device === 'wasm' ? 'Using the processor (slower). ' : ''}
            Captions appear below as each part is finished. You can close this window; it keeps running.
          </p>
        </div>
      ) : null}

      {state && (state.status === 'done' || running) ? (
        <>
          <div className="border-b border-border bg-[#0f1650] px-4 py-3 text-center" aria-live="polite">
            <p className={cn('min-h-[2.75rem] text-[15px] font-medium leading-snug', activeText ? 'text-white' : 'text-white/40')}>
              {activeText ?? (segments.length === 0 ? 'Captions will appear here…' : '…')}
            </p>
          </div>
          <div ref={listRef} className="relative max-h-56 overflow-y-auto">
            {segments.map((segment, index) =>
              editing?.index === index ? (
                // Correcting a line: Enter saves, Escape cancels.
                <form
                  key={`${segment.start}-${index}`}
                  data-segment={index}
                  className="flex items-center gap-2 border-b border-border/60 bg-amber-50 px-4 py-1.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveLine();
                  }}
                >
                  <span className="w-12 shrink-0 font-mono text-[11px] text-text-muted">{formatClock(segment.start)}</span>
                  <input
                    autoFocus
                    value={editing.text}
                    onChange={(event) => setEditing({ index, text: event.target.value })}
                    onKeyDown={(event) => event.key === 'Escape' && setEditing(null)}
                    maxLength={2000}
                    aria-label={`Correct the line at ${formatClock(segment.start)}`}
                    className="h-8 min-w-0 flex-1 rounded border border-input bg-white px-2 text-[13px] text-text-main focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  <Button type="submit" size="sm" className="h-8 px-2.5 text-[11px]" disabled={savingLine}>
                    {savingLine ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-[11px]" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <div
                  key={`${segment.start}-${index}`}
                  data-segment={index}
                  className={cn('group flex items-stretch border-b border-border/60 last:border-b-0 hover:bg-primary/5', index === activeIndex && 'bg-primary/10')}
                >
                  <button
                    type="button"
                    onClick={() => onSeek(segment.start)}
                    className={cn('flex min-w-0 flex-1 gap-3 px-4 py-1.5 text-left text-[13px]', index === activeIndex && 'font-medium text-primary')}
                    title="Jump to this part"
                  >
                    <span className="w-12 shrink-0 font-mono text-[11px] leading-5 text-text-muted">{formatClock(segment.start)}</span>
                    <span className="leading-5">
                      {segment.text}
                      {segment.edited ? <span className="ml-1.5 rounded bg-amber-100 px-1 py-px text-[10px] font-semibold text-amber-800">corrected</span> : null}
                    </span>
                  </button>
                  {state.status === 'done' ? (
                    <button
                      type="button"
                      onClick={() => setEditing({ index, text: segment.text })}
                      className="shrink-0 px-3 text-text-muted opacity-60 hover:text-primary group-hover:opacity-100 focus:opacity-100"
                      aria-label={`Correct the line at ${formatClock(segment.start)}`}
                      title="Correct this line"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              )
            )}
            {state.status === 'done' && segments.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-text-muted">No speech was detected in this recording.</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
