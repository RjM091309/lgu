import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Circle,
  ClipboardCheck,
  Hand,
  LayoutGrid,
  ListOrdered,
  Loader2,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  Settings,
  Square,
  Users,
  Video,
  VideoOff,
  VolumeX,
  X,
  UserRoundCheck,
  RectangleHorizontal,
  Maximize,
  Minimize,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { confirmAction } from '@/components/ui/confirm';
import type { Session } from '@/lib/mock-data';
import type { PeerInfo } from '@/lib/esession-rtc';
import { elapsedClock, roleLabelFor, type ChatMessage, type Participant, type RoomRole, type RoomView } from '@/lib/esession-room';
import type { LocalMedia } from '@/components/esession-room/use-local-media';
import { RemoteAudio, VideoTile, type TileActions } from '@/components/esession-room/VideoTile';
import { AgendaPanel, ChatPanel, PeoplePanel } from '@/components/esession-room/CallPanels';
import { useNow } from '@/components/esession-room/es-ui';
import { PeopleFloat, ShareStage, useAutoHide } from '@/components/esession-room/PresentationStage';
import type { Fullscreen, FullscreenNotice } from '@/components/esession-room/use-fullscreen';

export type Panel = 'people' | 'chat' | 'agenda';
type Layout = 'auto' | 'gallery' | 'speaker';
type Act = (type: string, payload?: Record<string, unknown>) => Promise<boolean>;

const GAP = 8;

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, ...size };
}

/**
 * `value`, but only once it has held for `onMs` (to turn on) or `offMs` (to turn off), so a signal that flickers
 * around a threshold doesn't make the screen flicker with it.
 */
