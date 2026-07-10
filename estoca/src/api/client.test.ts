import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchProducts,
  recordMovement,
  recordAdjustment,
  login,
  fetchMe,
  MovementRefused,
  NotAuthenticated,
} from './client';

// Stub the global fetch so the client is tested without a live server: it returns exactly what
// the backend would put on the wire, letting us assert how the client validates it.
function stubFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
}

afterEach(() => vi.unstubAllGlobals());

const aMovement = {
  productId: 'p-cafe',
  kind: 'exit',
  quantity: 3,
  reason: 'rotura',
  actorId: 'u-ana',
  actorName: 'Ana',
  at: '2026-07-06T00:00:00.000Z',
};

describe('the client validates responses against the contract', () => {
  it('parses a well-formed catalogue into product views', async () => {
    stubFetch(200, [{ id: 'p-cafe', name: 'Café', threshold: 5, stock: 10, stockout: false }]);
    const products = await fetchProducts();
    expect(products[0].stock).toBe(10);
  });

  it('rejects a response that drifts from the contract, instead of mis-reading it', async () => {
    // The backend renamed `stock` to `quantity`. The frontend refuses the payload at the edge
    // rather than silently rendering a shelf with no Stock — drift is loud on both ends (ADR-0007).
    stubFetch(200, [{ id: 'p-cafe', name: 'Café', threshold: 5, quantity: 10, stockout: false }]);
    await expect(fetchProducts()).rejects.toThrow();
  });

  it('throws NotAuthenticated on a 401 so the UI can show the login', async () => {
    stubFetch(401, { error: 'Tenés que iniciar sesión.' });
    await expect(fetchProducts()).rejects.toBeInstanceOf(NotAuthenticated);
  });
});

describe('the client records movements and surfaces refusals', () => {
  it('returns the created movement on success', async () => {
    stubFetch(201, { ...aMovement, kind: 'entry', quantity: 4, reason: 'compra' });
    const created = await recordMovement({ productId: 'p-cafe', kind: 'entry', quantity: 4, reason: 'compra' });
    expect(created.quantity).toBe(4);
    expect(created.actorName).toBe('Ana');
  });

  it('raises MovementRefused carrying the backend reason on a 422', async () => {
    stubFetch(422, { error: 'Una salida no puede dejar el Stock en negativo.' });
    const refused = recordMovement({ productId: 'p-cafe', kind: 'exit', quantity: 5, reason: 'venta' });
    await expect(refused).rejects.toBeInstanceOf(MovementRefused);
    await expect(refused).rejects.toThrow('negativo');
  });
});

describe('the client maps each adjustment outcome to a typed result', () => {
  const input = { productId: 'p-cafe', counted: 39, reason: 'Rotura' as const, expectedStock: 42 };

  it('returns "recorded" with the movement on a 201', async () => {
    stubFetch(201, { adjusted: true, movement: aMovement });
    const out = await recordAdjustment(input);
    expect(out).toMatchObject({ kind: 'recorded', movement: { quantity: 3 } });
  });

  it('returns "unchanged" when the count matched (200)', async () => {
    stubFetch(200, { adjusted: false });
    expect((await recordAdjustment(input)).kind).toBe('unchanged');
  });

  it('returns "stale" with the current Stock on a 409', async () => {
    stubFetch(409, { error: 'cambió', currentStock: 41 });
    expect(await recordAdjustment(input)).toEqual({ kind: 'stale', currentStock: 41 });
  });

  it('raises MovementRefused on a 422', async () => {
    stubFetch(422, { error: 'Un conteo no puede ser negativo.' });
    await expect(recordAdjustment(input)).rejects.toBeInstanceOf(MovementRefused);
  });
});

describe('identity on the client', () => {
  it('login returns the user on success', async () => {
    stubFetch(200, { id: 'u-ana', username: 'ana', name: 'Ana', role: 'owner' });
    expect(await login({ username: 'ana', password: 'estoca-ana' })).toMatchObject({ name: 'Ana' });
  });

  it('login throws NotAuthenticated on bad credentials', async () => {
    stubFetch(401, { error: 'Usuario o contraseña incorrectos.' });
    await expect(login({ username: 'ana', password: 'mala' })).rejects.toBeInstanceOf(NotAuthenticated);
  });

  it('fetchMe returns null when there is no session (401)', async () => {
    stubFetch(401, { error: 'Tenés que iniciar sesión.' });
    expect(await fetchMe()).toBeNull();
  });
});
