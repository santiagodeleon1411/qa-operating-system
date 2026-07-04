// Estoca — domain core.
//
// The single invariant this whole product exists to protect: "the Stock never lies."
// Stock is NEVER stored as a mutable number. It is always DERIVED from the Merchant's
// Stock movements — an append-only list of entries and exits. A number that does not
// exist cannot drift. See docs/adr/0003-genesis-quality-posture.md.

export type MovementKind = 'entry' | 'exit';

/** An item a Merchant stocks and sells, tracked as a single stock-keeping unit. */
export interface Product {
  id: string;
  name: string;
  /** The Merchant-defined Stock level at or below which the Product is in Stockout. */
  threshold: number;
}

/** A recorded event that changes Stock. Stock is always the sum of its movements. */
export interface StockMovement {
  productId: string;
  kind: MovementKind;
  /** Always a positive amount; `kind` decides whether it adds or subtracts. */
  quantity: number;
  reason: string;
  at: string; // ISO timestamp
}

/**
 * The Stock of a Product: the sum of its movements (+entries, −exits).
 * This is the invariant made structural — there is no stored counter to corrupt.
 */
export function stockOf(productId: string, movements: readonly StockMovement[]): number {
  return movements
    .filter((m) => m.productId === productId)
    .reduce((sum, m) => sum + (m.kind === 'entry' ? m.quantity : -m.quantity), 0);
}

/** A Product is in Stockout when its Stock reaches or drops below its threshold. */
export function isStockout(product: Product, movements: readonly StockMovement[]): boolean {
  return stockOf(product.id, movements) <= product.threshold;
}

/**
 * Build a valid Stock movement, rejecting the inputs that would let "Stock lie".
 * A movement without a positive whole quantity, or without a reason, is not a real
 * movement and must never reach the ledger.
 */
export function makeMovement(input: {
  productId: string;
  kind: MovementKind;
  quantity: number;
  reason: string;
  at: string;
}): StockMovement {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('Una cantidad debe ser un número entero positivo.');
  }
  if (!input.reason.trim()) {
    throw new Error('Un movimiento debe registrar un motivo.');
  }
  return { ...input };
}

/**
 * Whether applying this movement would drop the Product's Stock below zero.
 * Physical Stock can never be negative, so an exit larger than what is on hand is a
 * lie and must be rejected before it reaches the ledger.
 */
export function wouldGoNegative(
  movement: StockMovement,
  movements: readonly StockMovement[],
): boolean {
  const current = stockOf(movement.productId, movements);
  const delta = movement.kind === 'entry' ? movement.quantity : -movement.quantity;
  return current + delta < 0;
}
