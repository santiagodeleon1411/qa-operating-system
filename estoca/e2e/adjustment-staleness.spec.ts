import { test, expect } from './fixtures';
import { PRODUCTS, PRODUCT_IDS } from './estoca-page';

// The physical-count adjustment, and its subtlest rule: staleness. A count is measured against
// the Stock the screen showed when it began. If the Stock changes DURING the count (another
// device sells an item), submitting blindly would record a difference against a number that is
// no longer true — so the backend refuses (409) and asks the Merchant to reconfirm.
//
// A single user cannot create that race through the screen alone: every action here reloads
// the snapshot. So the test reaches PAST the UI, straight to the API, to move the Stock while
// the open screen's snapshot goes stale — reproducing exactly what a second device would do.
test('a Stock change during the count forces a reconfirm, then the adjustment records', async ({
  estoca,
  request,
}) => {
  await estoca.goto();
  const snapshot = await estoca.stockOf(PRODUCTS.yerba); // the number the count is measured against

  // A "second device" records an entry of 3, straight to the backend. The open screen never
  // learns — its snapshot is now stale by exactly 3.
  const resp = await request.post('http://localhost:3001/movements', {
    data: { productId: PRODUCT_IDS.yerba, kind: 'entry', quantity: 3, reason: 'Compra' },
  });
  expect(resp.ok()).toBeTruthy();

  // The Merchant submits their physical count. The backend sees the snapshot no longer matches
  // the real Stock and refuses, showing what the Stock is now (snapshot + 3).
  const counted = snapshot + 10;
  await estoca.adjust({ product: PRODUCTS.yerba, counted, reason: 'Error de carga' });
  await expect(estoca.adjustMessage).toContainText(`ahora hay ${snapshot + 3}`);
  await expect(estoca.reconfirmButton).toBeVisible();

  // The Merchant reconfirms: the count is still valid. The difference is recorded from the
  // ORIGINAL snapshot (counted − snapshot = +10), on top of the second device's +3.
  await estoca.reconfirmButton.click();
  await expect(estoca.stockCell(PRODUCTS.yerba)).toHaveText(String(snapshot + 13));
});
