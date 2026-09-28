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
