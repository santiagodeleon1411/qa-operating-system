import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createDb } from '../db/schema';
import { MovementsRepo } from '../db/movements-repo';
import { ProductsRepo } from '../db/products-repo';
import { getProducts, setThreshold } from './handlers';
import { productsResponse, type ProductView, type ErrorResponse } from '../contract';

// Contract-level coverage for the per-product low-stock threshold (issue #21 / #22). Each test
// is one row of the approved test plan (#21) at its stated altitude — the `belowThreshold`
// calculation and its boundary (BE1), the 403-vs-200 by role (BE2), the validation rejections
// (BE3), the default when unset (BE4), and the invariant that no Stock is ever stored (TC-16).

const at = '2026-07-13T00:00:00.000Z';
const owner = { id: 'u-ana', username: 'ana', name: 'Ana', role: 'owner' as const };
const employee = { id: 'u-bruno', username: 'bruno', name: 'Bruno', role: 'employee' as const };
const runner = { id: 'u-caro', username: 'caro', name: 'Caro', role: 'runner' as const };

describe('per-product low-stock threshold — backend contract (#22)', () => {
  let db: Database.Database;
  let repo: MovementsRepo;
  let products: ProductsRepo;

  beforeEach(() => {
    db = createDb();
    repo = new MovementsRepo(db);
    products = new ProductsRepo(db);
  });

  /** Record an entry so a Product sits at a known Stock (Stock is only ever derived). */
  const stock = (productId: string, quantity: number) =>
    repo.recordMovement({ productId, kind: 'entry', quantity, reason: 'purchase', actorId: owner.id, at });

  /** The Product's view as `GET /products` would serve it, parsed against the contract. */
  const viewOf = (productId: string): ProductView =>
    productsResponse.parse(getProducts(products, owner).body).find((p) => p.id === productId)!;

  // --- BE1: belowThreshold uses each Product's OWN threshold, boundary included ---------------

  it('TC-07 — each Product uses its own threshold for belowThreshold', () => {
    setThreshold(products, owner, { productId: 'p-cafe', threshold: 10 }, at);
    setThreshold(products, owner, { productId: 'p-azucar', threshold: 5 }, at);
    stock('p-cafe', 8); // 8 <= 10
    stock('p-azucar', 12); // 12 > 5

    expect(viewOf('p-cafe').belowThreshold).toBe(true);
    expect(viewOf('p-azucar').belowThreshold).toBe(false);
  });

  it('TC-08 — boundary: Stock exactly at the threshold is below (≤)', () => {
    // p-cafe seeds at threshold 5; bring it to exactly 5.
    stock('p-cafe', 5);
    expect(viewOf('p-cafe').belowThreshold).toBe(true);
  });

  // --- BE2: only the owner may set a threshold; the change is attributed ----------------------

  it('TC-09 — the owner sets a threshold: 200, and the change records who set it', () => {
    const res = setThreshold(products, owner, { productId: 'p-cafe', threshold: 7 }, at);

    expect(res.status).toBe(200);
    expect((res.body as ProductView).threshold).toBe(7);

    const history = products.listThresholdChanges('p-cafe');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ threshold: 7, actorId: 'u-ana', actorName: 'Ana', at });
  });

  it('TC-10 — a non-owner setting a threshold via the API is refused (403), nothing stored', () => {
    for (const nonOwner of [employee, runner]) {
      const res = setThreshold(products, nonOwner, { productId: 'p-cafe', threshold: 7 }, at);
      expect(res.status).toBe(403);
    }
    expect(products.getProductView('p-cafe')!.threshold).toBe(5); // unchanged seed value
    expect(products.listThresholdChanges('p-cafe')).toHaveLength(0); // no attribution row written
  });

  // --- BE3: the threshold is a whole number within the closed sanity range 0–10000 -----------

  /** After a rejected set, the threshold is untouched and no audit row exists — nothing stored. */
  const expectNothingStored = () => {
    expect(products.getProductView('p-cafe')!.threshold).toBe(5);
    expect(products.listThresholdChanges('p-cafe')).toHaveLength(0);
  };

  it('TC-11 — a negative threshold is rejected (422), nothing stored', () => {
    expect(setThreshold(products, owner, { productId: 'p-cafe', threshold: -1 }, at).status).toBe(422);
    expectNothingStored();
  });

  it('TC-11b — a threshold over the sanity cap (10001) is rejected (422), nothing stored', () => {
    expect(setThreshold(products, owner, { productId: 'p-cafe', threshold: 10001 }, at).status).toBe(422);
    expectNothingStored();
  });

  it('TC-11c — the cap boundary (10000) is accepted (200)', () => {
    const res = setThreshold(products, owner, { productId: 'p-cafe', threshold: 10000 }, at);
    expect(res.status).toBe(200);
    expect((res.body as ProductView).threshold).toBe(10000);
  });

  it('TC-12 — a decimal threshold is rejected (422), nothing stored', () => {
    expect(setThreshold(products, owner, { productId: 'p-cafe', threshold: 2.5 }, at).status).toBe(422);
    expectNothingStored();
  });

  it('TC-13 — a non-numeric or null threshold is rejected (422), nothing stored', () => {
    expect(setThreshold(products, owner, { productId: 'p-cafe', threshold: 'abc' }, at).status).toBe(422);
    expect(setThreshold(products, owner, { productId: 'p-cafe', threshold: null }, at).status).toBe(422);
    expectNothingStored();
  });

  // --- BE4: a Product with no threshold resolves to the documented default (Ana's rule) -------

  it('TC-14 — a Product with no threshold set, Stock 5, is below (default 5)', () => {
    db.prepare('UPDATE products SET threshold = NULL WHERE id = ?').run('p-cafe');
    stock('p-cafe', 5);

    const view = viewOf('p-cafe');
    expect(view.threshold).toBeNull(); // genuinely unset, not a stored 5
    expect(view.belowThreshold).toBe(true); // resolves to the default 5, and 5 <= 5
  });

  it('TC-15 — a Product with no threshold set, Stock 6, is not below', () => {
    db.prepare('UPDATE products SET threshold = NULL WHERE id = ?').run('p-cafe');
    stock('p-cafe', 6);
    expect(viewOf('p-cafe').belowThreshold).toBe(false); // 6 > default 5
  });

  // --- Invariant: a threshold operation never introduces a stored Stock value ----------------

  it('TC-16 — a threshold operation introduces no stored Stock; Stock stays derived', () => {
    stock('p-cafe', 9);
    const before = repo.deriveStock('p-cafe');

    setThreshold(products, owner, { productId: 'p-cafe', threshold: 3 }, at);

    expect(repo.deriveStock('p-cafe')).toBe(before); // the threshold change did not touch Stock
    expect(viewOf('p-cafe').stock).toBe(9); // Stock is still exactly the sum of movements
    // And the schema exposes no stored Stock column to drift: products holds only these three.
    const cols = (db.prepare('PRAGMA table_info(products)').all() as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toEqual(['id', 'name', 'threshold']);
  });

  // --- Beyond the plan: an unknown Product is a 404, and still nothing is stored --------------

  it('setting the threshold of an unknown Product is a 404, with no audit row', () => {
    const res = setThreshold(products, owner, { productId: 'p-nope', threshold: 7 }, at);
    expect(res.status).toBe(404);
    expect((res.body as ErrorResponse).error).toMatch(/does not exist/i);
    expect(products.listThresholdChanges('p-nope')).toHaveLength(0);
  });
});
