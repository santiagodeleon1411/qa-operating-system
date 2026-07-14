import { test, expect } from '@playwright/test';
import { EstocaPage, LOGINS, PRODUCTS } from './estoca-page';

// The frontend layer of the low-stock threshold feature (TC-18..22). The badge reflects the
// server's decision (never a client recompute), the threshold control is the owner's alone, and a
// change re-renders from the server's response without a reload. Each test forces the state it
// needs rather than trusting the seed, because the in-memory DB is shared across the run.

test('the badge reflects the server decision and the owner gets the threshold control', async ({
  page,
}) => {
  const estoca = new EstocaPage(page);
  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);

  // The owner sees the Threshold column and an inline control per row (TC-20).
  expect(await estoca.stockHeaders()).toContain('THRESHOLD');
  await expect(estoca.thresholdInput(PRODUCTS.cafe)).toBeVisible();

  // Push the threshold to the maximum so the server reports the Product below it; the badge must
  // follow the server's `belowThreshold`, which the UI renders as given (TC-18/19).
  await estoca.setThreshold(PRODUCTS.cafe, 10000);
  await expect(estoca.lowStockBadge(PRODUCTS.cafe)).toHaveText('Low stock');
});

test('saving a threshold flips the badge from the server response, without a reload (TC-22)', async ({
  page,
}) => {
  const estoca = new EstocaPage(page);
  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);

  // Give the Product a positive Stock. Recording a movement kicks off an async re-load of the shop;
  // wait for that entry to reach the history before touching the threshold, so the re-load cannot
  // land late and overwrite the change under test. With Stock ≥ 1, a threshold of 0 reads In stock.
  await estoca.recordMovement({
    product: PRODUCTS.cafe,
    kind: 'entry',
    quantity: 5,
    reason: 'baseline entry',
  });
  await expect(estoca.firstHistoryRow()).toContainText('baseline entry');
  await estoca.setThreshold(PRODUCTS.cafe, 0);
  await expect(estoca.statusCell(PRODUCTS.cafe)).toHaveText('In stock');

  // Mark the window; a full reload would wipe this, a re-render from the PATCH response keeps it.
  await page.evaluate(() => ((window as unknown as { __mark?: boolean }).__mark = true));

  // Raise the threshold to the maximum → the row must flip to Low stock from the server's returned view.
  await estoca.setThreshold(PRODUCTS.cafe, 10000);
  await expect(estoca.lowStockBadge(PRODUCTS.cafe)).toHaveText('Low stock');

  // The mark survived: no navigation happened — the row updated in place (TC-22).
  expect(await page.evaluate(() => (window as unknown as { __mark?: boolean }).__mark)).toBe(true);
});

test('an out-of-range threshold is refused with the backend message, badge unchanged', async ({
  page,
}) => {
  const estoca = new EstocaPage(page);
  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);

  await estoca.setThreshold(PRODUCTS.cafe, 99999);
  await expect(estoca.thresholdMessage).toHaveText('The threshold must be between 0 and 10000.');
});

// The threshold control is the owner's alone. Both non-owner roles are checked from the UI
// (TC-21 component / TC-06 e2e): the employee AND the runner. The 403 on PATCH /products is the
// real guarantee (TC-10, contract) — here we assert the screen never even offers the control, for
// every role that must not have it, so the two named roles are covered, not just one.
for (const role of [LOGINS.bruno, LOGINS.caro] as const) {
  test(`the threshold control is withheld from the ${role.role} (TC-21/TC-06)`, async ({ page }) => {
    const estoca = new EstocaPage(page);
    await estoca.login(role.username, role.password);

    // The column and every control are absent for this role...
    expect(await estoca.stockHeaders()).not.toContain('THRESHOLD');
    await expect(page.locator('.thr-input')).toHaveCount(0);
    await expect(page.locator('.thr-save')).toHaveCount(0);

    // ...but the low-stock signal itself is for everyone — it is the control, not the badge, that
    // is owner-only. Sugar seeds at Stock 0 under a threshold of 10, so it is always below
    // threshold: a badge renders for the non-owner too.
    await expect(estoca.lowStockBadge(PRODUCTS.azucar)).toBeVisible();
  });
}
