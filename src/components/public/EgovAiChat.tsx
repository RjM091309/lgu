import { Fragment, useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, FileText, Loader2, RotateCcw, Send, ShieldCheck, Square, X } from 'lucide-react';
import { BotAvatar } from '@/components/public/CapasBot';
import { ask, getEgovAiMode, type EgovAiMode, type PendingConfirmation } from '@/lib/egovai';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** The question this answer is for; resent on retry or after an approval. */
  question?: string;
  status?: 'streaming' | 'done' | 'error';
  progress?: string;
  sources?: string[];
  pending?: PendingConfirmation & { resolution?: 'approved' | 'declined' };
  /** Suggested next questions, shown under the latest answer. */
  followUps?: string[];
}

const SUGGESTIONS = {
  EN: [
    'When is the next session?',
    'Is there an ordinance on garbage?',
    'What is the status of the tricycle franchising ordinance?',
    'How does an ordinance become law?',
    'How do I contact the SB Secretariat?',
    'Subscribe me to session notices',
  ],
  FIL: [
    'Kailan ang susunod na sesyon?',
    'May ordinansa ba tungkol sa basura?',
    'Ano na ang lagay ng ordinansa sa traysikel?',
    'Paano naipapasa ang isang ordinansa?',
    'Paano makipag-ugnayan sa SB Secretariat?',
    'Abisuhan ako sa mga sesyon',
  ],
} as const;

const MAX_QUESTION_LENGTH = 2000;

let messageCounter = 0;
const newId = () => `m${Date.now()}-${messageCounter++}`;

