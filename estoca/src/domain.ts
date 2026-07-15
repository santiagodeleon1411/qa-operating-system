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
  /**
   * The Merchant-defined Stock level at or below which the Product warns as low on Stock.
   * `null` means the owner has not set one yet — a real "unset" state, distinct from an
   * explicit value — and it resolves to `DEFAULT_THRESHOLD` on read (see `effectiveThreshold`).
   */
  threshold: number | null;
}

/**
 * The threshold a Product with none set falls back to. The default must fail toward the
 * ALERT, never toward silence: a silent stockout is the worst outcome for the owner, while a
 * false low-stock warning is only noise. So an unset Product warns as if its threshold were 5.
 */
export const DEFAULT_THRESHOLD = 5;

/**
 * The closed sanity range a settable threshold must fall in. The upper bound is a DEFENSIVE
 * cap against typos and abuse, not a model of the business (a shop reorders in tens or low
 * hundreds) — revisit if Estoca grows to high-volume SKUs. See docs specs / issue #21.
 */
export const THRESHOLD_MIN = 0;
export const THRESHOLD_MAX = 10_000;

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

/** A Product's effective low-stock threshold: its own, or the default when the owner set none. */
export function effectiveThreshold(product: Pick<Product, 'threshold'>): number {
  return product.threshold ?? DEFAULT_THRESHOLD;
}

/**
 * The low-stock rule itself, over an already-known Stock level: a Product is low when its Stock
 * reaches or drops below its effective threshold. This is the single source both callers share —
 * the read model (which derives Stock in SQL) and `isBelowThreshold` (which derives it from the
 * ledger) — so the rule that ships is the rule the unit tests cover.
 */
export function isLowStock(stock: number, product: Pick<Product, 'threshold'>): boolean {
  return stock <= effectiveThreshold(product);
}

/** A Product is low on Stock when its Stock reaches or drops below its effective threshold. */
export function isBelowThreshold(product: Product, movements: readonly StockMovement[]): boolean {
  return isLowStock(stockOf(product.id, movements), product);
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
    throw new Error('A quantity must be a positive whole number.');
  }
  if (!input.reason.trim()) {
    throw new Error('A movement must record a reason.');
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

/**
 * Turn a physical count into the movement that reconciles the ledger to it — never into a
 * stored Stock. The Merchant enters the absolute number they counted; this records the
 * DIFFERENCE against the Stock seen when the count began (`snapshotStock`) as one adjustment
 * movement. Measuring the difference from the count (not from a later moment) keeps
 * legitimate movements made during the count correct. See docs/specs/stock-count-adjustment.md.
 *
 * Returns `null` when the count already matches — a movement that changes nothing is not
 * recorded. Throws when the count is not a whole, non-negative number of units.
 */
export function planAdjustment(input: {
  productId: string;
  counted: number;
  snapshotStock: number;
  reason: string;
  at: string;
}): StockMovement | null {
  if (!Number.isInteger(input.counted)) {
    throw new Error('Units are counted in whole numbers.');
  }
  if (input.counted < 0) {
    throw new Error('A count cannot be negative.');
  }
  const delta = input.counted - input.snapshotStock;
  if (delta === 0) return null; // the count matches the system; nothing to adjust
  return makeMovement({
    productId: input.productId,
    kind: delta > 0 ? 'entry' : 'exit',
    quantity: Math.abs(delta),
    reason: input.reason,
    at: input.at,
  });
}
