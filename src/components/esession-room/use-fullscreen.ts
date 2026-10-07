import { useCallback, useEffect, useRef, useState } from 'react';

// Full screen for the call, entered only by the person (the full screen button or a banner's button): the call
// never starts in full screen. Leaving needs no tap, so the page exits full screen by itself when the call ends.

/** Why the call screen suggests going full screen, if it does. */
export type FullscreenNotice = 'arrived' | 'left';

type WebkitDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const doc = () => document as WebkitDocument;
const fullscreenElement = () => doc().fullscreenElement ?? doc().webkitFullscreenElement ?? null;
// iPhones only allow full screen for videos, so this is false there and the controls stay hidden.
const isSupported = () => !!(doc().fullscreenEnabled || doc().webkitFullscreenEnabled);

const request = async () => {
  const root = document.documentElement as WebkitElement;
  try {
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
    else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
  } catch {
    // Refused (no tap, or not allowed here): the page simply stays as it is.
  }
};

export interface Fullscreen {
  supported: boolean;
  active: boolean;
  notice: FullscreenNotice | null;
  /** From the full screen button: enter or exit. */
  toggle: () => void;
  /** From a notice's button. */
  enter: () => void;
  dismissNotice: () => void;
}

/** `inCall` is true while the call screen shows. Call `arrived` when it first shows, and `release` when the call ends. */
export function useFullscreen(inCall: boolean) {
  const [supported] = useState(isSupported);
  const [active, setActive] = useState(() => !!fullscreenElement());
  const [notice, setNotice] = useState<FullscreenNotice | null>(null);
  // Set before the page or the full screen button exits, so that exit is not taken as Esc or a back gesture.
  const expectedExit = useRef(false);
  const inCallRef = useRef(inCall);
  inCallRef.current = inCall;

  useEffect(() => {
    const onChange = () => {
      const now = !!fullscreenElement();
      setActive(now);
      if (now) return setNotice(null);
      if (expectedExit.current) {
        expectedExit.current = false;
        return;
      }
      // Left with Esc, F11 or a back gesture during the call: offer the way back.
      if (inCallRef.current) setNotice('left');
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
    expectedExit.current = true;
    const d = doc();
    void (d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.())?.catch(() => {
      expectedExit.current = false;
    });
  }, []);

  const enter = useCallback(() => void request(), []);

  const toggle = useCallback(() => {
    if (fullscreenElement()) {
      setNotice(null);
      exit();
    } else enter();
  }, [enter, exit]);

  /** The call screen just appeared: suggest full screen once. */
  const arrived = useCallback(() => {
    setNotice(supported && !fullscreenElement() ? 'arrived' : null);
  }, [supported]);

  const release = useCallback(() => {
    setNotice(null);
    exit();
  }, [exit]);

  const state: Fullscreen = { supported, active, notice, toggle, enter, dismissNotice: () => setNotice(null) };
  return { state, arrived, release };
}
