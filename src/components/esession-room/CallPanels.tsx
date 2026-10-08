import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Hand, Lock, MicOff, Send, UserMinus, Video, VideoOff, VolumeX, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { confirmAction } from '@/components/ui/confirm';
import { clockTime, type ChatMessage, type Participant, type RollCall, type RoomRole, type RoomView } from '@/lib/esession-room';
import type { LinkQuality } from '@/lib/esession-rtc';
import type { Invitee } from '@/lib/attendance';
import { SignalBars } from '@/components/esession-room/VideoTile';

// Side panels of the call screen (a drawer in landscape, a bottom sheet in portrait). Dark like the stage.

type Act = (type: string, payload?: Record<string, unknown>) => Promise<boolean>;

const ROLE_ORDER: Record<RoomRole, number> = { presiding: 0, host: 1, participant: 2 };

function PanelButton({ children, onClick, tone = 'default', disabled, label }: { children: ReactNode; onClick: () => void; tone?: 'default' | 'primary' | 'danger'; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors disabled:opacity-40',
        tone === 'primary' ? 'bg-[#d4a72c] text-[#141b66] hover:bg-[#e0b743]' : tone === 'danger' ? 'bg-red-600/90 text-white hover:bg-red-600' : 'bg-white/10 text-white hover:bg-white/20'
      )}
    >
      {children}
    </button>
  );
}

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-white/55">{children}</h3>
      {aside}
    </div>
  );
}

