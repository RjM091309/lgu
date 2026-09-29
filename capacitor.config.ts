import type { CapacitorConfig } from '@capacitor/cli';

// Android app (APK) of LIMS Mobile: the same /m screens, bundled from dist-app/. It talks to the LIMS
// server on the local network (the address is entered in the app), so plain http must be allowed.
//   npm run apk   →   downloads/LIMS-Mobile.apk (see scripts/build-apk.mjs)
const config: CapacitorConfig = {
  appId: 'com.lims.mobile',
  appName: 'LIMS Mobile',
  // A separate build without the web portal's recordings and speech-to-text engine (scripts/build-apk.mjs).
  webDir: 'dist-app',
  server: {
    // http://localhost, so requests to the http:// LIMS server are not blocked as mixed content.
    androidScheme: 'http',
    cleartext: true,
  },
  plugins: {
    // Requests to the LIMS server go through Android's own HTTP client, not the WebView, so browser
    // rules for calls from an app page to a local-network address (CORS, Local Network Access) do not apply.
    CapacitorHttp: {
      enabled: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_lims',
      iconColor: '#1a237e',
    },
  },
};

export default config;
