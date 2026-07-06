import { describe, it, expect } from 'vitest';
import { fetchProducts, recordMovement, recordAdjustment, MovementRefused } from './client';

// A fake transport so the client is tested without a live server: it returns exactly what
// the backend would put on the wire, letting us assert how the client validates it.
function transport(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('the client validates responses against the contract', () => {
  it('parses a well-formed catalogue into product views', async () => {
    const products = await fetchProducts(
      transport(200, [{ id: 'p-cafe', name: 'Café', threshold: 5, stock: 10, stockout: false }]),
    );
    expect(products[0].stock).toBe(10);
  });

  it('rejects a response that drifts from the contract, instead of mis-reading it', async () => {
    // The backend renamed `stock` to `quantity`. The frontend refuses the payload at the
    // edge rather than silently rendering a shelf with no Stock. This is the front side of
    // the same guard the backend has — drift is loud on both ends (ADR-0007).
    const drifted = transport(200, [{ id: 'p-cafe', name: 'Café', threshold: 5, quantity: 10, stockout: false }]);
    await expect(fetchProducts(drifted)).rejects.toThrow();
  });
});

describe('the client records movements and surfaces refusals', () => {
  it('returns the created movement on success', async () => {
    const created = await recordMovement(
      { productId: 'p-cafe', kind: 'entry', quantity: 4, reason: 'compra' },
      transport(201, {
        productId: 'p-cafe',
        kind: 'entry',
        quantity: 4,
        reason: 'compra',
        at: '2026-07-06T00:00:00.000Z',
      }),
    );
    expect(created.quantity).toBe(4);
  });

  it('raises MovementRefused carrying the backend reason on a 422', async () => {
    const refused = recordMovement(
      { productId: 'p-cafe', kind: 'exit', quantity: 5, reason: 'venta' },
      transport(422, { error: 'Una salida no puede dejar el Stock en negativo.' }),
    );
    await expect(refused).rejects.toBeInstanceOf(MovementRefused);
    await expect(refused).rejects.toThrow('negativo');
  });
});

describe('the client maps each adjustment outcome to a typed result', () => {
  const input = { productId: 'p-cafe', counted: 39, reason: 'rotura', expectedStock: 42 };

  it('returns "recorded" with the movement on a 201', async () => {
    const out = await recordAdjustment(
      input,
      transport(201, {
        adjusted: true,
        movement: { productId: 'p-cafe', kind: 'exit', quantity: 3, reason: 'rotura', at: '2026-07-06T00:00:00.000Z' },
      }),
    );
    expect(out).toMatchObject({ kind: 'recorded', movement: { quantity: 3 } });
  });

  it('returns "unchanged" when the count matched (200)', async () => {
    const out = await recordAdjustment(input, transport(200, { adjusted: false }));
    expect(out.kind).toBe('unchanged');
  });

  it('returns "stale" with the current Stock on a 409', async () => {
    const out = await recordAdjustment(input, transport(409, { error: 'cambió', currentStock: 41 }));
    expect(out).toEqual({ kind: 'stale', currentStock: 41 });
  });

  it('raises MovementRefused on a 422', async () => {
    await expect(recordAdjustment(input, transport(422, { error: 'Un conteo no puede ser negativo.' }))).rejects.toBeInstanceOf(
      MovementRefused,
    );
  });
});
