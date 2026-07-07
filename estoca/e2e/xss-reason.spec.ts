import { test, expect } from './fixtures';
import { PRODUCTS, LOGINS } from './estoca-page';

// Regression guard for the stored-XSS the security review caught before this shipped: the
// movement `reason` is free text and is rendered into the history panel. It must render as
// TEXT, never as live markup. This is the test the green suite lacked when the hole existed.
test('a movement reason containing HTML is rendered as text, never executed', async ({ estoca, page }) => {
  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);

  const payload = '<img src=x onerror="window.__xss=true">';
  await estoca.recordMovement({ product: PRODUCTS.cafe, kind: 'entry', quantity: 1, reason: payload });

  // The history shows the literal text the Merchant typed…
  await expect(estoca.firstHistoryRow()).toContainText(payload);
  // …no <img> element was injected into the history…
  await expect(page.locator('#history img')).toHaveCount(0);
  // …and the payload never ran.
  expect(await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss)).toBeUndefined();
});
