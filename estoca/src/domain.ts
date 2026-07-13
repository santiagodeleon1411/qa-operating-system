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
export function effectiveThreshold(product: Product): number {
  return product.threshold ?? DEFAULT_THRESHOLD;
}

/** A Product is low on Stock when its Stock reaches or drops below its effective threshold. */
export function isBelowThreshold(product: Product, movements: readonly StockMovement[]): boolean {
  return stockOf(product.id, movements) <= effectiveThreshold(product);
}

/**
 * Validate a threshold the owner is trying to set, rejecting the inputs that a low-stock
 * setting must never hold: a non-whole number, or one outside the closed sanity range. A
 * value that fails here is not stored — the threshold, like a movement, is refused before it
 * can reach the store. Returns the value unchanged when it is valid, for use at the boundary.
 */
export function assertValidThreshold(value: number): number {
  if (!Number.isInteger(value)) {
    throw new Error('El umbral debe ser un número entero.');
  }
  if (value < THRESHOLD_MIN || value > THRESHOLD_MAX) {
    throw new Error(`El umbral debe estar entre ${THRESHOLD_MIN} y ${THRESHOLD_MAX}.`);
  }
  return value;
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
    throw new Error('Las unidades se cuentan en números enteros.');
  }
  if (input.counted < 0) {
    throw new Error('Un conteo no puede ser negativo.');
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
