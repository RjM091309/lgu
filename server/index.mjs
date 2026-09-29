// Production server: serves the built app (dist/), the eGovAI proxy, and the E-Session sync.
//   npm run build && npm start
// Reads EGOVAI_* credentials from the environment or a .env file.

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createEgovAiHandler } from './egovai-proxy.mjs';
import { createESessionSyncHandler } from './esession-sync.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const port = Number(process.env.PORT) || 2510;

const app = express();
app.disable('x-powered-by');
app.use(createEgovAiHandler(process.env));
app.use(createESessionSyncHandler());
app.use(express.static(distDir));
// Client-side routes (react-router) all load the same page.
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(port, () => {
  console.log(`LIMS running on http://localhost:${port}`);
});
