## Legislative Information Management System (LIMS)

Legislative Information Management System (LIMS) prototype.
React + Vite + TypeScript app (Tailwind CSS).

All records in the app are **sample data** (see `src/lib/mock-data.ts`). Officials are shown by position only.

## What the Staff Portal shows

The client asked for **e-sessions** and **keeping the record (transcriptions)** of sessions, so the Staff Portal opens set up for that: the dashboard (e-sessions live and coming up, replies, session folders, transcripts), Calendar Sessions, the E-Session Monitor, Session Files, Members & Committees, Attendance, the Activity Log, and Administration.

- **Optional modules:** the rest of the LIMS built from the full requirements (Legislative Tracking with the special legislative files, Transaction Operations, Archives, Electronic Signature, the legislative reports, and the System Requirements reference) is kept but hidden. An Administrator turns any of them on in **Administration → Control Panel → Optional modules**; it then shows for the roles that have it, on every device, until the server restarts. Nothing is deleted (`src/lib/modules.ts`).
- **E-Session Monitor:** what is happening in E-Session, live from the server: the sittings running now with who is in each and on what device, the current agenda item and quorum, sittings already ended (with their record), the next sitting with its replies, the phones running LIMS Mobile, and notices sent to them. Sittings are started and run in E-Session (`/es`) itself.
- **Transcripts:** made in the browser from a recording in Session Files, then kept on the LIMS server for every device (wiped on restart, like the other demo data). Each line can be corrected (marked *corrected*), and the transcript downloads as captions, text, or a PDF laid out for the minutes. The speech model and its runtime come through the LIMS server (`server/speech-models.mjs`), which keeps the model after the first download, so transcription works in a hall without internet; run one transcription while online first.
- **Sign-in:** one rule for the Staff Portal, E-Session and LIMS Mobile (`src/lib/sign-in.ts`), with the same messages everywhere (members are told to use E-Session or LIMS Mobile; Encoder and Viewer accounts to use the Staff Portal). Accounts and roles changed on the Users and Roles pages are shared through the server, so a new or deactivated account applies on tablets and phones at once. The security policies on the Control Panel are saved but not applied until sign-in moves to the server.

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

Every phone running LIMS Mobile, in the app or the browser, appears on **E-Session → E-Session Monitor** under *Phones · LIMS Mobile* as soon as it connects: model, who is signed in, and whether it is online (offline about 15 seconds after it stops checking in). **Notices to Phones** reaches them as an alert.

## LIMS E-Session (live video sittings)

Members of the body and the Secretariat hold sessions by video at `/es`, built for tablets first (also phones and computers, portrait or landscape).

