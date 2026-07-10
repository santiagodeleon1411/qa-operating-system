import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../db/schema';
import { MovementsRepo } from '../db/movements-repo';
import { getProducts, postMovement, postAdjustment } from './handlers';
import { productsResponse, movement, errorResponse, adjustmentResult, staleCount } from '../contract';

const at = '2026-07-06T00:00:00.000Z';
const actor = { id: 'u-ana', username: 'ana', name: 'Ana' }; // an authenticated user (ADR-0008)

describe('GET /products honors the contract', () => {
  let repo: MovementsRepo;
  beforeEach(() => {
    repo = new MovementsRepo(createDb());
  });

  it('returns the catalogue with Stock derived from the ledger, in contract shape', () => {
    repo.recordMovement({ productId: 'p-cafe', kind: 'entry', quantity: 10, reason: 'compra', actorId: actor.id, at });

    const res = getProducts(repo, actor);

    expect(res.status).toBe(200);
    // The response parses against the contract — the shape the frontend was promised.
    const products = productsResponse.parse(res.body);
    const cafe = products.find((p) => p.id === 'p-cafe')!;
    expect(cafe.stock).toBe(10);
    expect(cafe.stockout).toBe(false); // 10 > threshold 5
  });

  it('marks a Product with Stock at or below its threshold as in Stockout', () => {
    // No movements: every Product sits at Stock 0, at or below its threshold.
    const products = productsResponse.parse(getProducts(repo, actor).body);
    expect(products.every((p) => p.stock === 0 && p.stockout)).toBe(true);
  });
});

describe('POST /movements honors the contract on both edges', () => {
  let repo: MovementsRepo;
  beforeEach(() => {
    repo = new MovementsRepo(createDb());
  });

  it('records a valid movement, stamps the actor, and echoes it in contract shape', () => {
    const res = postMovement(repo, actor, { productId: 'p-cafe', kind: 'entry', quantity: 4, reason: 'compra' }, at);

    expect(res.status).toBe(201);
    const created = movement.parse(res.body); // valid Movement, `at` is a real ISO datetime
    expect(created.at).toBe(at);
    expect(created).toMatchObject({ actorId: 'u-ana', actorName: 'Ana' }); // attribution
    expect(repo.deriveStock('p-cafe')).toBe(4);
  });

  it('ignores any `at` the caller tries to send — the server owns the time', () => {
    const res = postMovement(
      repo,
      actor,
      { productId: 'p-cafe', kind: 'entry', quantity: 1, reason: 'compra', at: '1999-01-01T00:00:00.000Z' },
      at,
    );
    expect(res.status).toBe(201);
    expect((res.body as { at: string }).at).toBe(at); // server time, not the caller's
  });

  it('refuses a malformed request at the boundary with the typed error shape', () => {
    const res = postMovement(repo, actor, { productId: 'p-cafe', kind: 'entry', quantity: -3, reason: 'compra' }, at);

    expect(res.status).toBe(422);
    expect(() => errorResponse.parse(res.body)).not.toThrow();
    expect(repo.deriveStock('p-cafe')).toBe(0); // nothing reached the ledger
  });

  it('turns a never-negative refusal into the typed error, not a crash', () => {
    postMovement(repo, actor, { productId: 'p-cafe', kind: 'entry', quantity: 3, reason: 'compra' }, at);

    const res = postMovement(repo, actor, { productId: 'p-cafe', kind: 'exit', quantity: 5, reason: 'venta' }, at);

    expect(res.status).toBe(422);
    expect(() => errorResponse.parse(res.body)).not.toThrow();
    expect(repo.deriveStock('p-cafe')).toBe(3); // the exit never landed
  });
});

