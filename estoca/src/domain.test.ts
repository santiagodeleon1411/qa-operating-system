import { describe, it, expect } from 'vitest';
import {
  stockOf,
  isBelowThreshold,
  effectiveThreshold,
  assertValidThreshold,
  DEFAULT_THRESHOLD,
  makeMovement,
  wouldGoNegative,
  planAdjustment,
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

describe('Low-stock alerting', () => {
  const product: Product = { id: 'p1', name: 'Café', threshold: 5 };

  it('does not fire above the threshold', () => {
    expect(isBelowThreshold(product, [mov('p1', 'entry', 6)])).toBe(false);
  });

  it('fires at or below the threshold', () => {
    expect(isBelowThreshold(product, [mov('p1', 'entry', 5)])).toBe(true);
    expect(isBelowThreshold(product, [mov('p1', 'entry', 3)])).toBe(true);
  });

  // BE4: a Product with no threshold set falls back to the default — and the default fails
  // toward the alert (Ana's rule), so an unset Product at Stock 5 warns, at Stock 6 does not.
  it('falls back to the default threshold when the owner set none', () => {
    const unset: Product = { id: 'p1', name: 'Nuevo', threshold: null };
    expect(effectiveThreshold(unset)).toBe(DEFAULT_THRESHOLD);
    expect(isBelowThreshold(unset, [mov('p1', 'entry', DEFAULT_THRESHOLD)])).toBe(true);
    expect(isBelowThreshold(unset, [mov('p1', 'entry', DEFAULT_THRESHOLD + 1)])).toBe(false);
  });
});

describe('A threshold outside the settable range is refused', () => {
  it('accepts a whole number within the closed range, including both bounds', () => {
    expect(assertValidThreshold(0)).toBe(0);
    expect(assertValidThreshold(10_000)).toBe(10_000);
    expect(assertValidThreshold(7)).toBe(7);
  });

  it('rejects a negative, a decimal, and a value over the sanity cap', () => {
    expect(() => assertValidThreshold(-1)).toThrow(); // below the floor
    expect(() => assertValidThreshold(2.5)).toThrow(); // not a whole number
    expect(() => assertValidThreshold(10_001)).toThrow(); // over the cap
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

describe('A physical count becomes an adjustment movement, never a stored Stock', () => {
  const adjust = (counted: number, snapshotStock: number) =>
    planAdjustment({ productId: 'p1', counted, snapshotStock, reason: 'conteo', at });

  it('records the difference as an exit when the count is below the system', () => {
    const m = adjust(39, 42)!;
    expect(m).toMatchObject({ kind: 'exit', quantity: 3 });
  });

  it('records the difference as an entry when the count is above the system', () => {
    const m = adjust(50, 42)!;
    expect(m).toMatchObject({ kind: 'entry', quantity: 8 });
  });

  it('records nothing when the count already matches the system', () => {
    expect(adjust(42, 42)).toBeNull();
  });

  it('treats a count of zero as a valid adjustment down to zero', () => {
    const m = adjust(0, 42)!;
    expect(m).toMatchObject({ kind: 'exit', quantity: 42 });
  });

  it('measures the difference from the count, not from a later Stock', () => {
    // Counted 39 against the Stock seen when the count began (42). Even if the current
    // Stock is now 41 (a sale happened during the count), the discrepancy recorded is 3,
    // which applied on top of the sale lands the true 38 — not 2.
    const m = adjust(39, 42)!;
    expect(m.quantity).toBe(3);
  });

  it('refuses a negative or non-whole count', () => {
    expect(() => adjust(-3, 42)).toThrow('negativo');
    expect(() => adjust(3.5, 42)).toThrow('enteros');
  });
});
