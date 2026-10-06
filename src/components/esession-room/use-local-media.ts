import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AUDIO_CONSTRAINTS, VIDEO_CONSTRAINTS, mediaAvailable, mediaErrorMessage, openCamera, openMic } from '@/lib/esession-rtc';

// This device's camera and microphone for the E-Session room: asks for access once, switches devices,
// and remembers the choices on this device. The camera is fully released when turned off (its light
// goes out); the microphone stays open but silent while muted, so unmuting is instant.

const PREFS_KEY = 'lims-es-media';

interface Prefs {
  micId: string;
  camId: string;
  speakerId: string;
  micOn: boolean;
  camOn: boolean;
}

const DEFAULT_PREFS: Prefs = { micId: '', camId: '', speakerId: '', micOn: true, camOn: true };

const readPrefs = (): Prefs => {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
};

const writePrefs = (prefs: Prefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // A convenience only.
  }
};

// Requests for the camera and microphone run one at a time. Two overlapping requests for the same
// device share it, so stopping the first (React runs effects twice in development, a device switch
// stops the old track) would end the second as well; iPads also end an earlier capture when a new one starts.
let queue: Promise<unknown> = Promise.resolve();
const exclusive = <T,>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
};

export interface LocalMedia {
  audioTrack: MediaStreamTrack | null;
  videoTrack: MediaStreamTrack | null;
  /** Both tracks together, for the preview and the speaking indicator. */
  stream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
  micError: string | null;
  camError: string | null;
  /** False until the first request for access has finished. */
  ready: boolean;
  devices: { mics: MediaDeviceInfo[]; cams: MediaDeviceInfo[]; speakers: MediaDeviceInfo[] };
  micId: string;
  camId: string;
  speakerId: string;
  setMicOn: (on: boolean) => void;
  setCamOn: (on: boolean) => void;
  chooseMic: (id: string) => void;
  chooseCam: (id: string) => void;
  chooseSpeaker: (id: string) => void;
}

