import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Connect, type Plugin} from 'vite';
import {createEgovAiHandler} from './server/egovai-proxy.mjs';
import {createESessionSyncHandler} from './server/esession-sync.mjs';
import {createESessionRoomsHandler} from './server/esession-rooms.mjs';
import {SECURITY_HEADERS, startHttpsServer} from './server/https.mjs';
import {createSpeechModelHandler} from './server/speech-models.mjs';

// Mounts the eGovAI proxy on the dev and preview servers so credentials stay server-side.
const egovAiProxy = (env: Record<string, string>): Plugin => ({
  name: 'egovai-proxy',
  configureServer(server) {
    server.middlewares.use(createEgovAiHandler(env));
  },
  configurePreviewServer(server) {
    server.middlewares.use(createEgovAiHandler(env));
  },
});

// Shares attendance, scheduled sessions, and reminders between the web calendar, the mobile app (/m) and
// the E-Session app (/es); runs the live E-Session rooms; and opens a second, https port so tablets on the
// network can use their camera and microphone (see server/https.mjs). Both ports share the same middleware
// and state. The rooms tell the calendar when a session starts, so it can no longer be changed.
const eSession = (env: Record<string, string>): Plugin => {
  const mount = (middlewares: Connect.Server) => {
    const sync = createESessionSyncHandler();
    middlewares.use(sync);
    middlewares.use(createESessionRoomsHandler(env, {onSessionStarted: sync.markStarted}));
    // Speech model and runtime for transcription, kept on this server so it works without internet.
    middlewares.use(createSpeechModelHandler());
  };
  return {
    name: 'esession',
    configureServer(server) {
      mount(server.middlewares);
      server.httpServer?.once('listening', () => void startHttpsServer(server.middlewares, env, server.httpServer));
    },
    configurePreviewServer(server) {
      mount(server.middlewares);
      server.httpServer.once('listening', () => void startHttpsServer(server.middlewares, env, server.httpServer));
    },
  };
};

export default defineConfig(({mode}) => {
  // '' prefix loads EGOVAI_* too; they are only passed to the proxy, never exposed to client code.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), egovAiProxy(env), eSession(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    preview: {headers: SECURITY_HEADERS},
    server: {
      headers: SECURITY_HEADERS,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Android app build output: `npm run apk` rewrites these while the dev server may be running.
      watch: {
        ignored: ['**/dist-app/**', '**/android/**', '**/downloads/**'],
      },
    },
  };
});