describe('POST /adjustments reconciles a physical count without ever storing Stock', () => {
  let repo: MovementsRepo;
  beforeEach(() => {
    repo = new MovementsRepo(createDb());
    // Café starts at 42 in the ledger.
    repo.recordMovement({ productId: 'p-cafe', kind: 'entry', quantity: 42, reason: 'compra', actorId: actor.id, at });
  });

  const count = (body: Record<string, unknown>) => postAdjustment(repo, actor, body, at);

  it('records a downward adjustment when the count is below the system', () => {
    const res = count({ productId: 'p-cafe', counted: 39, reason: 'rotura', expectedStock: 42 });
    expect(res.status).toBe(201);
    const parsed = adjustmentResult.parse(res.body);
    expect(parsed).toMatchObject({ adjusted: true, movement: { kind: 'exit', quantity: 3, actorName: 'Ana' } });
    expect(repo.deriveStock('p-cafe')).toBe(39);
  });

  it('records an upward adjustment when the count is above the system', () => {
    const res = count({ productId: 'p-cafe', counted: 50, reason: 'error de carga', expectedStock: 42 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ adjusted: true, movement: { kind: 'entry', quantity: 8 } });
    expect(repo.deriveStock('p-cafe')).toBe(50);
  });

  it('records nothing when the count already matches the system', () => {
    const res = count({ productId: 'p-cafe', counted: 42, reason: 'conteo', expectedStock: 42 });
    expect(res.status).toBe(200);
    expect(adjustmentResult.parse(res.body)).toEqual({ adjusted: false });
    expect(repo.deriveStock('p-cafe')).toBe(42); // untouched
  });

  it('accepts a count of zero as a valid adjustment down to zero', () => {
    const res = count({ productId: 'p-cafe', counted: 0, reason: 'sin stock', expectedStock: 42 });
    expect(res.status).toBe(201);
    expect(repo.deriveStock('p-cafe')).toBe(0);
  });

  it('refuses a negative count, a non-whole count, and a missing reason at the boundary', () => {
    for (const bad of [
      { productId: 'p-cafe', counted: -3, reason: 'x', expectedStock: 42 },
      { productId: 'p-cafe', counted: 3.5, reason: 'x', expectedStock: 42 },
      { productId: 'p-cafe', counted: 39, reason: '  ', expectedStock: 42 },
    ]) {
      const res = count(bad);
      expect(res.status).toBe(422);
      expect(() => errorResponse.parse(res.body)).not.toThrow();
    }
    expect(repo.deriveStock('p-cafe')).toBe(42); // nothing reached the ledger
  });

  it('surfaces a Stock change during the count and measures the difference from the count', () => {
    // A sale of 1 lands while the Merchant is counting: system goes 42 -> 41.
    repo.recordMovement({ productId: 'p-cafe', kind: 'exit', quantity: 1, reason: 'venta', actorId: actor.id, at });

    // First submit: the Stock no longer matches what the count began with. Warn, record nothing.
    const warned = count({ productId: 'p-cafe', counted: 39, reason: 'rotura', expectedStock: 42 });
    expect(warned.status).toBe(409);
    expect(staleCount.parse(warned.body).currentStock).toBe(41);
    expect(repo.deriveStock('p-cafe')).toBe(41); // nothing recorded yet

    // Merchant reconfirms. The discrepancy is measured from the count (39 vs 42 = 3), applied
    // on top of the sale, landing the true 38 on the shelf — not 39.
    const confirmed = count({ productId: 'p-cafe', counted: 39, reason: 'rotura', expectedStock: 42, confirmed: true });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body).toMatchObject({ adjusted: true, movement: { kind: 'exit', quantity: 3 } });
    expect(repo.deriveStock('p-cafe')).toBe(38);
  });

  it('lets the never-negative trigger refuse an adjustment that would drive Stock below zero', () => {
    // Sales drop the real Stock to 2 during the count; the Merchant reconfirms a count of 0
    // taken against the original 42, which would apply an exit of 42 onto a Stock of 2.
    repo.recordMovement({ productId: 'p-cafe', kind: 'exit', quantity: 40, reason: 'venta', actorId: actor.id, at }); // 42 -> 2
    const res = count({ productId: 'p-cafe', counted: 0, reason: 'sin stock', expectedStock: 42, confirmed: true });
    expect(res.status).toBe(422);
    expect(repo.deriveStock('p-cafe')).toBe(2); // the schema backstop held
  });
});

describe('the contract has teeth — a drifted response is caught at the boundary', () => {
  // The whole point of validating the response on the way out: if the backend's read model
  // ever drifts from the shape the frontend expects (here, `stock` renamed to `quantity`),
  // the boundary refuses to serve it instead of shipping a payload the frontend will
  // silently mis-read. This is the failure ADR-0007 exists to make loud and early.
  it('refuses to serve a product view that no longer matches the contract', () => {
    const driftedRepo = {
      listProductViews: () => [
        { id: 'p-cafe', name: 'Café molido 500g', threshold: 5, quantity: 10, stockout: false },
      ],
    } as unknown as MovementsRepo;

    expect(() => getProducts(driftedRepo, actor)).toThrow();
  });
});
