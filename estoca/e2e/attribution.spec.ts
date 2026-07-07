import { test, expect } from './fixtures';
import { PRODUCTS, LOGINS } from './estoca-page';

// The incident that opened ADR-0008: an action recorded in production could not be traced to a
// person. This proves the fix end to end — a movement recorded by a logged-in user shows that
// user's name in the visible history. "Who did this?" is now answerable on screen.
test('a recorded movement names who made it, visible in the history', async ({ estoca }) => {
  await estoca.login(LOGINS.bruno.username, LOGINS.bruno.password);

  await estoca.recordMovement({ product: PRODUCTS.cafe, kind: 'entry', quantity: 5, reason: 'Compra' });

  const latest = estoca.firstHistoryRow();
  await expect(latest).toContainText('Bruno'); // the actor, proven by the session — not claimed
  await expect(latest).toContainText(PRODUCTS.cafe);
  await expect(latest).toContainText('Compra');
});
