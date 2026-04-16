## LGU

React + Vite + TypeScript app (Tailwind CSS). Uses `GEMINI_API_KEY` (see `.env.example`).

## Requirements

- Node.js (LTS recommended)
- npm

## Setup

```bash
npm install
```

Create your env file:

```bash
copy .env.example .env
```

Then set `GEMINI_API_KEY` in `.env`.

## Run (dev)

```bash
npm run dev
```

Dev server runs on `http://localhost:3000`.

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
- On Windows, `npm run clean` may fail because it uses `rm -rf`. If you need it, we can switch it to a cross-platform command.
