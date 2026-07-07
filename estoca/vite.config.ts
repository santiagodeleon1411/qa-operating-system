/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

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
  // Vitest runs the fast unit and contract tests only. The end-to-end tests live under e2e/
  // and are run by Playwright, not Vitest — restrict the include so Vitest never tries to
  // load a *.spec.ts that imports @playwright/test.
  test: {
    include: ['src/**/*.test.ts'],
  },
});
