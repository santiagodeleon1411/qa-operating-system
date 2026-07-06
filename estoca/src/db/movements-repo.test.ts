import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from './schema';
import { MovementsRepo } from './movements-repo';

const at = '2026-07-06T00:00:00.000Z';

describe('Stock derives from the ledger in the database — "the Stock never lies"', () => {
  let repo: MovementsRepo;
  beforeEach(() => {
    repo = new MovementsRepo(createDb());
  });

  it('derives Stock as entries minus exits, read from the DB view', () => {
    repo.recordMovement({ productId: 'p-cafe', kind: 'entry', quantity: 10, reason: 'compra', at });
    repo.recordMovement({ productId: 'p-cafe', kind: 'exit', quantity: 3, reason: 'venta', at });
    expect(repo.deriveStock('p-cafe')).toBe(7);
  });

  it('rejects an exit larger than the Stock on hand, leaving the ledger unchanged', () => {
    repo.recordMovement({ productId: 'p-cafe', kind: 'entry', quantity: 3, reason: 'compra', at });
    expect(() =>
      repo.recordMovement({ productId: 'p-cafe', kind: 'exit', quantity: 5, reason: 'venta', at }),
    ).toThrow();
    expect(repo.deriveStock('p-cafe')).toBe(3);
  });
});

describe('The never-negative guard lives in the schema, so it cannot be bypassed', () => {
  // ADR-0006 flags concurrency as the new failure mode: two exits reading the same Stock
  // could each believe there is enough and both write, driving the Stock negative. The
  // guarantee does not depend on the application reading carefully — the schema trigger
  // rejects the offending write at the database, whatever code path attempts it.

  const currentStock = (db: ReturnType<typeof createDb>): number =>
    (db.prepare("SELECT stock FROM product_stock WHERE product_id = 'p-cafe'").get() as { stock: number }).stock;

  it('rejects a raw exit that would make the Stock negative, even bypassing the repository', () => {
    const db = createDb();
    // Write raw SQL, exactly as a second racing writer (or a careless script) would.
    db.prepare("INSERT INTO movements (product_id, kind, quantity, reason, at) VALUES ('p-cafe','entry',3,'compra',?)").run(at);
    db.prepare("INSERT INTO movements (product_id, kind, quantity, reason, at) VALUES ('p-cafe','exit',3,'venta',?)").run(at);

    // The second exit would make the Stock lie. The schema refuses to write it.
    expect(() =>
      db.prepare("INSERT INTO movements (product_id, kind, quantity, reason, at) VALUES ('p-cafe','exit',3,'venta',?)").run(at),
    ).toThrow();
    expect(currentStock(db)).toBe(0); // never below zero
  });

  it('lets only what exists leave: contending exits land the Stock at 0, never below', () => {
    const repo = new MovementsRepo(createDb());
    repo.recordMovement({ productId: 'p-cafe', kind: 'entry', quantity: 3, reason: 'compra', at });

    repo.recordMovement({ productId: 'p-cafe', kind: 'exit', quantity: 3, reason: 'venta', at });
    expect(() =>
      repo.recordMovement({ productId: 'p-cafe', kind: 'exit', quantity: 3, reason: 'venta', at }),
    ).toThrow();

    expect(repo.deriveStock('p-cafe')).toBe(0);
  });
});
