import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../db/schema';
import { MovementsRepo } from '../db/movements-repo';
import { getProducts, postMovement } from './handlers';
import { productsResponse, movement, errorResponse } from '../contract';

const at = '2026-07-06T00:00:00.000Z';

describe('GET /products honors the contract', () => {
  let repo: MovementsRepo;
  beforeEach(() => {
    repo = new MovementsRepo(createDb());
  });

  it('returns the catalogue with Stock derived from the ledger, in contract shape', () => {
    repo.recordMovement({ productId: 'p-cafe', kind: 'entry', quantity: 10, reason: 'compra', at });

    const res = getProducts(repo);

    expect(res.status).toBe(200);
    // The response parses against the contract — the shape the frontend was promised.
    const products = productsResponse.parse(res.body);
    const cafe = products.find((p) => p.id === 'p-cafe')!;
    expect(cafe.stock).toBe(10);
    expect(cafe.stockout).toBe(false); // 10 > threshold 5
  });

  it('marks a Product with Stock at or below its threshold as in Stockout', () => {
    // No movements: every Product sits at Stock 0, at or below its threshold.
    const products = productsResponse.parse(getProducts(repo).body);
    expect(products.every((p) => p.stock === 0 && p.stockout)).toBe(true);
  });
});

describe('POST /movements honors the contract on both edges', () => {
  let repo: MovementsRepo;
  beforeEach(() => {
    repo = new MovementsRepo(createDb());
  });

  it('records a valid movement and echoes it in contract shape, server-stamping the time', () => {
    const res = postMovement(repo, { productId: 'p-cafe', kind: 'entry', quantity: 4, reason: 'compra' }, at);

    expect(res.status).toBe(201);
    const created = movement.parse(res.body); // valid Movement, `at` is a real ISO datetime
    expect(created.at).toBe(at);
    expect(repo.deriveStock('p-cafe')).toBe(4);
  });

  it('ignores any `at` the caller tries to send — the server owns the time', () => {
    const res = postMovement(
      repo,
      { productId: 'p-cafe', kind: 'entry', quantity: 1, reason: 'compra', at: '1999-01-01T00:00:00.000Z' },
      at,
    );
    expect(res.status).toBe(201);
    expect((res.body as { at: string }).at).toBe(at); // server time, not the caller's
  });

  it('refuses a malformed request at the boundary with the typed error shape', () => {
    const res = postMovement(repo, { productId: 'p-cafe', kind: 'entry', quantity: -3, reason: 'compra' }, at);

    expect(res.status).toBe(422);
    expect(() => errorResponse.parse(res.body)).not.toThrow();
    expect(repo.deriveStock('p-cafe')).toBe(0); // nothing reached the ledger
  });

  it('turns a never-negative refusal into the typed error, not a crash', () => {
    postMovement(repo, { productId: 'p-cafe', kind: 'entry', quantity: 3, reason: 'compra' }, at);

    const res = postMovement(repo, { productId: 'p-cafe', kind: 'exit', quantity: 5, reason: 'venta' }, at);

    expect(res.status).toBe(422);
    expect(() => errorResponse.parse(res.body)).not.toThrow();
    expect(repo.deriveStock('p-cafe')).toBe(3); // the exit never landed
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

    expect(() => getProducts(driftedRepo)).toThrow();
  });
});
