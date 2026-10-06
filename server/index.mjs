// Production server: serves the built app (dist/), the eGovAI proxy, the E-Session sync, and the live
// E-Session rooms, on http and on a second https port (camera and microphone need https; see server/https.mjs).
//   npm run build && npm start
// Reads EGOVAI_* and HTTPS_* settings from the environment or a .env file.

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createEgovAiHandler } from './egovai-proxy.mjs';
import { createESessionSyncHandler } from './esession-sync.mjs';
import { createESessionRoomsHandler } from './esession-rooms.mjs';
import { startHttpsServer } from './https.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const port = Number(process.env.PORT) || 2510;

const app = express();
app.disable('x-powered-by');
app.use(createEgovAiHandler(process.env));
app.use(createESessionSyncHandler());
app.use(createESessionRoomsHandler(process.env));
app.use(express.static(distDir));
// Client-side routes (react-router) all load the same page.
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(port, () => {
  console.log(`LIMS running on http://localhost:${port}`);
  void startHttpsServer(app, process.env);
});
