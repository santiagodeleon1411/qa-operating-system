import { test, expect } from './fixtures';
import { LOGINS } from './estoca-page';

// The whole shop is behind a session now (ADR-0008). This proves the gate end to end: no shop
// without a login, a wrong password refused, and the shop reached — as the named user — with
// the right one.
test('the shop is behind a login; wrong credentials are refused, right ones get in', async ({
  estoca,
  page,
}) => {
  await estoca.open();

  // The login screen, not the shop.
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current stock' })).toBeHidden();

  // A wrong password is refused, and the shop stays out of reach.
  await estoca.attemptLogin(LOGINS.ana.username, 'wrong');
  await expect(estoca.loginError).toContainText('Incorrect');
  await expect(page.getByRole('heading', { name: 'Current stock' })).toBeHidden();

  // The right credentials reach the shop, shown as the logged-in user.
  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);
  await expect(estoca.connectedAs).toContainText('Ana');
});
