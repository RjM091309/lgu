import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {createEgovAiHandler} from './server/egovai-proxy.mjs';

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

export default defineConfig(({mode}) => {
  // '' prefix loads EGOVAI_* too; they are only passed to the proxy, never exposed to client code.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), egovAiProxy(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
