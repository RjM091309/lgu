// Second, HTTPS port for the E-Session room (/es). Browsers only give a page the camera and microphone
// over https (or on localhost), so tablets on the local network open https://<server>:2511/es.
// The plain http port (2510) stays as it is for LIMS Mobile and the Android app.
//
// Both ports are served by the same middleware, so they share one copy of the E-Session state.
// Certificate: HTTPS_CERT / HTTPS_KEY (PEM file paths, e.g. made with mkcert) when set; otherwise a
// self-signed one is generated and kept in node_modules/.cache/lims-https (devices show a one-time warning).
// HTTPS_PORT picks the port (default 2511); HTTPS_PORT=off turns it off.
//
// Used by the Vite dev/preview server (vite.config.ts) and by the production server (server/index.mjs).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import selfsigned from 'selfsigned';

const DEFAULT_PORT = 2511;
const CACHE_DIR = fileURLToPath(new URL('../node_modules/.cache/lims-https/', import.meta.url));
const CERT_DAYS = 365;
// Regenerate a little before expiry so a long-running server never serves an expired certificate.
const RENEW_BEFORE_MS = 7 * 24 * 60 * 60_000;

let listeningPort = null;

/** Sent with every response: no type guessing, no framing by other sites, and no full addresses leaked onward. */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'same-origin',
};

/** The HTTPS port once it is listening; null when it is off or failed to start. */
export const getHttpsPort = () => listeningPort;

/** The configured HTTPS port, or null when HTTPS_PORT=off. */
export const httpsPortFrom = (env) => {
  const value = (env.HTTPS_PORT ?? '').trim().toLowerCase();
  if (value === 'off' || value === 'false' || value === '0') return null;
  const port = Number(value || DEFAULT_PORT);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
};

const lanAddresses = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)
    .sort();

// The certificate names every address the server answers on, so it only needs regenerating when those change.
const generateCertificate = async () => {
  const ips = lanAddresses();
  const metaFile = path.join(CACHE_DIR, 'meta.json');
  try {
    const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
    if (meta.ips.join(',') === ips.join(',') && meta.notAfter - Date.now() > RENEW_BEFORE_MS) {
      return { key: readFileSync(path.join(CACHE_DIR, 'key.pem')), cert: readFileSync(path.join(CACHE_DIR, 'cert.pem')) };
    }
  } catch {
    // Nothing cached yet (or unreadable): generate below.
  }
  const notAfter = new Date(Date.now() + CERT_DAYS * 24 * 60 * 60_000);
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'LIMS E-Session (local)' }], {
    keySize: 2048,
    algorithm: 'sha256',
    notAfterDate: notAfter,
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }, ...ips.map((ip) => ({ type: 7, ip }))],
      },
    ],
  });
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(path.join(CACHE_DIR, 'key.pem'), pems.private, { mode: 0o600 });
    writeFileSync(path.join(CACHE_DIR, 'cert.pem'), pems.cert);
    writeFileSync(metaFile, JSON.stringify({ ips, notAfter: notAfter.getTime() }));
  } catch {
    // Read-only install: the certificate still works, it is just regenerated on the next start.
  }
  return { key: pems.private, cert: pems.cert };
};

const loadCertificate = async (env) => {
  if (env.HTTPS_CERT && env.HTTPS_KEY) {
    return { key: readFileSync(env.HTTPS_KEY), cert: readFileSync(env.HTTPS_CERT), source: 'files' };
  }
  return { ...(await generateCertificate()), source: 'self-signed' };
};

/**
 * Serves `handler` over HTTPS on the configured port. `upgradeTarget` (the http server) receives the
 * WebSocket upgrades, so Vite's hot reload also works on the https page.
 */
export async function startHttpsServer(handler, env, upgradeTarget) {
  const port = httpsPortFrom(env);
  if (!port) return null;
  try {
    const { key, cert, source } = await loadCertificate(env);
    const server = https.createServer({ key, cert }, handler);
    if (upgradeTarget) server.on('upgrade', (req, socket, head) => upgradeTarget.emit('upgrade', req, socket, head));
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '0.0.0.0', resolve);
    });
    listeningPort = port;
    const where = lanAddresses().map((ip) => `https://${ip}:${port}/es`);
    console.log(`  E-Session (https, ${source === 'files' ? 'certificate from HTTPS_CERT' : 'self-signed certificate'}): https://localhost:${port}/es${where.length ? ` · ${where.join(' · ')}` : ''}`);
    return server;
  } catch (error) {
    console.warn(`  E-Session https port ${port} did not start: ${error instanceof Error ? error.message : error}. Cameras work only on localhost until it does.`);
    return null;
  }
}
