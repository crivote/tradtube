import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  // Necesario para sqlite-wasm: los headers COOP/COEP permiten SharedArrayBuffer
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  build: {
    target: 'esnext',
  },
});
