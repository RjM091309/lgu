import { Capacitor } from '@capacitor/core';

/** True inside the Android app (APK), false in a browser. */
export const isNativeApp = Capacitor.isNativePlatform();
