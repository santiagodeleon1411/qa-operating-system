import type { Product } from './domain';

// The Merchant's catalogue: the seed set of Products, consumed by the database schema to
// seed the `products` table (docs/adr/0006). Stock is never seeded — only derived from
// movements.
//
// Until ADR-0007 this module also held the browser's `localStorage` store. That store is
// gone: the backend is now the source of truth, and the frontend reads Stock over the
// contract instead of deriving it locally.

export const PRODUCTS: Product[] = [
  { id: 'p-cafe', name: 'Ground coffee 500g', threshold: 5 },
  { id: 'p-yerba', name: 'Yerba mate 1kg', threshold: 8 },
  { id: 'p-azucar', name: 'Sugar 1kg', threshold: 10 },
];