// Minimal, safe rendering of the answer's markdown: paragraphs, "- " bullet lists, **bold** and _italic_.
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function AnswerText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        const lines = block.split('\n');
        if (lines.every((line) => /^\s*[-*•]\s+/.test(line))) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {lines.map((line, i) => (
                <li key={i}>{renderInline(line.replace(/^\s*[-*•]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            {lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {renderInline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

// Fixed labels of the chat window in the portal's language; the assistant's answers are not translated here.
const LABELS = {
  EN: {
    open: 'Open the Ask LIMS chat assistant',
    title: 'Ask LIMS',
    online: 'AI Assistant · Online',
    dialog: 'Ask LIMS chat assistant',
    assistant: 'AI Assistant',
    newChatAria: 'Start a new conversation',
    newChat: 'New conversation',
    close: 'Close chat',
    greetingStart: "Good day! I'm the",
    greetingEnd: ' assistant. Ask me about ordinances, resolutions, and session schedules.',
    thinking: 'Thinking…',
    retry: 'Try again',
    basedOn: 'Based on:',
    approved: 'Approved',
    cancelled: 'Cancelled',
    yes: 'Yes, continue',
    no: 'No',
    question: 'Your question',
    answerFirst: 'Please answer the question above first…',
    ask: 'Ask about ordinances, sessions…',
    stop: 'Stop response',
    send: 'Send',
    disclaimer: 'Answers are AI-generated and may contain errors. Please verify with the SB Secretariat.',
  },
  FIL: {
    open: 'Buksan ang chat assistant na Magtanong sa LIMS',
    title: 'Magtanong sa LIMS',
    online: 'AI na Katulong · Online',
    dialog: 'Chat assistant na Magtanong sa LIMS',
    assistant: 'AI na Katulong',
    newChatAria: 'Magsimula ng bagong usapan',
    newChat: 'Bagong usapan',
    close: 'Isara ang chat',
    greetingStart: 'Magandang araw! Ako ang katulong ng',
    greetingEnd: '. Magtanong tungkol sa mga ordinansa, resolusyon, at iskedyul ng mga sesyon.',
    thinking: 'Nag-iisip…',
    retry: 'Subukang muli',
    basedOn: 'Batay sa:',
    approved: 'Inaprubahan',
    cancelled: 'Kinansela',
    yes: 'Oo, magpatuloy',
    no: 'Hindi',
    question: 'Ang iyong tanong',
    answerFirst: 'Pakisagot muna ang tanong sa itaas…',
    ask: 'Magtanong tungkol sa ordinansa, sesyon…',
    stop: 'Ihinto ang sagot',
    send: 'Ipadala',
    disclaimer: 'Gawa ng AI ang mga sagot at maaaring may mali. Pakikumpirma sa SB Secretariat.',
  },
} as const;

export function EgovAiChat({ lang = 'EN' }: { lang?: 'EN' | 'FIL' }) {
  const L = LABELS[lang];
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<EgovAiMode | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  // On phones the launcher would cover the hero's search button, so there it shows once the page is scrolled.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isBusy = messages.some((message) => message.status === 'streaming');
  const lastMessage = messages[messages.length - 1];
  const awaitingConfirmation = messages.some((message) => message.pending && !message.pending.resolution);

  useEffect(() => {
    if (open && mode === null) getEgovAiMode().then(setMode);
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, mode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  const updateMessage = (id: string, patch: (message: ChatMessage) => Partial<ChatMessage>) =>
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, ...patch(message) } : message)));

  const runQuestion = async (question: string, confirmation?: { token: string; approved: boolean }) => {
    const replyId = newId();
    setMessages((current) => [...current, { id: replyId, role: 'assistant', content: '', question, status: 'streaming' }]);

    const controller = new AbortController();
    abortRef.current = controller;
    const engineMode = mode ?? (await getEgovAiMode());
    if (mode === null) setMode(engineMode);

    try {
      await ask(engineMode, {
        question,
        sessionId,
        confirmation,
        lang,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'progress') updateMessage(replyId, () => ({ progress: event.label }));
          else if (event.type === 'chunk') updateMessage(replyId, (message) => ({ content: message.content + event.content }));
          else if (event.type === 'error') updateMessage(replyId, () => ({ status: 'error', progress: undefined, content: event.message }));
          else {
            if (event.sessionId) setSessionId(event.sessionId);
            updateMessage(replyId, () => ({
              status: 'done',
              progress: undefined,
              sources: event.sources,
              pending: event.pendingConfirmation ?? undefined,
              followUps: event.followUps,
            }));
          }
        },
      });
    } catch (error) {
      const stopped = (error as Error).name === 'AbortError';
      updateMessage(replyId, (message) => ({
        status: stopped && message.content ? 'done' : 'error',
        progress: undefined,
        content: stopped ? message.content || 'Response stopped.' : 'Could not reach the assistant. Check your internet connection and try again.',
      }));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const send = (text: string) => {
    const question = text.trim().slice(0, MAX_QUESTION_LENGTH);
    if (!question || isBusy || awaitingConfirmation) return;
    setMessages((current) => [...current, { id: newId(), role: 'user', content: question }]);
    setInput('');
    runQuestion(question);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(input);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(input);
    }
  };

  const retry = (message: ChatMessage) => {
    if (!message.question || isBusy) return;
    setMessages((current) => current.filter((m) => m.id !== message.id));
    runQuestion(message.question);
  };

  // eGovAI contract: on Yes resend the same question and session with the token; on No cancel locally.
  const resolveConfirmation = (message: ChatMessage, approved: boolean) => {
    if (!message.pending || !message.question) return;
    updateMessage(message.id, (m) => ({ pending: m.pending && { ...m.pending, resolution: approved ? 'approved' : 'declined' } }));
    if (approved) runQuestion(message.question, { token: message.pending.token, approved: true });
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setSessionId(null);
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            ref={launcherRef}
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={cn('group fixed bottom-5 right-4 z-40 flex items-center gap-3 rounded-full focus-visible:outline-none sm:right-6', !scrolled && 'max-sm:hidden')}
            aria-label={L.open}
          >
            <span className="relative hidden overflow-hidden rounded-2xl border border-[#18237f]/10 bg-white py-2 pl-4 pr-4 text-left shadow-[0_10px_30px_-10px_rgba(10,15,61,0.45)] transition-transform duration-200 group-hover:-translate-x-1 group-focus-visible:ring-2 group-focus-visible:ring-primary/40 sm:block">
              <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-gradient-to-b from-[#e8c766] to-[#d4a72c]" aria-hidden />
              <span className="block text-sm font-bold leading-tight text-[#18237f]">{L.title}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" aria-hidden />
                {L.online}
              </span>
            </span>
            <span className="relative rounded-full shadow-[0_10px_28px_-6px_rgba(24,35,127,0.6)] ring-2 ring-white transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-primary/30">
              <BotAvatar size="lg" animated online />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label={L.dialog}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onKeyDown={(event) => event.key === 'Escape' && close()}
            className="fixed inset-x-4 bottom-4 z-40 flex h-[min(620px,calc(100dvh-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[400px]"
          >
            <header className="relative flex items-start gap-3 bg-gradient-to-br from-[#232f9a] via-[#18237f] to-[#0a0f3d] px-4 py-3.5 text-white">
              <span className="pointer-events-none absolute inset-x-6 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[#d4a72c]/80 to-transparent" aria-hidden />
              <BotAvatar size="md" online />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold leading-tight">{L.title}</h2>
                </div>
                <p className="mt-0.5 text-xs text-white/75">
                  {L.assistant}
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                disabled={!messages.length}
                className="rounded-md p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white disabled:opacity-40"
                aria-label={L.newChatAria}
                title={L.newChat}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label={L.close}
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-background px-4 py-4" aria-live="polite">
              <div className="rounded-xl border border-border bg-surface p-3.5 text-sm leading-6 text-text-main">
                <p>
                  {L.greetingStart} <strong>LIMS</strong>
                  {L.greetingEnd}
                </p>
              </div>

              {!messages.length && (
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS[lang].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      className="rounded-full border border-primary/25 bg-surface px-3 py-1.5 text-left text-xs font-medium text-primary transition hover:border-primary hover:bg-primary/5"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((message) =>
                message.role === 'user' ? (
                  <div key={message.id} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm leading-6 text-white">
                      {message.content}
                    </p>
                  </div>
                ) : (
                  <div key={message.id} className="flex gap-2.5">
                    <BotAvatar size="sm" className="mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-2">
                      {message.status === 'streaming' && !message.content && (
                        <p className="flex items-center gap-2 text-xs text-text-muted">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {message.progress ?? L.thinking}
                        </p>
                      )}

                      {message.content && (
                        <div
                          className={cn(
                            'break-words rounded-2xl rounded-tl-sm border px-3.5 py-2.5 text-sm leading-6',
                            message.status === 'error' ? 'border-[#c62828]/30 bg-[#c62828]/5 text-[#8e1c1c]' : 'border-border bg-surface text-text-main'
                          )}
                        >
                          <AnswerText text={message.content} />
                          {message.status === 'streaming' && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary/60 align-middle" />}
                        </div>
                      )}

                      {message.status === 'error' && message.question && (
                        <button
                          type="button"
                          onClick={() => retry(message)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {L.retry}
                        </button>
                      )}

                      {message.sources && message.sources.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-text-muted">{L.basedOn}</span>
                          {message.sources.map((source) => (
                            <span
                              key={source}
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] font-medium text-text-muted"
                            >
                              <FileText className="h-3 w-3" />
                              {source}
                            </span>
                          ))}
                        </div>
                      )}

                      {message === lastMessage && message.status === 'done' && !message.pending && message.followUps && message.followUps.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {message.followUps.map((followUp) => (
                            <button
                              key={followUp}
                              type="button"
                              onClick={() => send(followUp)}
                              className="rounded-full border border-primary/25 bg-surface px-2.5 py-1 text-left text-xs font-medium text-primary transition hover:border-primary hover:bg-primary/5"
                            >
                              {followUp}
                            </button>
                          ))}
                        </div>
                      )}

                      {message.pending && (
                        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
                          <p className="flex items-start gap-2 text-sm font-medium text-text-main">
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            {message.pending.message}
                          </p>
                          {message.pending.resolution ? (
                            <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                              {message.pending.resolution === 'approved' ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5" />}
                              {message.pending.resolution === 'approved' ? L.approved : L.cancelled}
                            </p>
                          ) : (
                            <div className="mt-2.5 flex gap-2">
                              <button
                                type="button"
                                onClick={() => resolveConfirmation(message, true)}
                                className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                              >
                                {L.yes}
                              </button>
                              <button
                                type="button"
                                onClick={() => resolveConfirmation(message, false)}
                                className="rounded-md border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-text-main hover:bg-muted"
                              >
                                {L.no}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            <form onSubmit={onSubmit} className="border-t border-border bg-surface px-3 pb-2 pt-3">
              <div className="flex items-end gap-2">
                <label htmlFor="egovai-question" className="sr-only">
                  {L.question}
                </label>
                <textarea
                  id="egovai-question"
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  rows={1}
                  maxLength={MAX_QUESTION_LENGTH}
                  placeholder={awaitingConfirmation ? L.answerFirst : L.ask}
                  disabled={awaitingConfirmation}
                  className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                />
                {isBusy ? (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-text-main transition hover:bg-muted"
                    aria-label={L.stop}
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim() || awaitingConfirmation}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition hover:opacity-90 disabled:opacity-40"
                    aria-label={L.send}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-center text-[10.5px] leading-4 text-text-muted">
                {L.disclaimer}
              </p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
