// Estoca — the seed users of the pilot shop. See docs/adr/0008.
//
// Users are seeded fixed by the schema, exactly as the product catalogue is: account
// creation, invitation, and password recovery are account management, deferred with the rest
// of that surface in ADR-0008. This is enough to give every recorded action a proven actor.
//
// The passwords here are DEV credentials, in plaintext ONLY as a seed input — they are hashed
// with scrypt before they ever reach the database (see db/schema.ts) and are never stored in
// the clear. A real deployment would set real credentials, not these.

export interface SeedUser {
  id: string;
  username: string;
  /** The display name shown on screen ("conectado como…") and beside each movement. */
  name: string;
  /** Dev-only plaintext, hashed at seed time; never stored as-is. */
  password: string;
}

export const USERS: SeedUser[] = [
  { id: 'u-ana', username: 'ana', name: 'Ana', password: 'estoca-ana' },
  { id: 'u-bruno', username: 'bruno', name: 'Bruno', password: 'estoca-bruno' },
  { id: 'u-caro', username: 'caro', name: 'Caro', password: 'estoca-caro' },
];
