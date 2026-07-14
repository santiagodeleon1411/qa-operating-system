import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../db/schema';
import { MovementsRepo } from '../db/movements-repo';
import { ProductsRepo } from '../db/products-repo';
import { AuthRepo } from '../db/auth-repo';
import { login, logout, me, getProducts, setThreshold, getMovements, postMovement, postAdjustment } from './handlers';
import { sessionUser, errorResponse } from '../contract';

const at = '2026-07-06T00:00:00.000Z';

describe('login', () => {
  let auth: AuthRepo;
  beforeEach(() => {
    auth = new AuthRepo(createDb());
  });

  it('accepts valid credentials, returns the user, and issues a session token', () => {
    const res = login(auth, { username: 'ana', password: 'estoca-ana' }, at);
    expect(res.status).toBe(200);
    expect(sessionUser.parse(res.body)).toMatchObject({ username: 'ana', name: 'Ana' });
    expect(typeof res.setSession).toBe('string'); // a cookie the transport will set
    expect(JSON.stringify(res.body)).not.toContain(res.setSession as string); // token never in the body
  });

  it('rejects wrong credentials with 401 and issues no session', () => {
    const res = login(auth, { username: 'ana', password: 'incorrecta' }, at);
    expect(res.status).toBe(401);
    expect(() => errorResponse.parse(res.body)).not.toThrow();
    expect(res.setSession).toBeUndefined();
  });

  it('refuses a malformed login body at the boundary (422)', () => {
    const res = login(auth, { username: 'ana' }, at); // no password
    expect(res.status).toBe(422);
  });
});

describe('logout and me', () => {
  it('logout clears the cookie', () => {
    const auth = new AuthRepo(createDb());
    const res = logout(auth, 'some-token');
    expect(res.status).toBe(200);
    expect(res.setSession).toBeNull(); // instruct the transport to clear the cookie
  });

  it('me returns the user when authenticated, 401 when not', () => {
    const actor = { id: 'u-ana', username: 'ana', name: 'Ana', role: 'owner' as const };
    expect(me(actor).status).toBe(200);
    expect(me(null).status).toBe(401);
  });
});

describe('the session guard — no write, and no read, reaches the ledger without a session', () => {
  let repo: MovementsRepo;
  let products: ProductsRepo;
  beforeEach(() => {
    const db = createDb();
    repo = new MovementsRepo(db);
    products = new ProductsRepo(db);
  });

  it('refuses every protected endpoint with 401 when there is no actor', () => {
    const body = { productId: 'p-cafe', kind: 'entry', quantity: 1, reason: 'purchase' };
    const adj = { productId: 'p-cafe', counted: 0, reason: 'x', expectedStock: 0 };
    for (const res of [
      getProducts(products, null),
      setThreshold(products, null, { productId: 'p-cafe', threshold: 7 }, at),
      getMovements(repo, null),
      postMovement(repo, null, body, at),
      postAdjustment(repo, null, adj, at),
    ]) {
      expect(res.status).toBe(401);
      expect(() => errorResponse.parse(res.body)).not.toThrow();
    }
    expect(repo.deriveStock('p-cafe')).toBe(0); // the unauthenticated write never landed
  });

  it('attributes a movement to whoever is authenticated — the actor is not the caller’s to claim', () => {
    const ana = { id: 'u-ana', username: 'ana', name: 'Ana', role: 'owner' as const };
    const bruno = { id: 'u-bruno', username: 'bruno', name: 'Bruno', role: 'employee' as const };
    postMovement(repo, ana, { productId: 'p-cafe', kind: 'entry', quantity: 5, reason: 'purchase' }, at);
    postMovement(repo, bruno, { productId: 'p-cafe', kind: 'exit', quantity: 2, reason: 'sale' }, at);

    const [latest, first] = repo.listMovements();
    expect(latest.actorName).toBe('Bruno');
    expect(first.actorName).toBe('Ana');
  });
});
