// Estoca — the frontend's client for the backend. See docs/adr/0007.
//
// This is the frontend's side of the contract. Every response the backend sends is
// validated here against the SAME schema the backend validated it against on the way out.
// If the backend ever drifts from the agreed shape, this parse throws instead of letting a
// malformed payload be silently mis-read by the screen — the drift is caught at the edge,
// on this side too.

import {
  productsResponse,
  movement as movementSchema,
  errorResponse,
  adjustmentResult,
  staleCount,
  type ProductView,
  type MovementInput,
  type Movement,
  type AdjustmentInput,
} from '../contract';

// Same-origin path: Vite proxies /api to the backend process in dev (see vite.config.ts),
// so the browser never makes a cross-origin request and no CORS handling is needed.
const BASE = '/api';

/** Raised when the backend refuses a movement (a domain rule or the never-negative trigger). */
export class MovementRefused extends Error {}

/** `GET /products` — the catalogue with Stock derived by the backend. */
export async function fetchProducts(f: typeof fetch = fetch): Promise<ProductView[]> {
  const res = await f(`${BASE}/products`);
  if (!res.ok) throw new Error(`El backend respondió ${res.status} al pedir el stock.`);
  return productsResponse.parse(await res.json());
}

/**
 * `POST /movements` — record a movement. Returns the created movement on success; throws
 * `MovementRefused` with the backend's message when the movement is refused (HTTP 422).
 */
export async function recordMovement(input: MovementInput, f: typeof fetch = fetch): Promise<Movement> {
  const res = await f(`${BASE}/movements`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (res.status === 201) return movementSchema.parse(json);
  // A refusal still arrives in the contract's typed error shape.
  throw new MovementRefused(errorResponse.parse(json).error);
}

/** The outcome of a physical-count adjustment. `stale` asks the Merchant to reconfirm. */
export type AdjustmentOutcome =
  | { kind: 'recorded'; movement: Movement }
  | { kind: 'unchanged' }
  | { kind: 'stale'; currentStock: number };

/**
 * `POST /adjustments` — reconcile a Product to a physical count. Returns the outcome; throws
 * `MovementRefused` when the count/reason is invalid or the result would make Stock negative.
 */
export async function recordAdjustment(input: AdjustmentInput, f: typeof fetch = fetch): Promise<AdjustmentOutcome> {
  const res = await f(`${BASE}/adjustments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (res.status === 409) return { kind: 'stale', currentStock: staleCount.parse(json).currentStock };
  if (res.status === 201 || res.status === 200) {
    const result = adjustmentResult.parse(json);
    return result.adjusted ? { kind: 'recorded', movement: result.movement } : { kind: 'unchanged' };
  }
  throw new MovementRefused(errorResponse.parse(json).error);
}
