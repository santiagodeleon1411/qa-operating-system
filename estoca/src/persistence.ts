import type { Product, StockMovement } from './domain';

// Thin persistence layer, kept separate from the domain on purpose: the domain is
// pure logic (given movements → Stock), and where those movements live is a detail.
// For the Genesis slice that detail is the browser's localStorage. No backend, no
// database yet — deliberately deferred until the story justifies the cost.

const STORAGE_KEY = 'estoca.movements.v1';

/** The Merchant's catalogue for this slice. Fixed; Stock is never seeded, only derived. */
export const PRODUCTS: Product[] = [
  { id: 'p-cafe', name: 'Café molido 500g', threshold: 5 },
  { id: 'p-yerba', name: 'Yerba mate 1kg', threshold: 8 },
  { id: 'p-azucar', name: 'Azúcar 1kg', threshold: 10 },
];

export function loadMovements(): StockMovement[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedMovements();
  try {
    return JSON.parse(raw) as StockMovement[];
  } catch {
    return seedMovements();
  }
}

export function saveMovements(movements: readonly StockMovement[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(movements));
}

/** A little opening Stock so the shelf isn't empty the first time it's opened. */
function seedMovements(): StockMovement[] {
  const at = new Date().toISOString();
  return [
    { productId: 'p-cafe', kind: 'entry', quantity: 12, reason: 'Compra inicial', at },
    { productId: 'p-yerba', kind: 'entry', quantity: 20, reason: 'Compra inicial', at },
    { productId: 'p-azucar', kind: 'entry', quantity: 15, reason: 'Compra inicial', at },
  ];
}
