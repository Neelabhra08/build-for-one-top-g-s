import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import ttsHandler from './api/tts.js';

const root = fileURLToPath(new URL('.', import.meta.url));

function localApi() {
  return {
    name: 'ishara-local-api',
    configureServer(server) {
      server.middlewares.use('/api/tts', (req, res) => {
        ttsHandler(req, res).catch((error) => {
          console.error('Local /api/tts failed:', error.message);
          res.statusCode = 500;
          res.end();
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.SARVAM_API_KEY && !process.env.SARVAM_API_KEY) {
    process.env.SARVAM_API_KEY = env.SARVAM_API_KEY;
  }
  return {
    plugins: [react(), localApi()],
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