function useSteady(value: boolean, onMs: number, offMs: number) {
  const [steady, setSteady] = useState(value);
  useEffect(() => {
    if (value === steady) return;
    const timer = window.setTimeout(() => setSteady(value), value ? onMs : offMs);
    return () => window.clearTimeout(timer);
  }, [value, steady, onMs, offMs]);
  return steady;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Columns and tile size that make the tiles as large as possible in the space available. */
const fitGrid = (count: number, width: number, height: number, aspect: number) => {
  let best = { cols: 1, width: 0, height: 0 };
  for (let cols = 1; cols <= Math.max(1, count); cols += 1) {
    const rows = Math.ceil(count / cols);
    let w = (width - GAP * (cols - 1)) / cols;
    let h = w / aspect;
    if (h * rows + GAP * (rows - 1) > height) {
      h = (height - GAP * (rows - 1)) / rows;
      w = h * aspect;
    }
    if (w * h > best.width * best.height) best = { cols, width: Math.floor(w), height: Math.floor(h) };
  }
  return best;
};

/** A tile narrower than this gets hard to read, so the gallery scrolls instead (phones in a full sitting). */
const MIN_TILE_WIDTH = 150;

export interface CallStageProps {
  session: Session | undefined;
  room: RoomView | null;
  selfPid: string;
  selfRole: RoomRole;
  media: LocalMedia;
  peers: Map<string, PeerInfo>;
  speaking: Set<string>;
  chat: ChatMessage[];
  unread: number;
  panel: Panel | null;
  setPanel: (panel: Panel | null) => void;
  screenStream: MediaStream | null;
  canShare: boolean;
  recordingHere: boolean;
  streamReconnecting: boolean;
  floorPrompt: boolean;
  onDismissFloorPrompt: () => void;
  act: Act;
  onSendChat: (text: string) => Promise<boolean>;
  onToggleShare: () => void;
  onToggleRecording: () => void;
  onOpenSettings: () => void;
  onLeave: () => void;
  fullscreen: Fullscreen;
}

export function CallStage(props: CallStageProps) {
  const { room, selfPid, selfRole, media, peers, speaking, panel, setPanel, act, session } = props;
  const isWide = useMediaQuery('(min-width: 1024px)');
  const [layout, setLayout] = useState<Layout>('auto');
  // Pinned by account, so the pin survives that person reconnecting (which gives them a new pid).
  const [pinned, setPinned] = useState<string | null>(null);
  const area = useElementSize<HTMLDivElement>();
  const topBars = useElementSize<HTMLDivElement>();
  const bottomBar = useElementSize<HTMLDivElement>();
  const moderator = selfRole !== 'participant';
  const isHost = selfRole === 'host';

  const participants = room?.participantsList ?? [];
  const me = participants.find((p) => p.pid === selfPid);
  const sharer = participants.find((p) => p.screen);
  const floorHolder = participants.find((p) => p.pid === room?.floor);
  const pinnedPerson = participants.find((p) => p.inviteeId === pinned);
  // A new screen share or a new floor holder brings everyone back to the automatic view, even after picking one by hand.
  const sharerId = sharer?.inviteeId ?? null;
  const floorId = floorHolder?.inviteeId ?? null;
  useEffect(() => {
    if (sharerId) setLayout('auto');
  }, [sharerId]);
  useEffect(() => {
    if (floorId) setLayout('auto');
  }, [floorId]);
  // Most recent speaker other than me, for the speaker view when nobody has the floor.
  const lastSpeaker = useRef<string | null>(null);
  const loudOther = [...speaking].find((pid) => pid !== selfPid && participants.some((p) => p.pid === pid));
  if (loudOther) lastSpeaker.current = loudOther;
  // Who takes the stage: my own pin, then a screen share, then the floor. Someone sharing or holding the floor sees
  // the next one down (or the last speaker, or the presiding officer) instead of themselves; a pin on myself is honoured.
  const spotlight = pinnedPerson ?? sharer ?? floorHolder ?? null;
  const mode: 'gallery' | 'speaker' = layout === 'auto' ? (spotlight && participants.length > 1 ? 'speaker' : 'gallery') : layout;
  const shown = pinnedPerson ?? [sharer, floorHolder].find((p) => p && p.pid !== selfPid) ?? null;
  const main =
    mode === 'speaker'
      ? (shown ??
        participants.find((p) => p.pid === lastSpeaker.current) ??
        participants.find((p) => p.role === 'presiding' && p.pid !== selfPid) ??
        participants.find((p) => p.pid !== selfPid) ??
        me ??
        null)
      : null;
  // What my pin keeps off the stage, so I can tell and switch back.
  const hiddenByPin = pinnedPerson ? [sharer, floorHolder].find((p) => p && p.pid !== selfPid && p.pid !== pinnedPerson.pid) : undefined;
  // Pinned first, then the screen share and the floor, then everyone in joining order.
  const rank = (p: Participant) => (p === pinnedPerson ? 0 : p === sharer ? 1 : p === floorHolder ? 2 : 3);
  const ordered = [...participants].sort((a, b) => rank(a) - rank(b));

  // Presentation layout: someone else's screen share is on my stage, so it fills the screen, the others float in a
  // corner, and the bars hide while idle. The presenter keeps the normal layout with a "you are sharing" tile.
  const presenting = mode === 'speaker' && !!main && main.screen && main.pid !== selfPid;
  const floatPeople = presenting ? ordered.filter((p) => p.pid !== main.pid) : [];
  const floatFocus =
    floatPeople.find((p) => p.pid === room?.floor) ??
    floatPeople.find((p) => p.pid === lastSpeaker.current) ??
    floatPeople.find((p) => p.role === 'presiding' && p.pid !== selfPid) ??
    floatPeople.find((p) => p.pid !== selfPid);

  const roleLabelOf = (p: Participant) => (p.role === 'participant' ? null : session ? roleLabelFor(p.role, session) : p.role === 'host' ? 'Host' : 'Presiding Officer');
  const streamOf = (p: Participant) => (p.pid === selfPid ? (props.screenStream ?? media.stream) : (peers.get(p.pid)?.stream ?? null));

  const actionsFor = (p: Participant): TileActions => {
    const isSelf = p.pid === selfPid;
    return {
      onPin:
        participants.length > 1
          ? () => {
              if (pinned === p.inviteeId) setPinned(null);
              else {
                setPinned(p.inviteeId);
                setLayout('auto');
              }
            }
          : undefined,
      pinned: pinned === p.inviteeId,
      onFloor: moderator ? () => void act('floor', { target: room?.floor === p.pid ? null : p.pid }) : undefined,
      onMute: moderator && !isSelf && p.audio ? () => void act('mute', { target: p.pid }) : undefined,
      onRemove:
        isHost && !isSelf
          ? async () => {
              const confirmed = await confirmAction({
                title: `Remove ${p.name}?`,
                description: 'They leave the e-session at once and cannot rejoin it. This is recorded in the audit trail.',
                confirmLabel: 'Remove',
                tone: 'destructive',
              });
              if (confirmed) void act('remove', { target: p.pid });
            }
          : undefined,
    };
  };

  const tile = (p: Participant, className: string, style?: CSSProperties, large = false) => {
    const peer = peers.get(p.pid);
    return (
      <div key={p.pid} className={className} style={style}>
        <VideoTile
          participant={p}
          stream={streamOf(p)}
          isSelf={p.pid === selfPid}
          speaking={speaking.has(p.pid)}
          hasFloor={room?.floor === p.pid}
          link={peer?.link ?? (p.pid === selfPid ? null : 'connecting')}
          quality={peer?.quality ?? null}
          roleLabel={roleLabelOf(p)}
          actions={actionsFor(p)}
          large={large}
          presenter={p.pid === selfPid && p.screen ? { onStop: props.onToggleShare } : undefined}
          className="h-full w-full"
        />
      </div>
    );
  };

  // Gallery sizing: wider tiles in landscape, taller ones in portrait.
  const portrait = area.height > area.width;
  const grid = fitGrid(participants.length, area.width, area.height, portrait ? 4 / 3 : 16 / 9);
  const scrollGallery = grid.width > 0 && grid.width < MIN_TILE_WIDTH;
  const scrollCols = Math.max(2, Math.floor((area.width + GAP) / (MIN_TILE_WIDTH + GAP)));
  const scrollTile = { width: Math.floor((area.width - GAP * (scrollCols - 1)) / scrollCols), height: Math.floor((area.width - GAP * (scrollCols - 1)) / scrollCols / (4 / 3)) };

  const waitingCount = isHost ? (room?.waitingList.length ?? 0) : 0;
  const othersPoor = [...peers.values()].filter((peer) => peer.quality === 'poor').length;
  const poorConnection = peers.size > 0 && othersPoor >= Math.max(1, Math.ceil(peers.size / 2));

  // Connection warnings wait out brief dips: unstable after 5 s of poor quality (clear after 10 s of good), and
  // reconnecting after 2 s. A dismissed warning stays away until the connection has recovered.
  const unstable = useSteady(poorConnection, 5000, 10_000);
  const [unstableDismissed, setUnstableDismissed] = useState(false);
  useEffect(() => {
    if (!unstable) setUnstableDismissed(false);
  }, [unstable]);
  const reconnecting = useSteady(props.streamReconnecting, 2000, 0);
  // Only an open panel keeps the bars up; banners show on their own, over the share if the bars are hidden.
  const bars = useAutoHide(presenting, !!panel);
  // While presenting the bars float over the share, so things placed on the stage keep clear of them.
  const insetTop = presenting && bars.visible ? topBars.height : 0;
  const insetBottom = presenting && bars.visible ? bottomBar.height : 0;
  const barSlide = (edge: 'top' | 'bottom') =>
    presenting ? cn('absolute inset-x-0 z-30 transition-transform duration-300', edge === 'top' ? 'top-0' : 'bottom-0', !bars.visible && (edge === 'top' ? '-translate-y-full' : 'translate-y-full')) : undefined;

  const panelBody =
    room && panel ? (
      panel === 'people' ? (
        <PeoplePanel room={room} selfPid={selfPid} selfRole={selfRole} qualities={new Map([...peers].map(([pid, peer]) => [pid, peer.quality]))} roleLabelOf={roleLabelOf} act={act} />
      ) : panel === 'chat' ? (
        <ChatPanel messages={props.chat} selfPid={selfPid} onSend={props.onSendChat} />
      ) : (
        <AgendaPanel room={room} canControl={moderator} act={act} />
      )
    ) : null;

  return (
    <div data-fixed-dark className={cn('fixed inset-0 z-40 flex flex-col text-white', presenting ? 'bg-black' : 'bg-[#070b1f]')}>
      <div ref={topBars.ref} className={barSlide('top')} {...(presenting ? bars.barProps : {})}>
      <TopBar {...props} membersPresent={participants.filter((p) => p.group === 'member').length} mode={mode} onToggleLayout={() => setLayout(mode === 'gallery' ? 'speaker' : 'gallery')} />

      {room && room.agenda.length ? (
        <button
          type="button"
          onClick={() => setPanel(panel === 'agenda' ? null : 'agenda')}
          className="flex min-h-9 w-full items-center gap-2 border-b border-white/10 bg-[#0c1230] px-3 text-left text-xs text-white/80 hover:bg-[#111a40] sm:px-4"
        >
          <ListOrdered className="h-3.5 w-3.5 shrink-0 text-[#e8c766]" />
          <span className="shrink-0 font-semibold text-[#e8c766]">Now:</span>
          <span className="truncate">
            {room.agendaIndex + 1}. {room.agenda[room.agendaIndex]}
          </span>
        </button>
      ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1">
        <main className={cn('relative flex min-w-0 flex-1 flex-col', presenting ? 'p-0' : 'p-2 sm:p-3')}>
          {/* Banners */}
          <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex flex-col items-center gap-2 transition-[margin] duration-300 sm:inset-x-3 sm:top-3" style={{ marginTop: insetTop }}>
            {reconnecting ? <Banner tone="danger">Reconnecting to LIMS… audio and video keep going meanwhile.</Banner> : null}
            {props.floorPrompt ? (
              <Banner tone="gold" onClose={props.onDismissFloorPrompt}>
                <span className="font-semibold">You have the floor.</span>
                {media.micOn ? null : (
                  <button
                    type="button"
                    onClick={() => {
                      media.setMicOn(true);
                      props.onDismissFloorPrompt();
                    }}
                    className="pointer-events-auto ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#141b66] px-3 text-xs font-bold text-white"
                  >
                    <Mic className="h-4 w-4" />
                    Unmute to speak
                  </button>
                )}
              </Banner>
            ) : null}
            {waitingCount ? (
              <Banner tone="info">
                <span>
                  <span className="font-semibold">{room?.waitingList[0]?.name}</span>
                  {waitingCount > 1 ? ` and ${waitingCount - 1} more` : ''} {waitingCount > 1 ? 'are' : 'is'} waiting to join.
                </span>
                {waitingCount === 1 ? (
                  <button type="button" onClick={() => void act('admit', { target: room?.waitingList[0]?.pid })} className="pointer-events-auto ml-2 inline-flex h-9 items-center rounded-lg bg-[#d4a72c] px-3 text-xs font-bold text-[#141b66]">
                    Admit
                  </button>
                ) : null}
                <button type="button" onClick={() => setPanel('people')} className="pointer-events-auto ml-1 inline-flex h-9 items-center rounded-lg bg-white/15 px-3 text-xs font-bold text-white">
                  Review
                </button>
              </Banner>
            ) : null}
            {mode === 'speaker' && hiddenByPin ? (
              <Banner tone="info">
                <span>
                  <span className="font-semibold">{hiddenByPin.name}</span> {hiddenByPin.screen ? 'is sharing a screen' : 'has the floor'}. You pinned {pinnedPerson?.pid === selfPid ? 'yourself' : pinnedPerson?.name}.
                </span>
                <button type="button" onClick={() => setPinned(null)} className="pointer-events-auto ml-2 inline-flex h-9 items-center rounded-lg bg-white/15 px-3 text-xs font-bold text-white">
                  Unpin
                </button>
              </Banner>
            ) : null}
            {props.fullscreen.notice ? (
              <Banner tone="info" onClose={props.fullscreen.dismissNotice}>
                <span>{FULLSCREEN_NOTICE[props.fullscreen.notice].text}</span>
                <button type="button" onClick={props.fullscreen.enter} className="pointer-events-auto ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-xs font-bold text-white">
                  <Maximize className="h-4 w-4" />
                  {FULLSCREEN_NOTICE[props.fullscreen.notice].action}
                </button>
              </Banner>
            ) : null}
            {unstable && !unstableDismissed ? (
              <Banner tone="warning" onClose={() => setUnstableDismissed(true)}>
                Your connection is unstable.
                {media.camOn ? (
                  <button type="button" onClick={() => media.setCamOn(false)} className="pointer-events-auto ml-2 inline-flex h-9 items-center rounded-lg bg-white/15 px-3 text-xs font-bold text-white">
                    Turn off camera
                  </button>
                ) : null}
              </Banner>
            ) : null}
          </div>

          <div ref={area.ref} className={cn('relative min-h-0 flex-1', mode === 'gallery' && scrollGallery && 'overflow-y-auto')}>
            {!room ? (
              <div className="flex h-full items-center justify-center text-sm text-white/70">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Connecting to the e-session…
              </div>
            ) : presenting ? (
              <>
                <ShareStage key={main.pid} sharer={main} stream={streamOf(main)} chrome={bars.visible} insetTop={insetTop} insetBottom={insetBottom} />
                <PeopleFloat people={floatPeople} focus={floatFocus} renderTile={(p, className, style) => tile(p, className, style)} insetTop={insetTop} insetBottom={insetBottom} />
              </>
            ) : mode === 'gallery' ? (
              <div className={cn('flex flex-wrap justify-center gap-2', scrollGallery ? 'content-start' : 'h-full content-center')}>
                {ordered.map((p) => tile(p, 'shrink-0', scrollGallery ? scrollTile : { width: grid.width, height: grid.height }))}
              </div>
            ) : main ? (
              <div className={cn('flex h-full gap-2', portrait ? 'flex-col' : 'flex-row')}>
                {tile(main, 'min-h-0 min-w-0 flex-1', undefined, true)}
                {participants.length > 1 ? (
                  <div className={cn('flex shrink-0 gap-2', portrait ? 'h-28 flex-row overflow-x-auto sm:h-32' : 'w-[clamp(150px,20%,240px)] flex-col overflow-y-auto')}>
                    {ordered.filter((p) => p.pid !== main.pid).map((p) => tile(p, cn('shrink-0', portrait ? 'h-full w-40 sm:w-48' : 'aspect-video w-full')))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </main>

        {panel && isWide ? (
          <aside
            className={cn('flex w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#0c1230]', presenting && 'absolute right-0 z-20 shadow-2xl')}
            style={presenting ? { top: insetTop, bottom: insetBottom } : undefined}
          >
            <PanelHeader panel={panel} setPanel={setPanel} people={participants.length} unread={props.unread} waiting={waitingCount} />
            <div className="min-h-0 flex-1 overflow-y-auto">{panelBody}</div>
          </aside>
        ) : null}
      </div>

      <div ref={bottomBar.ref} className={barSlide('bottom')} {...(presenting ? bars.barProps : {})}>
        <ControlBar {...props} waitingCount={waitingCount} me={me} mode={mode} onLayout={(next) => setLayout(next)} />
      </div>

      {panel && !isWide ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close panel" onClick={() => setPanel(null)} />
          <div className="relative flex h-[78dvh] flex-col rounded-t-2xl bg-[#0c1230] shadow-2xl ring-1 ring-white/10" role="dialog" aria-modal="true">
            <span className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/25" aria-hidden />
            <PanelHeader panel={panel} setPanel={setPanel} people={participants.length} unread={props.unread} waiting={waitingCount} />
            <div className="min-h-0 flex-1 overflow-y-auto">{panelBody}</div>
          </div>
        </div>
      ) : null}

      {/* Everyone's sound plays from here, so it keeps going whichever tiles are on screen. */}
      <div className="hidden" aria-hidden>
        {[...peers].map(([pid, peer]) => (
          <RemoteAudio key={pid} stream={peer.stream} speakerId={media.speakerId} />
        ))}
      </div>
    </div>
  );
}

const FULLSCREEN_NOTICE: Record<FullscreenNotice, { text: string; action: string }> = {
  admitted: { text: 'You are in. Full screen hides the browser bars.', action: 'Go full screen' },
  left: { text: 'You left full screen.', action: 'Return to full screen' },
  off: { text: 'Full screen is off on this device.', action: 'Go full screen' },
};

function Banner({ tone, children, onClose }: { tone: 'info' | 'gold' | 'warning' | 'danger'; children: ReactNode; onClose?: () => void }) {
  return (
    <div
      className={cn(
        'pointer-events-auto flex max-w-full flex-wrap items-center gap-y-1 rounded-xl px-4 py-2 text-sm shadow-xl ring-1',
        tone === 'gold' ? 'bg-[#d4a72c] text-[#141b66] ring-[#e8c766]' : tone === 'danger' ? 'bg-red-700 text-white ring-red-400/50' : tone === 'warning' ? 'bg-[#5c4300] text-[#fde68a] ring-amber-400/40' : 'bg-[#1b2453] text-white ring-white/15'
      )}
      role="status"
      data-no-wake
    >
      {children}
      {onClose ? (
        <button type="button" onClick={onClose} className="-mr-2 ml-2 flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/10" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function TopBar({
  room,
  session,
  recordingHere,
  membersPresent,
  mode,
  onToggleLayout,
  fullscreen,
}: CallStageProps & { membersPresent: number; mode: 'gallery' | 'speaker'; onToggleLayout: () => void }) {
  const now = useNow(1000);
  const quorumMet = room ? membersPresent >= room.quorum : false;
  return (
    <header className="flex min-h-14 items-center gap-2 border-b border-white/10 bg-[#0a0f2b] px-3 pt-[env(safe-area-inset-top)] sm:gap-3 sm:px-4">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden />
        Live
        <span className="font-mono tabular-nums">{room ? elapsedClock(now - room.startedAt) : '--:--'}</span>
      </span>
      {room?.recordingBy ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-300 ring-1 ring-inset ring-red-400/40" title={`Recorded by ${room.recordingBy.name}`}>
          <Circle className="h-2.5 w-2.5 animate-pulse fill-red-500 text-red-500 motion-reduce:animate-none" />
          {recordingHere ? 'Recording' : 'Rec'}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{room?.title ?? session?.title ?? 'E-Session'}</p>
        <p className="hidden truncate text-[11px] text-white/60 sm:block">{room ? `${room.type} · started by ${room.startedBy.name}` : 'Connecting…'}</p>
      </div>
      {room ? (
        <span
          className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset', quorumMet ? 'bg-green-500/15 text-green-300 ring-green-400/30' : 'bg-amber-400/15 text-amber-200 ring-amber-400/30')}
          title={`Quorum: ${room.quorum} of ${room.memberTotal} members`}
        >
          <UserRoundCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{quorumMet ? 'Quorum' : 'No quorum'} ·</span> {membersPresent}/{room.memberTotal}
        </span>
      ) : null}
      {room?.locked ? <Lock className="h-4 w-4 shrink-0 text-white/70" aria-label="Locked" /> : null}
      <button
        type="button"
        onClick={onToggleLayout}
        className="hidden h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-white/80 hover:bg-white/10 sm:inline-flex"
        aria-label={mode === 'gallery' ? 'Switch to speaker view' : 'Switch to gallery view'}
      >
        {mode === 'gallery' ? <RectangleHorizontal className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
        {mode === 'gallery' ? 'Speaker view' : 'Gallery view'}
      </button>
      {fullscreen.supported ? (
        <button
          type="button"
          onClick={fullscreen.toggle}
          className="hidden h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-white/80 hover:bg-white/10 sm:inline-flex"
          aria-pressed={fullscreen.active}
        >
          {fullscreen.active ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          {fullscreen.active ? 'Exit full screen' : 'Full screen'}
        </button>
      ) : null}
    </header>
  );
}

function PanelHeader({ panel, setPanel, people, unread, waiting }: { panel: Panel; setPanel: (panel: Panel | null) => void; people: number; unread: number; waiting: number }) {
  const tabs: { id: Panel; label: string; badge?: number; count?: number }[] = [
    { id: 'people', label: 'People', count: people, badge: waiting },
    { id: 'chat', label: 'Chat', badge: unread },
    { id: 'agenda', label: 'Order of Business' },
  ];
  return (
    <div className="flex items-center gap-1 border-b border-white/10 px-2">
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={panel === tab.id}
            onClick={() => setPanel(tab.id)}
            className={cn('relative flex h-12 shrink-0 items-center gap-1.5 px-3 text-sm font-semibold', panel === tab.id ? 'text-white after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t after:bg-[#d4a72c]' : 'text-white/55 hover:text-white')}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="text-xs text-white/50">{tab.count}</span> : null}
            {tab.badge ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{tab.badge}</span> : null}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setPanel(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10" aria-label="Close panel">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  tone = 'default',
  badge,
  className,
  pressed,
}: {
  icon: typeof Mic;
  label: string;
  onClick: () => void;
  active?: boolean;
  tone?: 'default' | 'off' | 'hand';
  badge?: number;
  className?: string;
  pressed?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} aria-label={label} title={label} className={cn('group flex w-11 shrink-0 flex-col items-center gap-1 min-[401px]:w-12 sm:w-16', className)}>
      <span
        className={cn(
          'relative flex h-11 w-11 items-center justify-center rounded-full transition-colors min-[401px]:h-12 min-[401px]:w-12 sm:h-14 sm:w-14',
          tone === 'off' ? 'bg-red-600 text-white hover:bg-red-500' : tone === 'hand' ? 'bg-amber-400 text-[#3d2a00]' : active ? 'bg-white text-[#141b66]' : 'bg-white/10 text-white group-hover:bg-white/20'
        )}
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        {badge ? <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-[#070b1f]">{badge > 9 ? '9+' : badge}</span> : null}
      </span>
      <span className="max-w-full truncate text-[11px] font-medium text-white/80 max-[400px]:hidden">{label}</span>
    </button>
  );
}

function ControlBar({
  media,
  me,
  room,
  selfRole,
  panel,
  setPanel,
  unread,
  waitingCount,
  screenStream,
  canShare,
  recordingHere,
  act,
  mode,
  onLayout,
  onToggleShare,
  onToggleRecording,
  onOpenSettings,
  onLeave,
  fullscreen,
}: CallStageProps & { waitingCount: number; me: Participant | undefined; mode: 'gallery' | 'speaker'; onLayout: (layout: Layout) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moderator = selfRole !== 'participant';
  const isHost = selfRole === 'host';
  const handUp = me?.hand !== null && me?.hand !== undefined;
  const sharing = screenStream !== null;
  const togglePanel = (next: Panel) => setPanel(panel === next ? null : next);
  const someoneRecording = !!room?.recordingBy;

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [moreOpen]);

  const moreItems = useMemo(
    () =>
      [
        { key: 'layout', icon: mode === 'gallery' ? RectangleHorizontal : LayoutGrid, label: mode === 'gallery' ? 'Speaker view' : 'Gallery view', onClick: () => onLayout(mode === 'gallery' ? 'speaker' : 'gallery') },
        ...(fullscreen.supported
          ? [{ key: 'fullscreen', icon: fullscreen.active ? Minimize : Maximize, label: fullscreen.active ? 'Exit full screen' : 'Full screen', onClick: fullscreen.toggle, small: true }]
          : []),
        { key: 'settings', icon: Settings, label: 'Camera, microphone & speaker', onClick: onOpenSettings },
        { key: 'agenda', icon: ListOrdered, label: 'Order of Business', onClick: () => setPanel('agenda'), small: true },
        ...(canShare ? [{ key: 'share', icon: MonitorUp, label: sharing ? 'Stop sharing screen' : 'Share screen', onClick: onToggleShare, small: true }] : []),
        ...(isHost
          ? [{ key: 'record', icon: recordingHere ? Square : Circle, label: recordingHere ? 'Stop recording & save' : someoneRecording ? 'Stop the recording' : 'Record audio', onClick: onToggleRecording, danger: true }]
          : []),
        ...(moderator
          ? [
              { key: 'roll', icon: ClipboardCheck, label: 'Call the roll', onClick: () => void act('roll-call') },
              { key: 'mute-all', icon: VolumeX, label: 'Mute everyone', onClick: () => void act('mute-all') },
            ]
          : []),
      ] as { key: string; icon: typeof Mic; label: string; onClick: () => void; small?: boolean; danger?: boolean }[],
    [mode, fullscreen.supported, fullscreen.active, fullscreen.toggle, canShare, sharing, isHost, moderator, recordingHere, someoneRecording, onLayout, onOpenSettings, setPanel, onToggleShare, onToggleRecording, act]
  );

  return (
    <footer className="border-t border-white/10 bg-[#0a0f2b] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto flex max-w-4xl items-end justify-center gap-0.5 min-[401px]:gap-1 sm:gap-2">
        <ControlButton
          icon={media.micOn ? Mic : MicOff}
          label={media.micOn ? 'Mute' : 'Unmute'}
          tone={media.micOn ? 'default' : 'off'}
          onClick={() => media.setMicOn(!media.micOn)}
          pressed={!media.micOn}
        />
        <ControlButton
          icon={media.camOn ? Video : VideoOff}
          label={media.camOn ? 'Stop video' : 'Start video'}
          tone={media.camOn ? 'default' : 'off'}
          onClick={() => media.setCamOn(!media.camOn)}
          pressed={!media.camOn}
        />
        {canShare ? <ControlButton icon={MonitorUp} label={sharing ? 'Stop share' : 'Share'} active={sharing} onClick={onToggleShare} className="max-sm:hidden" pressed={sharing} /> : null}
        <ControlButton icon={Hand} label={handUp ? 'Lower hand' : 'Raise hand'} tone={handUp ? 'hand' : 'default'} onClick={() => void act('hand', { raised: !handUp })} pressed={handUp} />
        <ControlButton icon={Users} label="People" active={panel === 'people'} badge={waitingCount} onClick={() => togglePanel('people')} />
        <ControlButton icon={MessageSquare} label="Chat" active={panel === 'chat'} badge={panel === 'chat' ? 0 : unread} onClick={() => togglePanel('chat')} />
        <ControlButton icon={ListOrdered} label="Agenda" active={panel === 'agenda'} onClick={() => togglePanel('agenda')} className="max-sm:hidden" />
        <div ref={moreRef} className="relative">
          <ControlButton icon={MoreHorizontal} label="More" active={moreOpen} onClick={() => setMoreOpen((open) => !open)} />
          {moreOpen ? (
            <div className="absolute bottom-full right-0 z-50 mb-2 w-64 overflow-hidden rounded-xl bg-[#121a3d] py-1 shadow-2xl ring-1 ring-white/15 sm:left-1/2 sm:right-auto sm:-translate-x-1/2" role="menu">
              {moreItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    item.onClick();
                  }}
                  className={cn('flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm hover:bg-white/10', item.small && 'sm:hidden', item.danger ? 'text-red-300' : 'text-white')}
                >
                  <item.icon className={cn('h-4 w-4', item.key === 'record' && !recordingHere && 'fill-red-500 text-red-500')} />
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button type="button" onClick={onLeave} aria-label={isHost ? 'Leave or end the e-session' : 'Leave the e-session'} className="ml-0.5 flex shrink-0 flex-col items-center gap-1 min-[401px]:ml-1 sm:ml-3">
          <span className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-500 max-[400px]:h-11 max-[400px]:w-11 max-[400px]:justify-center max-[400px]:px-0 sm:h-14 sm:px-6">
            <PhoneOff className="h-5 w-5" />
            <span className="max-[400px]:hidden">{isHost ? 'Leave / End' : 'Leave'}</span>
          </span>
          {/* Same height as the other buttons' captions, so the pill lines up with their circles. */}
          <span className="invisible text-[11px] font-medium max-[400px]:hidden" aria-hidden>
            &nbsp;
          </span>
        </button>
      </div>
    </footer>
  );
}
