import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import ttsHandler from './api/tts.js';
import translateHandler from './api/translate.js';

const root = fileURLToPath(new URL('.', import.meta.url));

const ROUTES = { '/api/tts': ttsHandler, '/api/translate': translateHandler };

function localPacks() {
  return {
    name: 'ishara-local-packs',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = /^\/packs\/(isl|asl)\.json$/.exec(req.url ?? '');
        if (!match) return next();
        const local = `${root}packs-local/${match[1]}.json`;
        if (!existsSync(local)) return next();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(readFileSync(local));
      });
    },
  };
}

function localApi() {
  return {
    name: 'ishara-local-api',
    configureServer(server) {
      for (const [path, handler] of Object.entries(ROUTES)) {
        server.middlewares.use(path, (req, res) => {
          handler(req, res).catch((error) => {
            console.error(`Local ${path} failed:`, error.message);
            res.statusCode = 500;
            res.end();
          });
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.SARVAM_API_KEY && !process.env.SARVAM_API_KEY) {
    process.env.SARVAM_API_KEY = env.SARVAM_API_KEY;
  }
  return {
    base: process.env.VITE_BASE || '/',
    plugins: [react(), localPacks(), localApi()],
    build: {
      rollupOptions: {
        input: {
          main: `${root}index.html`,
          widget: `${root}widget.html`,
        },
      },
    },
  };
});
