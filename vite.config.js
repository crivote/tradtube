import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm', '@ffmpeg/ffmpeg'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
  },
});
