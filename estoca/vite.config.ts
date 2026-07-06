import { defineConfig } from 'vite';

// In dev, the frontend and the backend are two separate processes (ADR-0007). Vite serves
// the frontend and proxies every /api/* request to the backend process, so the browser
// makes only same-origin requests — no CORS. The /api prefix is stripped before the
// request reaches the backend, which routes on /products and /movements.
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
