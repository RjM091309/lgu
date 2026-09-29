## Legislative Information Management System (LIMS)

Legislative Information Management System (LIMS) prototype.
React + Vite + TypeScript app (Tailwind CSS).

All records in the app are **sample data** (see `src/lib/mock-data.ts`). Officials are shown by position only.

## Requirements

- Node.js (LTS recommended)
- npm

## Setup

```bash
npm install
```

## Run (dev)

```bash
npm run dev
```

Dev server runs on `http://localhost:2510`.

Demo login on the public portal: username `admin`, password `admin123`.

## Build

```bash
npm run build
```

## Preview production build

```bash
npm run preview
```

## Run (production)

```bash
npm run build
npm start
```

Serves `dist/` and the eGovAI proxy on `http://localhost:2510` (override with `PORT`).

## LIMS Mobile (session schedule on phones)

Members and staff see the sessions they are invited to, reply "I will attend" / "I can't attend", and get reminders, at `/m`.

- Start the app with `npm run dev` (or `npm start`), then on the web open **E-Session → Calendar Sessions → Mobile app** and scan the QR code with a phone on the same Wi-Fi.
- Sign in with the member's position (`vicemayor`, `councilor1` … `councilor8`, `ipmr`, `abc`, `sk`) or a staff username (`admin`, `secretary`, `records`, …). Password: `admin123`. The login screen lists every demo account.
- Replies, sessions scheduled with **Schedule session**, and **Remind no-response** reach every open browser and phone at once. The local server keeps them in memory (`server/esession-sync.mjs`); restarting it returns to the sample data. No database is used.

### Android app (APK)

The same mobile screens as an installable Android app (Capacitor, in `android/`).

```bash
npm run apk
```

Builds `downloads/LIMS-Mobile.apk` (debug-signed, about 5 MB). Needs JDK 21 and the Android SDK (platform 36, build-tools 35). The script finds them through `JAVA_HOME` / `ANDROID_HOME`, or in `%LOCALAPPDATA%\Programs\jdk-21*` and `%LOCALAPPDATA%\Android\Sdk`.

To install on a phone while LIMS is running: **Calendar Sessions → Mobile app → Android app**, scan the QR code, install the download (allow installing from this source), open **LIMS Mobile**, and enter the server address shown in that window (for example `192.168.1.10:2510`). The app polls the LIMS server every 1.5 seconds through Android's own HTTP client, and shows reminders and new sessions in the notification bar. It runs full screen (the status and navigation bars show only on a swipe from the edge).

Every phone running LIMS Mobile, in the app or the browser, appears on **E-Session → Session Platform** under *Phones · LIMS Mobile* as soon as it connects: model, who is signed in, and whether it is online (offline about 15 seconds after it stops checking in). **Live Updates → Push** reaches these phones as an alert.

## "Ask the Sanggunian" chat (DICT eGovAI)

The public landing page has a chat assistant backed by the [DICT eGovAI Agent Engine API](https://egov-ai.e.gov.ph/developers).

- Without credentials it runs in **demo mode**, answering from the sample records in `src/lib/mock-data.ts`.
- Once the LGU's eGovAI agency access is approved, copy `.env.example` to `.env`, set `EGOVAI_API_KEY`, `EGOVAI_API_SECRET` and `EGOVAI_ENGINE_CODE`, and restart. The chat switches to the live engine automatically.
- The browser only calls `/api/egovai/*`. The proxy in `server/egovai-proxy.mjs` adds the credentials, so they are never exposed to the client. It runs inside `npm run dev`, `npm run preview` and `npm start`.

## Typecheck

```bash
npm run lint
```

## Notes

- `dist/`, `node_modules/`, and `.env*` are ignored via `.gitignore`.
- On Windows, `npm run clean` may fail because it uses `rm -rf`.
