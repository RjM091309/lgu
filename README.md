## SB Capas LMIS

Legislative Management Information System prototype for the Sangguniang Bayan ng Capas, Tarlac.
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

## Typecheck

```bash
npm run lint
```

## Notes

- `dist/`, `node_modules/`, and `.env*` are ignored via `.gitignore`.
- On Windows, `npm run clean` may fail because it uses `rm -rf`.