function Initials({ abbr, group }: { abbr: string; group: 'member' | 'staff' }) {
  return (
    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', group === 'member' ? 'bg-[#d4a72c] text-[#141b66]' : 'bg-[#3949ab] text-white')} aria-hidden>
      {abbr}
    </span>
  );
}

export function PeoplePanel({
  room,
  selfPid,
  selfRole,
  qualities,
  roleLabelOf,
  act,
  onCallRoll,
  notHere,
}: {
  room: RoomView;
  selfPid: string;
  selfRole: RoomRole;
  qualities: Map<string, LinkQuality | null>;
  roleLabelOf: (participant: Participant) => string | null;
  act: Act;
  /** Asks first, then calls the roll. */
  onCallRoll: () => void;
  /** Invitees not in the e-session (and not waiting to be admitted), members first. */
  notHere: Invitee[];
}) {
  const isHost = selfRole === 'host';
  const moderator = selfRole !== 'participant';
  const people = [...room.participantsList].sort(
    (a, b) => Number(b.pid === room.floor) - Number(a.pid === room.floor) || ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || Number(a.group !== 'member') - Number(b.group !== 'member') || a.seq - b.seq
  );
  const hands = room.participantsList.filter((p) => p.hand !== null).sort((a, b) => (a.hand ?? 0) - (b.hand ?? 0));
  const membersPresent = room.participantsList.filter((p) => p.group === 'member').length;
  const lastCall = room.rollCalls.at(-1);
  const earlierCalls = room.rollCalls.slice(0, -1).reverse();
  const [showEarlier, setShowEarlier] = useState(false);
  const [showNotHere, setShowNotHere] = useState(false);
  const absentGroups = [
    { title: 'Members', list: notHere.filter((invitee) => invitee.group === 'member') },
    { title: 'Staff', list: notHere.filter((invitee) => invitee.group === 'staff') },
  ].filter((group) => group.list.length);

  const remove = async (participant: Participant) => {
    const confirmed = await confirmAction({
      title: `Remove ${participant.name}?`,
      description: 'They leave the e-session at once and cannot rejoin it. This is recorded in the audit trail.',
      confirmLabel: 'Remove',
      tone: 'destructive',
    });
    if (confirmed) void act('remove', { target: participant.pid });
  };

  return (
    <div className="pb-4">
      {isHost && room.waitingList.length ? (
        <section aria-label="Waiting to join">
          <SectionTitle aside={room.waitingList.length > 1 ? <PanelButton onClick={() => room.waitingList.forEach((w) => void act('admit', { target: w.pid }))}>Admit all</PanelButton> : null}>
            Waiting to join · {room.waitingList.length}
          </SectionTitle>
          <ul className="space-y-1 px-2">
            {room.waitingList.map((person) => (
              <li key={person.pid} className="flex items-center gap-3 rounded-lg bg-amber-400/10 px-2 py-2 ring-1 ring-inset ring-amber-400/30">
                <Initials abbr={person.abbr} group={person.group} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{person.name}</span>
                  <span className="block truncate text-[11px] text-white/60">
                    {person.detail} · {person.device}
                  </span>
                </span>
                <PanelButton onClick={() => void act('deny', { target: person.pid })} label={`Do not admit ${person.name}`}>
                  <X className="h-4 w-4" />
                </PanelButton>
                <PanelButton tone="primary" onClick={() => void act('admit', { target: person.pid })}>
                  <Check className="h-4 w-4" />
                  Admit
                </PanelButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hands.length || room.floor ? (
        <section aria-label="The floor">
          <SectionTitle aside={moderator && room.floor ? <PanelButton onClick={() => void act('floor', { target: null })}>Close the floor</PanelButton> : null}>
            Requests for the floor · {hands.length}
          </SectionTitle>
          <ol className="space-y-1 px-2">
            {hands.map((person, index) => (
              <li key={person.pid} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
                <span className="w-5 text-center text-xs font-bold text-amber-300">{index + 1}</span>
                <Hand className="h-4 w-4 shrink-0 text-amber-300" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{person.name}</span>
                  <span className="block text-[11px] text-white/60">Raised at {clockTime(person.hand ?? 0)}</span>
                </span>
                {moderator ? (
                  <PanelButton tone="primary" onClick={() => void act('floor', { target: person.pid })}>
                    Recognize
                  </PanelButton>
                ) : null}
              </li>
            ))}
            {hands.length === 0 ? <li className="px-2 py-1 text-xs text-white/55">No one is waiting for the floor.</li> : null}
          </ol>
        </section>
      ) : null}

      <section aria-label="In the e-session">
        <SectionTitle>In the e-session · {people.length}</SectionTitle>
        <ul className="space-y-0.5 px-2">
          {people.map((person) => {
            const isSelf = person.pid === selfPid;
            const roleLabel = roleLabelOf(person);
            return (
              <li key={person.pid} className={cn('flex items-center gap-3 rounded-lg px-2 py-2', person.pid === room.floor ? 'bg-[#d4a72c]/15 ring-1 ring-inset ring-[#d4a72c]/40' : 'hover:bg-white/5')}>
                <Initials abbr={person.abbr} group={person.group} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-white">
                      {person.name}
                      {isSelf ? ' (You)' : ''}
                    </span>
                    {person.hand ? <Hand className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Hand raised" /> : null}
                  </span>
                  <span className="block truncate text-[11px] text-white/60">
                    {[roleLabel, person.detail].filter((part, index, parts) => part && parts.indexOf(part) === index).join(' · ')}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-white/60">
                  {isSelf ? null : <SignalBars quality={qualities.get(person.pid) ?? null} />}
                  {person.video || person.screen ? <Video className="h-4 w-4" aria-label="Camera on" /> : <VideoOff className="h-4 w-4 text-white/35" aria-label="Camera off" />}
                  {person.audio ? null : <MicOff className="h-4 w-4 text-red-400" aria-label="Muted" />}
                </span>
                {moderator && !isSelf ? (
                  <span className="flex shrink-0 gap-1">
                    {person.audio ? (
                      <PanelButton onClick={() => void act('mute', { target: person.pid })} label={`Mute ${person.name}`}>
                        <VolumeX className="h-4 w-4" />
                      </PanelButton>
                    ) : null}
                    {isHost ? (
                      <PanelButton onClick={() => void remove(person)} label={`Remove ${person.name}`}>
                        <UserMinus className="h-4 w-4" />
                      </PanelButton>
                    ) : null}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {notHere.length ? (
        <section aria-label="Not yet here">
          <button
            type="button"
            onClick={() => setShowNotHere((open) => !open)}
            className="flex min-h-11 w-full items-center justify-between gap-2 px-4 pt-2 text-left hover:text-white"
            aria-expanded={showNotHere}
          >
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-white/55">Not yet here · {notHere.length}</h3>
            <ChevronDown className={cn('h-4 w-4 text-white/60 transition-transform', showNotHere && 'rotate-180')} />
          </button>
          {showNotHere
            ? absentGroups.map((group) => (
                <div key={group.title}>
                  <p className="px-4 pb-1 pt-2 text-[11px] font-semibold text-white/45">
                    {group.title} · {group.list.length}
                  </p>
                  <ul className="space-y-1 px-2">
                    {group.list.map((invitee) => (
                      <li key={invitee.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 opacity-75">
                        <Initials abbr={invitee.abbr} group={invitee.group} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">{invitee.name}</span>
                          <span className="block truncate text-[11px] text-white/60">{invitee.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            : null}
        </section>
      ) : null}

      {room.type === 'Meeting' ? (
        <p className="mx-3 mt-4 rounded-xl bg-white/5 p-4 text-xs text-white/70 ring-1 ring-inset ring-white/10">This is a meeting, not an official session of the body: there is no quorum or roll call.</p>
      ) : (
      <section aria-label="Quorum" className="mx-3 mt-4 rounded-xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              Members present: {membersPresent} of {room.memberTotal}
            </p>
            <p className={cn('text-xs', membersPresent >= room.quorum ? 'text-green-300' : 'text-amber-300')}>
              {membersPresent >= room.quorum ? 'Enough for a quorum' : `${room.quorum - membersPresent} more needed for a quorum of ${room.quorum}`}
            </p>
          </div>
          {moderator ? (
            <PanelButton tone="primary" onClick={onCallRoll}>
              <ClipboardCheck className="h-4 w-4" />
              Call the roll
            </PanelButton>
          ) : null}
        </div>
      </section>
      )}

      {lastCall ? (
        <section id="es-roll-call" aria-label="Roll call" className="mx-3 mt-3 scroll-mt-3 rounded-xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-white/55">Latest roll call</h3>
          <RollCallSummary call={lastCall} />
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-white/50">Present · {lastCall.presentCount}</p>
          {lastCall.present.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {lastCall.present.map((person) => (
                <li key={person.inviteeId} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white">
                  {person.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-white/60">No members were in the e-session.</p>
          )}
          {lastCall.memberTotal > lastCall.presentCount ? (
            <p className="mt-2 text-xs text-white/60">
              {lastCall.memberTotal - lastCall.presentCount} of {lastCall.memberTotal} members were not in the e-session.
            </p>
          ) : null}
          {earlierCalls.length ? (
            <div className="mt-3 border-t border-white/10 pt-2">
              <button type="button" onClick={() => setShowEarlier((open) => !open)} className="flex min-h-10 w-full items-center justify-between text-left text-xs font-semibold text-white/80 hover:text-white" aria-expanded={showEarlier}>
                Earlier roll calls ({earlierCalls.length})
                <ChevronDown className={cn('h-4 w-4 transition-transform', showEarlier && 'rotate-180')} />
              </button>
              {showEarlier ? (
                <ul className="space-y-2">
                  {earlierCalls.map((call) => (
                    <li key={call.at} className="rounded-lg bg-white/5 px-3 py-2">
                      <RollCallSummary call={call} compact />
                      <p className="mt-1 text-[11px] text-white/55">{call.present.map((person) => person.name).join(', ') || 'No members present'}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {isHost ? (
        <section aria-label="Room settings" className="mx-3 mt-3 space-y-1 rounded-xl bg-white/5 p-2 ring-1 ring-inset ring-white/10">
          <ToggleRow label="Lock the e-session" hint="No one else can ask to join" checked={room.locked} onChange={(on) => void act('lock', { locked: on })} icon={<Lock className="h-4 w-4" />} />
          <ToggleRow label="Admit invitees automatically" hint="Skip the waiting room" checked={room.autoAdmit} onChange={(on) => void act('auto-admit', { on })} icon={<Check className="h-4 w-4" />} />
          <button type="button" onClick={() => void act('mute-all')} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left text-sm font-semibold text-white hover:bg-white/10">
            <VolumeX className="h-4 w-4" />
            Mute everyone{room.floor ? ' except the speaker' : ''}
          </button>
        </section>
      ) : selfRole === 'presiding' ? (
        <div className="mx-3 mt-3">
          <button type="button" onClick={() => void act('mute-all')} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-white/5 px-3 text-left text-sm font-semibold text-white ring-1 ring-inset ring-white/10 hover:bg-white/10">
            <VolumeX className="h-4 w-4" />
            Mute everyone{room.floor ? ' except the speaker' : ''}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** When, by whom, how many, and whether there was a quorum. */
function RollCallSummary({ call, compact = false }: { call: RollCall; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'mt-1'}>
      <p className={cn('font-semibold text-white', compact ? 'text-xs' : 'text-sm')}>
        {call.presentCount} of {call.memberTotal} members present ·{' '}
        <span className={call.hasQuorum ? 'text-green-300' : 'text-amber-300'}>{call.hasQuorum ? 'quorum declared' : `no quorum (${call.quorum} needed)`}</span>
      </p>
      <p className="text-[11px] text-white/55">
        {clockTime(call.at)} · called by {call.by.name}
      </p>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange, icon }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void; icon: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-white/10">
      <span className="text-white/80">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="block text-[11px] text-white/55">{hint}</span>
      </span>
      <span className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-[#d4a72c]' : 'bg-white/20')}>
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </span>
    </button>
  );
}

/** The server keeps the first 500 characters of a message, so the box stops there too. */
const CHAT_MAX = 500;
/** The counter appears from here, so the limit never comes as a surprise. */
const CHAT_WARN_AT = 400;
/** The box grows with the message up to this height (about five lines), then scrolls. */
const CHAT_MAX_HEIGHT = 144;

export function ChatPanel({ messages, selfPid, onSend }: { messages: ChatMessage[]; selfPid: string; onSend: (text: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // Set when a paste did not fit, until the message is shortened or sent.
  const [pasteCut, setPasteCut] = useState(false);
  const atLimit = draft.length >= CHAT_MAX;
  const box = useRef<HTMLTextAreaElement>(null);

  // Grow (or shrink) the box to fit what is typed.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    // scrollHeight leaves out the border, which the height includes.
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight + border, CHAT_MAX_HEIGHT)}px`;
  }, [draft]);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    if (await onSend(text)) {
      setDraft('');
      setPasteCut(false);
    }
    setSending(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ol ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? <li className="pt-6 text-center text-sm text-white/55">No messages yet. Messages are part of the e-session record.</li> : null}
        {messages.map((message) => {
          const mine = message.from.pid === selfPid;
          return (
            <li key={message.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
              <span className="mb-0.5 text-[11px] text-white/55">
                {mine ? 'You' : message.from.name} · {clockTime(message.at)}
              </span>
              <span className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm', mine ? 'rounded-br-sm bg-[#3949ab] text-white' : 'rounded-bl-sm bg-white/10 text-white')}>{message.text}</span>
            </li>
          );
        })}
      </ol>
      <form onSubmit={submit} className="border-t border-white/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {/* Right above the box, where the eyes are while typing. */}
        {draft.length >= CHAT_WARN_AT || pasteCut ? (
          <p id="es-chat-limit" className={cn('mb-2 flex items-start justify-between gap-3 text-xs', atLimit || pasteCut ? 'text-amber-300' : 'text-white/55')} aria-live="polite">
            <span>
              {pasteCut
                ? 'Your paste was cut at the limit. Send this part, then the rest separately.'
                : atLimit
                  ? 'Character limit reached. Send this, then continue in another message.'
                  : null}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {draft.length} / {CHAT_MAX}
            </span>
          </p>
        ) : null}
        <div className="flex items-end gap-2">
        <label htmlFor="es-chat" className="sr-only">
          Message to everyone
        </label>
        <textarea
          ref={box}
          id="es-chat"
          rows={1}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (e.target.value.length < CHAT_MAX) setPasteCut(false);
          }}
          onKeyDown={(e) => {
            // Enter sends and Shift+Enter starts a new line; on touch screens Enter is a new line and the button sends.
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || window.matchMedia('(pointer: coarse)').matches) return;
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }}
          onPaste={(e) => {
            const input = e.currentTarget;
            const replaced = (input.selectionEnd ?? 0) - (input.selectionStart ?? 0);
            if (draft.length - replaced + e.clipboardData.getData('text').length > CHAT_MAX) setPasteCut(true);
          }}
          maxLength={CHAT_MAX}
          autoComplete="off"
          placeholder="Message to everyone"
          aria-describedby={draft.length >= CHAT_WARN_AT || pasteCut ? 'es-chat-limit' : undefined}
          className={cn(
            'block min-h-12 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border bg-white/10 px-3 py-[11px] text-base leading-6 text-white placeholder:text-white/45 outline-none sm:text-sm sm:leading-6',
            atLimit || pasteCut ? 'border-amber-400/70 focus:border-amber-400' : 'border-white/15 focus:border-[#d4a72c]'
          )}
        />
        <button type="submit" disabled={!draft.trim() || sending} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#d4a72c] text-[#141b66] disabled:opacity-40" aria-label="Send">
          <Send className="h-5 w-5" />
        </button>
        </div>
      </form>
    </div>
  );
}

export function AgendaPanel({ room, canControl, act }: { room: RoomView; canControl: boolean; act: Act }) {
  const currentRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [room.agendaIndex]);
  const setItem = (index: number) => void act('agenda', { index });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {canControl ? (
        <div className="flex items-center gap-2 border-b border-white/10 p-3">
          <PanelButton onClick={() => setItem(room.agendaIndex - 1)} disabled={room.agendaIndex <= 0} label="Previous item">
            <ChevronLeft className="h-4 w-4" />
            Previous
          </PanelButton>
          <span className="flex-1 text-center text-xs text-white/60">
            Item {room.agendaIndex + 1} of {room.agenda.length}
          </span>
          <PanelButton tone="primary" onClick={() => setItem(room.agendaIndex + 1)} disabled={room.agendaIndex >= room.agenda.length - 1} label="Next item">
            Next
            <ChevronRight className="h-4 w-4" />
          </PanelButton>
        </div>
      ) : null}
      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {room.agenda.map((item, index) => {
          const current = index === room.agendaIndex;
          const done = index < room.agendaIndex;
          const content = (
            <>
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', current ? 'bg-[#d4a72c] text-[#141b66]' : done ? 'bg-white/15 text-white/70' : 'bg-white/5 text-white/50')}>
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className={cn('min-w-0 flex-1 text-sm', current ? 'font-semibold text-white' : done ? 'text-white/55' : 'text-white/80')}>
                {item}
                {current ? <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#e8c766]">Under consideration</span> : null}
              </span>
            </>
          );
          return (
            <li key={index} ref={current ? currentRef : undefined}>
              {canControl && !current ? (
                <button type="button" onClick={() => setItem(index)} className="flex min-h-12 w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/5">
                  {content}
                </button>
              ) : (
                <div className={cn('flex min-h-12 items-start gap-3 rounded-lg px-2 py-2', current && 'bg-[#d4a72c]/15 ring-1 ring-inset ring-[#d4a72c]/40')}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
