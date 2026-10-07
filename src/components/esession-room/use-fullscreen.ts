import { useCallback, useEffect, useRef, useState } from 'react';

// Full screen for the call. Browsers only let a page enter full screen from a tap or click, so the join button
// asks for it; leaving needs no tap, so the page exits by itself when the call ends. Whether this device wants
// full screen is remembered: leaving it during a call turns it off, and choosing it again turns it back on.

const PREF_KEY = 'es-fullscreen';

/** Why the call screen suggests going full screen, if it does. */
export type FullscreenNotice = 'admitted' | 'left' | 'off';

type WebkitDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const doc = () => document as WebkitDocument;
const fullscreenElement = () => doc().fullscreenElement ?? doc().webkitFullscreenElement ?? null;
// iPhones only allow full screen for videos, so this is false there and the controls stay hidden.
const isSupported = () => !!(doc().fullscreenEnabled || doc().webkitFullscreenEnabled);

const readPref = () => {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
};
const writePref = (on: boolean) => {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
};

const request = async () => {
  const root = document.documentElement as WebkitElement;
  try {
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
    else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
    else return false;
    return true;
  } catch {
    return false;
  }
};

export interface Fullscreen {
  supported: boolean;
  active: boolean;
  notice: FullscreenNotice | null;
  /** From the full screen button: enter or exit, and remember the choice. */
  toggle: () => void;
  /** From a notice's button. */
  enter: () => void;
  dismissNotice: () => void;
}

/**
 * `inCall` is true while the call screen shows. Call `autoEnter` inside the join tap (it does nothing when this
 * device turned full screen off), `arrived` when the call screen first shows, and `release` when the call ends.
 */
export function useFullscreen(inCall: boolean) {
  const [supported] = useState(isSupported);
  const [active, setActive] = useState(() => !!fullscreenElement());
  const [notice, setNotice] = useState<FullscreenNotice | null>(null);
  // Set before the page itself exits, so that exit is not taken as the person leaving full screen.
  const selfExit = useRef(false);
  const inCallRef = useRef(inCall);
  inCallRef.current = inCall;

  useEffect(() => {
    const onChange = () => {
      const now = !!fullscreenElement();
      setActive(now);
      if (now) return setNotice(null);
      if (selfExit.current) {
        selfExit.current = false;
        return;
      }
      if (!inCallRef.current) return;
      writePref(false);
      setNotice('left');
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const exit = useCallback(() => {
    if (!fullscreenElement()) return;
    selfExit.current = true;
    const d = doc();
    void (d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.())?.catch(() => {
      selfExit.current = false;
    });
  }, []);

  const enter = useCallback(() => {
    void request().then((ok) => {
      if (ok) writePref(true);
    });
  }, []);

  const toggle = useCallback(() => {
    if (fullscreenElement()) {
      writePref(false);
      setNotice(null);
      exit();
    } else enter();
  }, [enter, exit]);

  const autoEnter = useCallback(() => {
    if (supported && readPref() && !fullscreenElement()) void request();
  }, [supported]);

  /** The call screen just appeared; `fromWaiting` when the person asked to join rather than joining directly. */
  const arrived = useCallback(
    (fromWaiting: boolean) => {
      if (!supported || fullscreenElement()) return setNotice(null);
      if (!readPref()) setNotice('off');
      else setNotice(fromWaiting ? 'admitted' : null);
    },
    [supported]
  );

  const release = useCallback(() => {
    setNotice(null);
    exit();
  }, [exit]);

  // A reminder that full screen is off on this device fades after a while; the others wait to be answered.
  useEffect(() => {
    if (notice !== 'off') return;
    const timer = window.setTimeout(() => setNotice((current) => (current === 'off' ? null : current)), 10_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const state: Fullscreen = { supported, active, notice, toggle, enter, dismissNotice: () => setNotice(null) };
  return { state, autoEnter, arrived, release };
}
