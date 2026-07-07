import { test, expect } from './fixtures';
import { PRODUCTS, LOGINS } from './estoca-page';

// The invariant Estoca exists to keep — "the Stock never lies" — proven through the real
// stack. An exit larger than what is on the shelf must be refused, the Merchant must see why,
// and the Stock must be left untouched. The rejection originates in the schema trigger
// (ADR-0006), travels back through the contract as a typed error, and lands as a message on
// the screen; this test is the only one that exercises that whole path at once.
test('an exit larger than the Stock is refused and leaves the Stock untouched', async ({ estoca }) => {
  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);
  const before = await estoca.stockOf(PRODUCTS.azucar);

  // One more than exists — impossible to satisfy without going negative, whatever the baseline.
  await estoca.recordMovement({
    product: PRODUCTS.azucar,
    kind: 'exit',
    quantity: before + 1,
    reason: 'Venta',
  });

  await expect(estoca.movementError).toHaveText('Una salida no puede dejar el Stock en negativo.');
  // The refusal is not cosmetic: the derived Stock is exactly what it was before the attempt.
  await expect(estoca.stockCell(PRODUCTS.azucar)).toHaveText(String(before));
});