- **Sign in:** on the public site, **Staff Login → E-Session**, or open `/es` directly (it can be added to a tablet's home screen). Same accounts as LIMS Mobile: members by position (`vicemayor`, `councilor1` … `councilor8`, `ipmr`, `abc`, `sk`), staff by username (`admin`, `secretary`, `records`, `committee`, …). Password: `admin123`. Encoder and Viewer accounts do not take part in sessions.
- **Roles:** Administrators host: they start and end e-sessions, admit people from the waiting room, mute, remove, lock the room, and record. The Presiding Officer (the Vice Mayor, or the committee chair at a hearing) recognizes speakers, moves through the order of business, and calls the roll; the hosts can too. Everyone else can raise a hand for the floor and chat.
- **One calendar:** the Calendar Sessions page, Session Files, the E-Session Monitor and the dashboards, LIMS Mobile, and the `/es` app all read the same calendar from the LIMS server (`server/esession-sync.mjs`), so a session scheduled, edited or cancelled in one shows in the others at once. Session Files has a folder for every session and meeting still to come, plus any that has files.
- **Sample calendar:** from October 14 to November 30 (`mockSeededSessions` in `src/lib/mock-data.ts`): weekly regular sessions, the budget special session, four hearings and six meetings. They can be edited and cancelled like anything scheduled in the app. Restarting the server brings back these originals and drops whatever was scheduled during a demo.
- **Scheduling:** Administrators can schedule from the `/es` lobby as well as from the calendar and LIMS Mobile (all three share one form), and edit or cancel sessions from the sample calendar or set up in the app until its e-session starts (the server refuses changes after that). Invitees are notified in the mobile app; a new date or time clears their responses so they confirm again. A special session needs a purpose (LGC Sec. 52), which becomes its main agenda item.
- **Meetings:** a fourth type for informal gatherings (caucus, briefing, coordination). The host picks the invitees and an optional agenda, and can **Start a meeting** right away from the lobby. Meetings are not official sessions: no quorum, no roll call, no presiding officer (the hosts run them), and they are labelled as such in the room and in History. Members not invited still see them listed under *Other sessions* but cannot join.
- **Camera and microphone need https.** Browsers block them on `http://<ip>:2510`, so the server also listens on **`https://<ip>:2511`** (same data; the http port stays as it is for LIMS Mobile and the Android app). Tablets open `https://<server-ip>:2511/es` and accept the certificate once. Opening `/es` over http shows a link to the secure address. On the server's own computer, `http://localhost:2510/es` works too.
  - By default the certificate is self-signed and generated on first start (kept in `node_modules/.cache/lims-https`). For a trusted one, set `HTTPS_CERT` and `HTTPS_KEY` in `.env` (for example from [mkcert](https://github.com/FiloSottile/mkcert)). `HTTPS_PORT` changes the port; `HTTPS_PORT=off` turns it off.
- **How it works:** audio and video go directly between the devices (WebRTC, always encrypted); the LIMS server only connects them and keeps the room's state (`server/esession-rooms.mjs`). On one local network no internet is needed. Video quality adjusts to the room size, sharper for whoever has the floor; about 16 devices (a full sitting plus the Secretariat) is the comfortable limit. For devices on different networks, set `ESESSION_ICE_SERVERS` (STUN/TURN servers, see `.env.example`).
- **Record:** the server writes the audit trail with its own clock: who joined, left, or was admitted, removed, or muted; requests for the floor; agenda changes; roll calls; chat; recording. See it under **E-Session → History** (CSV and PDF export). When a host ends an e-session, its attendance record (PDF) is saved to the session's folder in **Session Files**; a host's audio recording is saved there too (Audio Recording, ready to transcribe). Like the rest of the E-Session sync, the history is kept in memory until the server restarts.
- **Session Files on the server:** files added during the demo (uploads, recordings, attendance records, attached media, new versions) are kept by the LIMS server (`server/session-file-store.mjs`, contents in `node_modules/.cache/lims-session-files`), so every device and both addresses (`:2510`, `:2511`) see the same folders. A restart empties it back to the sample files. Transcripts made in the browser stay on the device that made them.
- **Recording (hosts):** works on computers, tablets and phones (Chrome, Edge, Safari). Each second is also saved on the recording device, so if the tab crashes, reloads or the battery dies, the lobby offers to save what was recorded. On phones and tablets, keep E-Session in front and the screen on: switching apps or locking the screen pauses the microphone, and the saved recording notes how long that was. Everyone sees a red REC timer, and a banner when recording starts.
- **Present:** the **Present** button shares a computer's screen, or shows a PDF or picture from the session's folder in Session Files or from the device. Phones and tablets cannot share their screen from a browser, so they present files; the presenter turns the pages and everyone sees the page full screen and can zoom (pdf.js, loaded only when presenting).
- **Dashboard and E-Session side by side:** the dashboard's **E-Session** button (staff who take part in sessions) opens `/es` in its own window on the https address. To use both on one computer, open the dashboard at `https://<server-ip>:2511` too: then they share sign-ins and the window opens signed in. To present something from the dashboard, use **Present → Share your screen** and pick the dashboard's tab. On tablets, use split screen; on phones, present the file from E-Session itself.
- **Home-screen shortcuts:** the public site/dashboard (**LIMS**), **E-Session** and **LIMS Mobile** can each be added to the home screen (Chrome: ⋮ → Add to Home screen / Install; Safari: Share → Add to Home Screen), each with its own icon and name. With the self-signed certificate Chrome makes a shortcut that opens in Chrome rather than an installed app; a trusted certificate makes it a full app.
- **Not yet:** the Android app (LIMS Mobile only), e-voting, and server-side sign-in (sign-in is checked in the browser in this prototype, as on the Staff Portal).

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
