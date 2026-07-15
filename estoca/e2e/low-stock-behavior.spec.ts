import { test, expect } from '@playwright/test';
import { EstocaPage, LOGINS, PRODUCTS } from './estoca-page';

// The end-to-end BEHAVIOUR of the low-stock signal (TC-01..04), traced to the parent story #21.
// This is the black-box layer: it drives the real screen the way the Merchant does and asserts on
// what the Merchant sees — the badge — never on how it is computed. The contract layer already
// pins the `belowThreshold` calculation (TC-07/08) and the component layer pins how the row
// renders a given flag (TC-18/19); this layer pins that the whole stack, from a real click to a
// real pixel, tells the truth. The boundary and the reactivity are what only an end-to-end test
// can see.
//
// Each test FORCES the exact Stock and threshold it needs rather than trusting the seed: the
// backend keeps one in-memory database for the life of the run, so state accumulates. Forcing the
// state (and asserting on the resulting badge, never on an absolute seed value) is what keeps
// these deterministic regardless of order — the discipline the whole suite is built on.
//
// ORDER MATTERS, and for a reason worth naming: `setThreshold` fires an in-place re-render that
// no caller awaits, and `setStockTo` fills the movement form. If a threshold save were still
// re-rendering while the movement form was being filled, the re-render would replace the form
// mid-interaction and the movement's click would hit a stale node — the write would be lost. So
// every test does the form interactions in an order where nothing async is pending: `setStockTo`
// first (it ends by waiting for its own rendered Stock), THEN `setThreshold`, and any later form
// interaction is gated behind an auto-retrying assertion that absorbs the threshold re-render.

test('TC-01 — at stock equal to the threshold, the badge shows (the boundary is included)', async ({
  page,
}) => {
  const estoca = new EstocaPage(page);
  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);

  // The boundary is the whole point: "low stock" is stock ≤ threshold, so equality must trip it.
  // A test that only ever set stock well below the threshold would pass even if the code used `<`.
  await estoca.setStockTo(PRODUCTS.cafe, 10);
  await estoca.setThreshold(PRODUCTS.cafe, 10);

  // `toHaveText` is a web-first assertion: it retries until the row settles or the test times out,
  // so it waits out the threshold re-render without a sleep. Asserting the exact label also nails
  // TC-24's live-side (the badge reads "Low stock", in English) as a by-product.
  await expect(estoca.lowStockBadge(PRODUCTS.cafe)).toHaveText('Low stock');
});

test('TC-02 — one unit above the threshold, there is no badge', async ({ page }) => {
  const estoca = new EstocaPage(page);
  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);

  await estoca.setStockTo(PRODUCTS.cafe, 11);
  await estoca.setThreshold(PRODUCTS.cafe, 10);

  // The status cell reads "In stock" and the low-stock badge is absent. Asserting BOTH — the
  // positive text and the count of 0 badges — is deliberate: "no badge" is the claim, and an
  // empty locator alone could hide a badge that rendered with the wrong text.
  await expect(estoca.statusCell(PRODUCTS.cafe)).toHaveText('In stock');
  await expect(estoca.lowStockBadge(PRODUCTS.cafe)).toHaveCount(0);
});

test('TC-03 — a movement that drops stock to the threshold makes the badge appear, no reload', async ({
  page,
}) => {
  const estoca = new EstocaPage(page);
  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);

  // Start above the threshold: no badge. The status assertion below gates the threshold re-render,
  // so the DOM is fully settled before the action under test touches the movement form.
  await estoca.setStockTo(PRODUCTS.cafe, 11);
  await estoca.setThreshold(PRODUCTS.cafe, 10);
  await expect(estoca.statusCell(PRODUCTS.cafe)).toHaveText('In stock');

  // Mark the window. A full browser reload would wipe this; an in-app re-render keeps it. This is
  // how we prove "without page reload" is literally true and not just visually plausible.
  await page.evaluate(() => ((window as unknown as { __mark?: boolean }).__mark = true));

  // The action under test: one exit crosses stock down to the threshold (11 → 10).
  await estoca.recordMovement({
    product: PRODUCTS.cafe,
    kind: 'exit',
    quantity: 1,
    reason: 'sale',
  });

  // The badge appears, driven by the server's recomputed flag after the movement — the UI never
  // recomputed it from stock and threshold.
  await expect(estoca.lowStockBadge(PRODUCTS.cafe)).toHaveText('Low stock');
  // The mark survived: the row updated in place; the Merchant never reloaded the page (AC2).
  expect(await page.evaluate(() => (window as unknown as { __mark?: boolean }).__mark)).toBe(true);
});

test('TC-04 — a movement that raises stock above the threshold clears the badge, no reload', async ({
  page,
}) => {
  const estoca = new EstocaPage(page);
  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);

  // Start at the boundary: badge present. The badge assertion gates the threshold re-render.
  await estoca.setStockTo(PRODUCTS.cafe, 10);
  await estoca.setThreshold(PRODUCTS.cafe, 10);
  await expect(estoca.lowStockBadge(PRODUCTS.cafe)).toHaveText('Low stock');

  await page.evaluate(() => ((window as unknown as { __mark?: boolean }).__mark = true));

  // The action under test: one entry crosses stock above the threshold (10 → 11).
  await estoca.recordMovement({
    product: PRODUCTS.cafe,
    kind: 'entry',
    quantity: 1,
    reason: 'restock',
  });

  // The badge clears and the row returns to "In stock", again from the server's flag.
  await expect(estoca.statusCell(PRODUCTS.cafe)).toHaveText('In stock');
  await expect(estoca.lowStockBadge(PRODUCTS.cafe)).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __mark?: boolean }).__mark)).toBe(true);
});
