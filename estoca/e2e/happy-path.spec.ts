import { test, expect } from './fixtures';
import { PRODUCTS, LOGINS } from './estoca-page';

// The core loop of the product, end to end through the real stack: the Merchant records a
// movement and the derived Stock on the shelf reflects it — no more, no less. Asserted as a
// delta from the Stock this test found on arrival, so accumulated state from earlier tests
// cannot make it pass or fail by accident.
test('an entry raises the derived Stock by exactly the quantity recorded', async ({ estoca }) => {
  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);
  const before = await estoca.stockOf(PRODUCTS.cafe);

  await estoca.recordMovement({
    product: PRODUCTS.cafe,
    kind: 'entry',
    quantity: 7,
    reason: 'Purchase',
  });

  // toHaveText auto-retries until the screen re-reads the truth from the backend — no sleeps.
  await expect(estoca.stockCell(PRODUCTS.cafe)).toHaveText(String(before + 7));
});
