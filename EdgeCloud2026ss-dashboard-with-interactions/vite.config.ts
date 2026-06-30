import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Mirrors nginx's /api/tts/ proxy in production so the dashboard always
    // calls a same-origin relative path — no LAN IP/port to keep in sync.
    proxy: {
      '/api/tts': 'http://localhost:5005',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.ts',
  },
});
