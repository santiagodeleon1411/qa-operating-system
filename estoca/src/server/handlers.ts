// Estoca — the backend request handlers. See docs/adr/0007 and docs/adr/0008.
//
// These are pure functions of (repository, actor, request) → { status, body }, deliberately
// independent of the transport: the `node:http` binding that calls them is trivial glue. The
// session token is resolved to an actor by the transport and passed in here, so the
// authentication guard — and every "who recorded this" decision — lives in this tested layer,
// not in the untested plumbing.
//
// Both edges of the contract are enforced here: every request is validated on the way in, and
// every response is validated against the contract on the way out. Identity adds a third
// enforcement: a write with no authenticated actor is refused (401) before it can reach the
// ledger, and the actor stamped on a movement is the session's user, never the caller's claim.

import type { MovementsRepo } from '../db/movements-repo';
import type { ProductsRepo } from '../db/products-repo';
import type { AuthRepo, SessionUser } from '../db/auth-repo';
import { canRecordMovement, canRecordAdjustment, canSetThreshold } from '../authz';
import { planAdjustment } from '../domain';
import {
  movementInput,
  adjustmentInput,
  setThresholdInput,
  credentials as credentialsSchema,
  productsResponse,
  productView as productViewSchema,
  movementsResponse,
  movement as movementSchema,
  sessionUser as sessionUserSchema,
  type Movement,
  type ProductView,
  type ErrorResponse,
  type AdjustmentResult,
  type StaleCount,
} from '../contract';

export interface HandlerResult<T> {
  status: number;
  body: T;
  /** Transport instruction: a token to set as the session cookie, `null` to clear it. */
  setSession?: string | null;
}

/** Session lifetime: eight hours — a shop shift. Long enough to work, short enough to expire. */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const UNAUTHENTICATED: HandlerResult<ErrorResponse> = {
  status: 401,
  body: { error: 'You must sign in to continue.' },
};

// 403 is a different refusal from 401: the actor IS authenticated, but their role does not permit
// this action (ADR-0008, authorization). 401 says "log in"; 403 says "you may not". The guard is
// here, in the tested layer, not in the transport — and it stamps nothing on the ledger.
const FORBIDDEN: HandlerResult<ErrorResponse> = {
  status: 403,
  body: { error: 'Your role is not permitted to perform this action.' },
};

/** The first human-readable reason a payload failed the contract. */
function firstIssue(error: { issues: ReadonlyArray<{ message: string }> }): string {
  return error.issues[0]?.message ?? 'Invalid request.';
}

// --- Identity -------------------------------------------------------------------------------

/**
 * `POST /login` — verify credentials and open a session.
 * On success the session token is returned as a `setSession` transport instruction (it becomes
 * an httpOnly cookie, never a response field). A wrong username and a wrong password fail
 * identically (401), so the response cannot be used to discover which usernames exist.
 */
export function login(
  auth: AuthRepo,
  rawBody: unknown,
  now: string = new Date().toISOString(),
): HandlerResult<SessionUser | ErrorResponse> {
  const parsed = credentialsSchema.safeParse(rawBody);
  if (!parsed.success) return { status: 422, body: { error: firstIssue(parsed.error) } };

  const user = auth.authenticate(parsed.data.username, parsed.data.password);
  if (!user) return { status: 401, body: { error: 'Incorrect username or password.' } };

  const expiresAt = new Date(new Date(now).getTime() + SESSION_TTL_MS).toISOString();
  const token = auth.createSession(user.id, expiresAt);
  return { status: 200, body: sessionUserSchema.parse(user), setSession: token };
}

/** `POST /logout` — close the current session (if any) and clear the cookie. */
export function logout(auth: AuthRepo, token: string | null): HandlerResult<{ ok: true }> {
  if (token) auth.deleteSession(token);
  return { status: 200, body: { ok: true }, setSession: null };
}

/** `GET /me` — the current user, or 401 if there is no valid session. */
export function me(actor: SessionUser | null): HandlerResult<SessionUser | ErrorResponse> {
  if (!actor) return UNAUTHENTICATED;
  return { status: 200, body: sessionUserSchema.parse(actor) };
}

// --- Stock (all behind the session; ADR-0008 decision 3) -----------------------------------

/** `GET /products` — the catalogue with each Product's derived Stock. Requires a session. */
export function getProducts(
  products: ProductsRepo,
  actor: SessionUser | null,
): HandlerResult<ProductView[] | ErrorResponse> {
  if (!actor) return UNAUTHENTICATED;
  return { status: 200, body: productsResponse.parse(products.listProductViews()) };
}

