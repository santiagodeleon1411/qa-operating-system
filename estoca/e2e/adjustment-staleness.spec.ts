import { test, expect } from './fixtures';
import { PRODUCTS, PRODUCT_IDS, LOGINS } from './estoca-page';

const API = 'http://localhost:3001';

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
  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);
  const snapshot = await estoca.stockOf(PRODUCTS.yerba); // the number the count is measured against

  // A "second device" — a different user, Bruno — logs in to the backend directly and records
  // an entry of 3. The write now requires its own session (a 401 otherwise), exactly as a real
  // second device would. Ana's open screen never learns: its snapshot is now stale by 3.
  const auth = await request.post(`${API}/login`, {
    data: { username: LOGINS.bruno.username, password: LOGINS.bruno.password },
  });
  expect(auth.ok()).toBeTruthy();
  const resp = await request.post(`${API}/movements`, {
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
