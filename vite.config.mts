import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React app lives in src/ and builds to dist/. The old app in public/ is
// served by server.js only (see "legacy" in the README), so Vite's own public
// folder is renamed to static/ to keep the two apart.
export default defineConfig({
  plugins: [react()],
  publicDir: 'static',
  server: {
    port: 5173,
    strictPort: true,
    // /api goes to server.js; so do the original pages, so the "Original app" links work in dev.
    proxy: Object.fromEntries(
      ['/api', '/legacy', '/players.html', '/player.html', '/css', '/js'].map((p) => [p, 'http://127.0.0.1:3000']),
    ),
  },
  optimizeDeps: { entries: ['index.html'] },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1600 },
});
