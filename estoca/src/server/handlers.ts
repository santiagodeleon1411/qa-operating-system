// Estoca — the backend request handlers. See docs/adr/0007.
//
// These are pure functions of (repository, request) → { status, body }, deliberately
// independent of the transport: the `node:http` binding that calls them is trivial glue,
// added when the frontend is wired. Keeping them transport-free is what makes the contract
// fully testable without opening a port.
//
// Both edges of the contract are enforced here: every request is validated on the way in,
// and every response is validated against the contract on the way out, so the backend
// cannot silently drift from the shape the frontend was promised.

import type { MovementsRepo } from '../db/movements-repo';
import {
  movementInput,
  productsResponse,
  movement as movementSchema,
  type Movement,
  type ProductView,
  type ErrorResponse,
} from '../contract';

export interface HandlerResult<T> {
  status: number;
  body: T;
}

/** The first human-readable reason a payload failed the contract. */
function firstIssue(error: { issues: ReadonlyArray<{ message: string }> }): string {
  return error.issues[0]?.message ?? 'Solicitud inválida.';
}

/**
 * `GET /products` — the catalogue with each Product's derived Stock.
 * The response is validated against the contract before it leaves, so a drift in the read
 * model (a missing or renamed field) fails here rather than reaching the screen malformed.
 */
export function getProducts(repo: MovementsRepo): HandlerResult<ProductView[]> {
  const body = productsResponse.parse(repo.listProductViews());
  return { status: 200, body };
}

/**
 * `POST /movements` — record a movement.
 * A malformed request is refused at the edge (422). A well-formed request that the domain
 * rules or the never-negative trigger reject also returns the typed error shape (422),
 * never an unhandled crash. On success the created movement is echoed in contract shape.
 */
export function postMovement(
  repo: MovementsRepo,
  rawBody: unknown,
  now: string = new Date().toISOString(),
): HandlerResult<Movement | ErrorResponse> {
  const parsed = movementInput.safeParse(rawBody);
  if (!parsed.success) {
    return { status: 422, body: { error: firstIssue(parsed.error) } };
  }

  try {
    // The server is authoritative on time (ADR-0007): the caller does not send `at`.
    const created = repo.recordMovement({ ...parsed.data, at: now });
    return { status: 201, body: movementSchema.parse(created) };
  } catch (e) {
    return { status: 422, body: { error: (e as Error).message } };
  }
}
