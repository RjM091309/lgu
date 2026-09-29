import { useEffect, useState } from 'react';
import { Device } from '@capacitor/device';
import { reportLeaving, reportPresence, useSyncStatus, type PresenceReport } from '@/lib/esession-sync';
import type { MobileAccount } from '@/lib/mobile-accounts';
import { isNativeApp } from '@/lib/native';

// Lets the Session Platform list this phone among the session devices: it checks in every few seconds
// with its model and the account signed in on it, and is shown offline once the check-ins stop.

const DEVICE_KEY = 'lims-device-id';
const CHECK_IN_MS = 5_000;

const newDeviceId = () => `phone-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
let fallbackId: string | null = null;

/** A random id kept on the phone, so the same phone stays one entry across restarts. */
const deviceId = () => {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = newDeviceId();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    fallbackId ??= newDeviceId();
    return fallbackId;
  }
};

interface DeviceDescription {
  model: string;
  os: string;
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

interface UserAgentData {
  platform: string;
  getHighEntropyValues: (hints: string[]) => Promise<{ model?: string; platformVersion?: string }>;
}

async function describeDevice(): Promise<DeviceDescription> {
  if (isNativeApp) {
    const info = await Device.getInfo();
    const maker = capitalize(info.manufacturer);
    return {
      model: info.model.toLowerCase().startsWith(info.manufacturer.toLowerCase()) ? info.model : `${maker} ${info.model}`,
      os: `${info.operatingSystem === 'android' ? 'Android' : capitalize(info.operatingSystem)} ${info.osVersion}`,
    };
  }

  // Chrome on Android gives the model through client hints; its user agent string no longer does.
  const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  if (uaData?.platform === 'Android') {
    const hints = await uaData.getHighEntropyValues(['model', 'platformVersion']).catch(() => ({ model: '', platformVersion: '' }));
    return { model: hints.model || 'Android phone', os: `Android ${(hints.platformVersion ?? '').split('.')[0]}`.trim() };
  }
  const ua = navigator.userAgent;
  const apple = ua.match(/(iPhone|iPad)[^)]*OS (\d+)/);
  if (apple) return { model: apple[1], os: `iOS ${apple[2]}` };
  const android = ua.match(/Android (\d+)(?:[^;)]*;\s*([^;)]+))?/);
  if (android) return { model: android[2] && android[2] !== 'K' ? android[2].replace(/ Build\/.*/, '') : 'Android phone', os: `Android ${android[1]}` };
  return { model: 'Computer', os: /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : '' };
}

export function useDevicePresence(account: MobileAccount | null) {
  const status = useSyncStatus();
  const [device, setDevice] = useState<DeviceDescription | null>(null);

  useEffect(() => {
    // Never hold up the check-in on the device details: fall back to a generic name after a moment.
    const fallback = setTimeout(() => setDevice((prev) => prev ?? { model: isNativeApp ? 'Android phone' : 'Phone', os: '' }), 2_000);
    describeDevice()
      .then(setDevice)
      .catch(() => undefined);
    return () => clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (!device || status !== 'live') return;
    const report: PresenceReport = {
      deviceId: deviceId(),
      platform: isNativeApp ? 'app' : 'browser',
      model: device.model,
      os: device.os,
      account: account ? { inviteeId: account.inviteeId, name: account.name, detail: account.detail } : null,
    };
    reportPresence(report);
    const timer = setInterval(() => reportPresence(report), CHECK_IN_MS);
    const leave = () => reportLeaving(report);
    window.addEventListener('pagehide', leave);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', leave);
    };
  }, [device, status, account]);
}
