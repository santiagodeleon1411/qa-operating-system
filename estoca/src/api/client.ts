// Estoca — the frontend's client for the backend. See docs/adr/0007 and docs/adr/0008.
//
// This is the frontend's side of the contract. Every response the backend sends is validated
// here against the SAME schema the backend validated it against on the way out, so drift is
// caught at the edge on this side too. The session travels as an httpOnly cookie the browser
// attaches automatically; this code never sees or handles the token.

import {
  productsResponse,
  productView as productViewSchema,
  movementsResponse,
  movement as movementSchema,
  errorResponse,
  adjustmentResult,
  staleCount,
  credentials as credentialsSchema,
  sessionUser as sessionUserSchema,
  type ProductView,
  type Movement,
  type MovementInput,
  type AdjustmentInput,
  type SetThresholdInput,
  type Credentials,
  type SessionUser,
} from '../contract';

// Same-origin path: Vite proxies /api to the backend process in dev (see vite.config.ts).
const BASE = '/api';

// `same-origin` sends the session cookie on every request (the default, made explicit).
const send = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(`${BASE}${path}`, { credentials: 'same-origin', ...init });

const jsonPost = (path: string, body: unknown): Promise<Response> =>
  send(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const jsonPatch = (path: string, body: unknown): Promise<Response> =>
  send(path, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** Raised when the backend refuses a movement (a domain rule or the never-negative trigger). */
export class MovementRefused extends Error {}

/** Raised when a request needs a session and there is none (HTTP 401). */
export class NotAuthenticated extends Error {}

/** Raised when the actor is authenticated but their role does not permit the action (HTTP 403). */
export class Forbidden extends Error {}

/** Raised when the backend rejects a threshold value — non-integer or out of range (HTTP 422). */
export class ThresholdRefused extends Error {}

// --- Identity -------------------------------------------------------------------------------

/** `POST /login` — returns the user on success; throws NotAuthenticated on bad credentials. */
export async function login(input: Credentials): Promise<SessionUser> {
  const res = await jsonPost('/login', credentialsSchema.parse(input));
  const json = await res.json();
  if (res.ok) return sessionUserSchema.parse(json);
  throw new NotAuthenticated(errorResponse.parse(json).error);
}

/** `POST /logout` — end the session. */
export async function logout(): Promise<void> {
  await send('/logout', { method: 'POST' });
}

/** `GET /me` — the current user, or null when there is no valid session. */
export async function fetchMe(): Promise<SessionUser | null> {
  const res = await send('/me');
  if (res.status === 401) return null;
  return sessionUserSchema.parse(await res.json());
}

// --- Stock ----------------------------------------------------------------------------------

/** `GET /products` — throws NotAuthenticated on 401, so the UI can show the login screen. */
export async function fetchProducts(): Promise<ProductView[]> {
  const res = await send('/products');
  if (res.status === 401) throw new NotAuthenticated('Session required.');
  if (!res.ok) throw new Error(`The backend responded ${res.status} when requesting stock.`);
  return productsResponse.parse(await res.json());
}

/**
 * `PATCH /products` — the owner sets a Product's low-stock threshold. Returns the updated
 * Product view (so the row can reflect the new low-stock state without a reload). Throws
 * `Forbidden` when the caller is not the owner (403), `NotAuthenticated` on 401, and
 * `ThresholdRefused` with the backend's message when the value is rejected (422).
 */
export async function setThreshold(input: SetThresholdInput): Promise<ProductView> {
  const res = await jsonPatch('/products', input);
  const json = await res.json();
  if (res.status === 200) return productViewSchema.parse(json);
  if (res.status === 401) throw new NotAuthenticated('Session required.');
  if (res.status === 403) throw new Forbidden(errorResponse.parse(json).error);
  throw new ThresholdRefused(errorResponse.parse(json).error);
}

/** `GET /movements` — the recent ledger, each movement carrying who recorded it. */
export async function fetchMovements(): Promise<Movement[]> {
  const res = await send('/movements');
  if (res.status === 401) throw new NotAuthenticated('Session required.');
  if (!res.ok) throw new Error(`The backend responded ${res.status} when requesting the history.`);
  return movementsResponse.parse(await res.json());
}

/**
 * `POST /movements` — record a movement. Returns the created movement on success; throws
 * `MovementRefused` with the backend's message when the movement is refused (HTTP 422).
 */
export async function recordMovement(input: MovementInput): Promise<Movement> {
  const res = await jsonPost('/movements', input);
  const json = await res.json();
  if (res.status === 201) return movementSchema.parse(json);
  if (res.status === 401) throw new NotAuthenticated('Session required.');
  if (res.status === 403) throw new Forbidden(errorResponse.parse(json).error);
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
export async function recordAdjustment(input: AdjustmentInput): Promise<AdjustmentOutcome> {
  const res = await jsonPost('/adjustments', input);
  const json = await res.json();
  if (res.status === 409) return { kind: 'stale', currentStock: staleCount.parse(json).currentStock };
  if (res.status === 201 || res.status === 200) {
    const result = adjustmentResult.parse(json);
    return result.adjusted ? { kind: 'recorded', movement: result.movement } : { kind: 'unchanged' };
  }
  if (res.status === 401) throw new NotAuthenticated('Session required.');
  if (res.status === 403) throw new Forbidden(errorResponse.parse(json).error);
  throw new MovementRefused(errorResponse.parse(json).error);
}
