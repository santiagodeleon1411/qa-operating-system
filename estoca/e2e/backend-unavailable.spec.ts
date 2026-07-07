import { test, expect } from './fixtures';

// Crossing a network boundary introduced a failure mode localStorage never had: the backend
// being unreachable. The UI must not show a blank or broken screen — it must reassure the
// Merchant their data is safe and offer a retry (docs/adr/0007).
//
// Rather than kill the backend process (slow, and it would disrupt the serial run), the test
// intercepts the browser's own network calls and aborts them. From the app's point of view the
// backend is simply unreachable — the exact condition, produced deterministically.
test('when the backend is unreachable, the Merchant sees a reassuring message and a retry', async ({
  estoca,
  page,
}) => {
  // Scoped to the backend endpoints only. A broad '**/api/**' would also abort Vite's dev
  // module `src/api/client.ts` (served over HTTP with `/api/` in its path), breaking the app
  // itself instead of simulating an unreachable backend. `/me` is included because boot() asks
  // it first — with it aborted, the app cannot even tell whether there is a session.
  await page.route(/\/api\/(me|login|logout|products|movements|adjustments)/, (route) => route.abort());

  await estoca.open();

  await expect(estoca.unavailableAlert).toContainText('No pudimos cargar tu stock');
  await expect(estoca.unavailableAlert).toContainText('no se perdió nada');
  await expect(estoca.retryButton).toBeVisible();
});
