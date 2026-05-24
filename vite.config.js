import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

function ffmpegWorkerHeaders() {
  return {
    name: 'ffmpeg-worker-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/ffmpeg-worker.html') {
          res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [solidPlugin(), ffmpegWorkerHeaders()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
  },
});