export function useLocalMedia(active: boolean): LocalMedia {
  const [prefs, setPrefs] = useState(readPrefs);
  const [audioTrack, setAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [devices, setDevices] = useState<LocalMedia['devices']>({ mics: [], cams: [], speakers: [] });
  const tracks = useRef<{ audio: MediaStreamTrack | null; video: MediaStreamTrack | null }>({ audio: null, video: null });
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const updatePrefs = useCallback((change: Partial<Prefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...change };
      writePrefs(next);
      return next;
    });
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        mics: list.filter((device) => device.kind === 'audioinput' && device.deviceId),
        cams: list.filter((device) => device.kind === 'videoinput' && device.deviceId),
        speakers: list.filter((device) => device.kind === 'audiooutput' && device.deviceId),
      });
    } catch {
      // Device names are a nicety; the default devices still work.
    }
  }, []);

  const setAudio = useCallback((track: MediaStreamTrack | null) => {
    if (tracks.current.audio && tracks.current.audio !== track) tracks.current.audio.stop();
    tracks.current.audio = track;
    if (track) track.enabled = prefsRef.current.micOn;
    setAudioTrack(track);
  }, []);

  const setVideo = useCallback((track: MediaStreamTrack | null) => {
    if (tracks.current.video && tracks.current.video !== track) tracks.current.video.stop();
    tracks.current.video = track;
    setVideoTrack(track);
  }, []);

  const startMic = useCallback(
    (deviceId: string): Promise<void> =>
      exclusive(async () => {
        // iPads allow one microphone capture at a time: release the old one first.
        setAudio(null);
        try {
          setAudio(await openMic(deviceId || undefined));
          setMicError(null);
          return;
        } catch (error) {
          if (!deviceId) return setMicError(mediaErrorMessage(error, 'microphone'));
        }
        try {
          setAudio(await openMic());
          setMicError(null);
        } catch (error) {
          setMicError(mediaErrorMessage(error, 'microphone'));
        }
      }),
    [setAudio]
  );

  const startCamera = useCallback(
    (deviceId: string): Promise<void> =>
      exclusive(async () => {
        setVideo(null);
        const attempts = deviceId ? [deviceId, ''] : [''];
        let failure: unknown = null;
        for (const id of attempts) {
          try {
            setVideo(await openCamera(id || undefined));
            setCamError(null);
            return;
          } catch (error) {
            failure = error;
          }
        }
        setCamError(mediaErrorMessage(failure, 'camera'));
        updatePrefs({ camOn: false });
      }),
    [setVideo, updatePrefs]
  );

  // Ask for both at once (one permission prompt), then sort out whichever failed.
  useEffect(() => {
    if (!active) return;
    if (!mediaAvailable()) {
      setMicError('This page cannot use a microphone. Open the secure (https) address of LIMS.');
      setCamError('This page cannot use a camera. Open the secure (https) address of LIMS.');
      setReady(true);
      return;
    }
    let cancelled = false;
    const { micId, camId, camOn } = prefsRef.current;
    void exclusive(async () => {
      if (cancelled) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { ...AUDIO_CONSTRAINTS, ...(micId ? { deviceId: { ideal: micId } } : {}) },
          video: camOn ? { ...VIDEO_CONSTRAINTS, ...(camId ? { deviceId: { ideal: camId } } : { facingMode: 'user' }) } : false,
        });
        if (cancelled) return stream.getTracks().forEach((track) => track.stop());
        setAudio(stream.getAudioTracks()[0] ?? null);
        setVideo(stream.getVideoTracks()[0] ?? null);
        setMicError(null);
        setCamError(null);
      } catch {
        if (cancelled) return;
        // Sort out which one failed (and why) after this request has finished.
        void startMic(micId);
        if (camOn) void startCamera(camId);
      }
    }).finally(() => {
      if (cancelled) return;
      // Queued behind any retries above, so "ready" means every request has finished.
      void exclusive(async () => {
        if (cancelled) return;
        setReady(true);
        void refreshDevices();
      });
    });
    navigator.mediaDevices.addEventListener?.('devicechange', refreshDevices);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener?.('devicechange', refreshDevices);
      tracks.current.audio?.stop();
      tracks.current.video?.stop();
      tracks.current = { audio: null, video: null };
      setAudioTrack(null);
      setVideoTrack(null);
      setReady(false);
    };
  }, [active, refreshDevices, setAudio, setVideo, startCamera, startMic]);

  // A camera taken by another app, or unplugged, ends its track.
  useEffect(() => {
    if (!videoTrack) return;
    const onEnded = () => {
      if (tracks.current.video !== videoTrack) return;
      setVideo(null);
      updatePrefs({ camOn: false });
      setCamError('The camera stopped. Turn it on again to retry.');
    };
    videoTrack.addEventListener('ended', onEnded);
    return () => videoTrack.removeEventListener('ended', onEnded);
  }, [videoTrack, setVideo, updatePrefs]);

  useEffect(() => {
    if (!audioTrack) return;
    const onEnded = () => {
      if (tracks.current.audio === audioTrack) void startMic(prefsRef.current.micId);
    };
    audioTrack.addEventListener('ended', onEnded);
    return () => audioTrack.removeEventListener('ended', onEnded);
  }, [audioTrack, startMic]);

  const setMicOn = useCallback(
    (on: boolean) => {
      updatePrefs({ micOn: on });
      prefsRef.current = { ...prefsRef.current, micOn: on };
      if (tracks.current.audio) tracks.current.audio.enabled = on;
      else if (on && active && mediaAvailable()) void startMic(prefsRef.current.micId);
    },
    [active, startMic, updatePrefs]
  );

  const setCamOn = useCallback(
    (on: boolean) => {
      updatePrefs({ camOn: on });
      if (!on) setVideo(null);
      else if (active && mediaAvailable() && !tracks.current.video) void startCamera(prefsRef.current.camId);
    },
    [active, setVideo, startCamera, updatePrefs]
  );

  const chooseMic = useCallback(
    (id: string) => {
      updatePrefs({ micId: id });
      void startMic(id);
    },
    [startMic, updatePrefs]
  );

  const chooseCam = useCallback(
    (id: string) => {
      updatePrefs({ camId: id, camOn: true });
      void startCamera(id);
    },
    [startCamera, updatePrefs]
  );

  const chooseSpeaker = useCallback((id: string) => updatePrefs({ speakerId: id }), [updatePrefs]);

  const stream = useMemo(() => {
    const list = [audioTrack, videoTrack].filter((track): track is MediaStreamTrack => track !== null);
    return list.length ? new MediaStream(list) : null;
  }, [audioTrack, videoTrack]);

  return {
    audioTrack,
    videoTrack,
    stream,
    micOn: prefs.micOn,
    camOn: prefs.camOn && videoTrack !== null,
    micError,
    camError,
    ready,
    devices,
    micId: prefs.micId,
    camId: prefs.camId,
    speakerId: prefs.speakerId,
    setMicOn,
    setCamOn,
    chooseMic,
    chooseCam,
    chooseSpeaker,
  };
}
