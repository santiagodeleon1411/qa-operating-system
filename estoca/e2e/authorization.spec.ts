import { test, expect } from './fixtures';
import { PRODUCT_IDS, LOGINS } from './estoca-page';

const API = 'http://localhost:3001';

// Authorization, slice 2 (ADR-0008, docs/specs/authorization-role-model.md). The UI reflects each
// role's permissions, but the guarantee is server-side. These tests prove both: the screen shows
// a role only what it may do, AND the server refuses a forbidden action even when a caller reaches
// straight past the screen to the API.

test('the server refuses a theft classification by an employee, even reaching past the UI', async ({
  request,
}) => {
  // Bruno is an employee. The screen never offers him "Theft or loss"; this drives straight to
  // the API — the second-device move — to prove the SERVER, not the UI, is the guarantee.
  const auth = await request.post(`${API}/login`, {
    data: { username: LOGINS.bruno.username, password: LOGINS.bruno.password },
  });
  expect(auth.ok()).toBeTruthy();

  const res = await request.post(`${API}/adjustments`, {
    data: { productId: PRODUCT_IDS.cafe, counted: 0, reason: 'Theft or loss', expectedStock: 0 },
  });
  expect(res.status()).toBe(403); // authenticated, but the role may not classify a loss
});

test('the runner sees only what the runner may do', async ({ estoca, page }) => {
  await estoca.login(LOGINS.caro.username, LOGINS.caro.password);

  // The runner records no adjustments: the panel is absent entirely.
  await expect(page.getByRole('heading', { name: 'Adjust by physical count' })).toBeHidden();

  // And the movement type offers only Exit (deliveries out), never Entry (restocking).
  const kinds = page.locator('#movement-form select[name=kind] option');
  await expect(kinds).toHaveCount(1);
  await expect(kinds.first()).toContainText('Exit');
});

test('the theft classification is offered to the owner, withheld from the employee', async ({
  estoca,
  page,
}) => {
  const theft = '#adjust-form select[name=reason] option:has-text("Theft or loss")';
  const shortfall = '#adjust-form select[name=reason] option:has-text("Unclassified shortfall")';

  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);
  await expect(page.locator(theft)).toHaveCount(1); // the owner may classify a loss

  await estoca.logout();
  await estoca.login(LOGINS.bruno.username, LOGINS.bruno.password);
  await expect(page.locator(theft)).toHaveCount(0); // the employee may not…
  await expect(page.locator(shortfall)).toHaveCount(1); // …but can still record the shortfall
});