/**
 * `PATCH /products` — set a Product's low-stock threshold. Owner-only, and the guard turns on
 * the role alone: a non-owner is refused (403) BEFORE the body is parsed, so nothing is stored
 * and a forbidden caller cannot even probe the payload rules. A malformed or out-of-range
 * threshold is then refused at the edge (422) with the domain's own message. The accepted change
 * is stamped with the acting owner and recorded (attribution), and the updated Product view is
 * returned so the screen can reflect the new low-stock state without a reload.
 */
export function setThreshold(
  products: ProductsRepo,
  actor: SessionUser | null,
  rawBody: unknown,
  now: string = new Date().toISOString(),
): HandlerResult<ProductView | ErrorResponse> {
  if (!actor) return UNAUTHENTICATED;
  if (!canSetThreshold(actor.role)) return FORBIDDEN;
  const parsed = setThresholdInput.safeParse(rawBody);
  if (!parsed.success) return { status: 422, body: { error: firstIssue(parsed.error) } };

  const updated = products.setThreshold(parsed.data.productId, parsed.data.threshold, actor.id, now);
  if (!updated) return { status: 404, body: { error: 'That Product does not exist.' } };
  return { status: 200, body: productViewSchema.parse(updated) };
}

/** `GET /movements` — the recent ledger, each movement carrying who recorded it. */
export function getMovements(
  repo: MovementsRepo,
  actor: SessionUser | null,
): HandlerResult<Movement[] | ErrorResponse> {
  if (!actor) return UNAUTHENTICATED;
  return { status: 200, body: movementsResponse.parse(repo.listMovements()) };
}

/**
 * `POST /movements` — record a movement, stamped with the authenticated actor.
 * A missing session is refused (401) before anything reaches the ledger. A malformed request
 * is refused at the edge (422); a domain or never-negative refusal returns the typed error.
 */
export function postMovement(
  repo: MovementsRepo,
  actor: SessionUser | null,
  rawBody: unknown,
  now: string = new Date().toISOString(),
): HandlerResult<Movement | ErrorResponse> {
  if (!actor) return UNAUTHENTICATED;
  const parsed = movementInput.safeParse(rawBody);
  if (!parsed.success) return { status: 422, body: { error: firstIssue(parsed.error) } };
  if (!canRecordMovement(actor.role, parsed.data.kind)) return FORBIDDEN;

  try {
    const created = repo.recordMovement({ ...parsed.data, at: now, actorId: actor.id });
    return { status: 201, body: movementSchema.parse({ ...created, actorId: actor.id, actorName: actor.name }) };
  } catch (e) {
    return { status: 422, body: { error: (e as Error).message } };
  }
}

/**
 * `POST /adjustments` — reconcile a Product to a physical count, stamped with the actor.
 * Requires a session. Otherwise unchanged from ADR-0007: 409 on a stale count, 200 when the
 * count matches, 422 on an invalid count or a never-negative refusal.
 */
export function postAdjustment(
  repo: MovementsRepo,
  actor: SessionUser | null,
  rawBody: unknown,
  now: string = new Date().toISOString(),
): HandlerResult<AdjustmentResult | StaleCount | ErrorResponse> {
  if (!actor) return UNAUTHENTICATED;
  const parsed = adjustmentInput.safeParse(rawBody);
  if (!parsed.success) return { status: 422, body: { error: firstIssue(parsed.error) } };
  const { productId, counted, reason, expectedStock, confirmed } = parsed.data;
  // Authorization precedes the stale check: a forbidden actor is refused before it can even
  // learn the current Stock from a 409.
  if (!canRecordAdjustment(actor.role, reason)) return FORBIDDEN;

  const currentStock = repo.deriveStock(productId);
  if (!confirmed && currentStock !== expectedStock) {
    return { status: 409, body: { error: 'Stock changed since the count began.', currentStock } };
  }

  try {
    const mv = planAdjustment({ productId, counted, snapshotStock: expectedStock, reason, at: now });
    if (mv === null) return { status: 200, body: { adjusted: false } };
    const created = repo.recordMovement({ ...mv, actorId: actor.id });
    return {
      status: 201,
      body: { adjusted: true, movement: movementSchema.parse({ ...created, actorId: actor.id, actorName: actor.name }) },
    };
  } catch (e) {
    return { status: 422, body: { error: (e as Error).message } };
  }
}

export { SESSION_TTL_MS };
