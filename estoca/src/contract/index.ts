// Estoca — the contract between the frontend and the backend. See docs/adr/0007.
//
// This module is the single source of truth for the shape of every request and response
// that crosses the network boundary. From each schema come BOTH the static type the two
// sides code against (via `z.infer`) and the runtime validator that checks real payloads.
// There is no second, hand-written type that can fall out of step with the validation:
// change the schema and both the types and the checks move together.
//
// Faithful to `estoca/src/domain.ts`. Derived Stock is read-only here — it is sent to the
// screen but never accepted back as a writable field, so the invariant "the Stock never
// lies" cannot be reopened across the wire.

import { z } from 'zod';

export const movementKind = z.enum(['entry', 'exit']);

/**
 * The body of `POST /movements`: a request to record a movement.
 * There is no `at` — the server is authoritative on time (a client clock can be wrong or
 * in another timezone, and in an append-only ledger "when" is not a value to trust to the
 * caller). The domain rules are mirrored here so a malformed request is refused at the edge.
 */
const quantityRule = 'Una cantidad debe ser un número entero positivo.';
export const movementInput = z.object({
  productId: z.string().min(1, 'Falta indicar el Product.'),
  kind: movementKind,
  quantity: z.number({ error: quantityRule }).int(quantityRule).positive(quantityRule),
  reason: z.string().refine((s) => s.trim().length > 0, 'Un movimiento debe registrar un motivo.'),
});
export type MovementInput = z.infer<typeof movementInput>;

/** A recorded movement, as the server returns it. `at` is the server-stamped ISO time. */
export const movement = z.object({
  productId: z.string().min(1),
  kind: movementKind,
  quantity: z.number().int().positive(),
  reason: z.string().min(1),
  at: z.iso.datetime(),
});
export type Movement = z.infer<typeof movement>;

/**
 * A Product as shown on the shelf. `stock` and `stockout` are DERIVED server-side and are
 * read-only: they travel out to the screen but never come back as something writable.
 */
export const productView = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  threshold: z.number().int().nonnegative(),
  stock: z.number().int(),
  stockout: z.boolean(),
});
export type ProductView = z.infer<typeof productView>;

/** The body of `GET /products`: the catalogue with each Product's derived Stock. */
export const productsResponse = z.array(productView);
export type ProductsResponse = z.infer<typeof productsResponse>;

/**
 * The body returned when a movement is refused — by the domain rules or by the
 * `movements_no_negative_stock` trigger (ADR-0006). Drift on the error path is drift too,
 * so the error shape is part of the contract and validated like any other response.
 */
export const errorResponse = z.object({ error: z.string().min(1) });
export type ErrorResponse = z.infer<typeof errorResponse>;

/**
 * The body of `POST /adjustments`: reconcile a Product to a physical count. The Merchant
 * sends the absolute number they COUNTED, plus the Stock they saw when the count began
 * (`expectedStock`) so the server can measure the difference from that moment and detect a
 * Stock change during the count. The server never stores the counted number — it records
 * the difference as a movement. `counted`'s range (whole, non-negative) is enforced in the
 * domain, with the domain's messages. See docs/specs/stock-count-adjustment.md.
 */
export const adjustmentInput = z.object({
  productId: z.string().min(1, 'Falta indicar el Product.'),
  counted: z.number(),
  reason: z.string().refine((s) => s.trim().length > 0, 'Un movimiento debe registrar un motivo.'),
  expectedStock: z.number().int(),
  confirmed: z.boolean().optional(),
});
export type AdjustmentInput = z.infer<typeof adjustmentInput>;

/** `POST /adjustments` outcome: either the adjustment was recorded, or the count matched. */
export const adjustmentResult = z.discriminatedUnion('adjusted', [
  z.object({ adjusted: z.literal(true), movement }),
  z.object({ adjusted: z.literal(false) }),
]);
export type AdjustmentResult = z.infer<typeof adjustmentResult>;

/**
 * The body returned when the Stock changed between the count beginning and its submission.
 * The Merchant is asked to reconfirm; `currentStock` lets the screen show what it is now.
 */
export const staleCount = z.object({ error: z.string().min(1), currentStock: z.number().int() });
export type StaleCount = z.infer<typeof staleCount>;
