import { defineConfig, devices } from '@playwright/test';

// Estoca — the end-to-end safety net. These are the only tests that drive the REAL stack the
// way the Merchant does: a real browser, clicking a real screen, against the real backend and
// its database. Everything below the browser (domain, handlers, contract) is already covered
// by fast unit and contract tests; the pyramid keeps this layer small and high-value.
//
// The backend keeps a single in-memory database for the life of its process, so Stock
// ACCUMULATES across tests within one run — it does not reset per test. Two consequences,
// both deliberate:
//   1. `workers: 1` — tests run serially, never in parallel against the shared stateful
//      backend, so one test can never race another's writes. Determinism over speed; the
//      suite is small and speed is not the constraint here.
//   2. Tests assert on the CHANGE in Stock (read a baseline, act, check the delta), never on
//      an absolute value — so accumulated state and test order cannot make them lie. A suite
//      whose result depended on order would contradict the one thing Estoca promises.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI, // a stray test.only must fail the CI gate, not silently narrow it
  // One retry in CI only: it absorbs infrastructure flakiness (a slow port, a cold first
  // start) without hiding a real bug — a genuine failure fails both attempts. Locally, zero:
  // a flaky test should hurt so it gets fixed, not silently retried away.
  retries: process.env.CI ? 1 : 0,
  // 'list' for readable console output; 'html' writes playwright-report/ so a failed CI run has
  // an inspectable report to upload. `open: 'never'` keeps it from popping a browser locally.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Playwright starts BOTH processes before the tests and waits until each port is listening,
  // then shuts them down at the end — the two terminals we used to run by hand, now automated.
  // reuseExistingServer lets a dev server already running locally be reused; in CI it is never
  // reused, so every run starts from a fresh process and therefore a fresh, empty database.
  webServer: [
    {
      command: 'npm run dev:api',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
