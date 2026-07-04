import { describe, it, expect } from 'vitest';
import {
  stockOf,
  isStockout,
  makeMovement,
  wouldGoNegative,
  type Product,
  type StockMovement,
} from './domain';

const at = '2026-07-04T00:00:00.000Z';
const mov = (productId: string, kind: 'entry' | 'exit', quantity: number): StockMovement => ({
  productId,
  kind,
  quantity,
  reason: 'test',
  at,
});

describe('Stock is derived, never stored — "the Stock never lies"', () => {
  it('is 0 for a Product with no movements', () => {
    expect(stockOf('p1', [])).toBe(0);
  });

  it('is the sum of entries minus exits', () => {
    const movements = [mov('p1', 'entry', 10), mov('p1', 'exit', 3), mov('p1', 'entry', 5)];
    expect(stockOf('p1', movements)).toBe(12);
  });

  it('only counts the movements of the asked Product', () => {
    const movements = [mov('p1', 'entry', 10), mov('p2', 'entry', 99)];
    expect(stockOf('p1', movements)).toBe(10);
  });

  // Regression guard — the "mutable counter" trap (the red → green story).
  // A stored counter drifts the moment an update is missed or applied twice. A Stock
  // derived from its ledger cannot: recomputing always yields the same single truth.
  it('never drifts from the sum of its ledger, however many movements', () => {
    const movements: StockMovement[] = [];
    let expected = 0;
    for (let i = 1; i <= 100; i++) {
      const kind = i % 3 === 0 ? 'exit' : 'entry';
      const qty = (i % 5) + 1;
      movements.push(mov('p1', kind, qty));
      expected += kind === 'entry' ? qty : -qty;
    }
    expect(stockOf('p1', movements)).toBe(expected);
  });
});

describe('Stockout alerting', () => {
  const product: Product = { id: 'p1', name: 'Café', threshold: 5 };

  it('does not fire above the threshold', () => {
    expect(isStockout(product, [mov('p1', 'entry', 6)])).toBe(false);
  });

  it('fires at or below the threshold', () => {
    expect(isStockout(product, [mov('p1', 'entry', 5)])).toBe(true);
    expect(isStockout(product, [mov('p1', 'entry', 3)])).toBe(true);
  });
});

describe('A movement that would make the Stock lie is rejected', () => {
  it('rejects a non-positive or non-integer quantity', () => {
    expect(() => makeMovement({ productId: 'p1', kind: 'entry', quantity: 0, reason: 'x', at })).toThrow();
    expect(() => makeMovement({ productId: 'p1', kind: 'entry', quantity: -2, reason: 'x', at })).toThrow();
    expect(() => makeMovement({ productId: 'p1', kind: 'entry', quantity: 1.5, reason: 'x', at })).toThrow();
  });

  it('rejects a movement with no reason', () => {
    expect(() => makeMovement({ productId: 'p1', kind: 'entry', quantity: 2, reason: '  ', at })).toThrow();
  });

  it('detects an exit that would drop Stock below zero', () => {
    const movements = [mov('p1', 'entry', 3)];
    const bigExit = makeMovement({ productId: 'p1', kind: 'exit', quantity: 5, reason: 'x', at });
    expect(wouldGoNegative(bigExit, movements)).toBe(true);
  });
});
