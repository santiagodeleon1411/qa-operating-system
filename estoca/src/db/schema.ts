import Database from 'better-sqlite3';
import { PRODUCTS } from '../catalogue';
import { USERS } from '../users';
import { hashPassword } from '../auth';

// The database schema for Estoca, per docs/adr/0006 and docs/adr/0008. Stock is never stored
// — only the movements are. Stock is derived from them by the `product_stock` view. A value
// that is not stored cannot drift. Every movement names the user who recorded it (ADR-0008).
const SCHEMA = `
CREATE TABLE products (
  id        TEXT    PRIMARY KEY,
  name      TEXT    NOT NULL,
  threshold INTEGER NOT NULL
);

-- The people who may act on the shop's Stock. Credentials are stored only as a scrypt hash
-- (ADR-0008); the plaintext never reaches this table.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL
);

-- Active sessions: an opaque token bound to a user, with an expiry. A request presents the
-- token (as an httpOnly cookie) and the backend resolves the acting user from this table.
CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

-- The append-only ledger: the single source of truth for Stock. Every row names its actor,
-- so the ledger answers not only what changed and when, but who changed it (ADR-0008).
CREATE TABLE movements (
  id         INTEGER PRIMARY KEY,
  product_id TEXT    NOT NULL REFERENCES products(id),
  kind       TEXT    NOT NULL CHECK (kind IN ('entry','exit')),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  reason     TEXT    NOT NULL CHECK (length(trim(reason)) > 0),
  actor_id   TEXT    NOT NULL REFERENCES users(id),
  at         TEXT    NOT NULL
);

-- Stock, derived. Never stored.
CREATE VIEW product_stock AS
SELECT p.id AS product_id,
       COALESCE(SUM(CASE WHEN m.kind = 'entry' THEN m.quantity ELSE -m.quantity END), 0) AS stock
FROM products p
LEFT JOIN movements m ON m.product_id = p.id
GROUP BY p.id;

-- The "Stock never goes negative" rule, enforced in the schema itself. This is a cross-row
-- rule (it depends on the current derived Stock), so it is a trigger rather than a CHECK.
-- Being in the schema, it holds against ANY writer — including one that bypasses the
-- application and writes raw SQL. The illegal state is unrepresentable, not merely guarded.
CREATE TRIGGER movements_no_negative_stock
BEFORE INSERT ON movements
WHEN NEW.kind = 'exit'
 AND (SELECT stock FROM product_stock WHERE product_id = NEW.product_id) < NEW.quantity
BEGIN
  SELECT RAISE(ABORT, 'Una salida no puede dejar el Stock en negativo.');
END;
`;

/** Create a fresh in-memory database with the schema applied, the catalogue and users seeded. */
export function createDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  const insertProduct = db.prepare('INSERT INTO products (id, name, threshold) VALUES (?, ?, ?)');
  for (const p of PRODUCTS) insertProduct.run(p.id, p.name, p.threshold);

  // Seed users, hashing each dev password before it is stored — never in plaintext.
  const insertUser = db.prepare('INSERT INTO users (id, username, name, password_hash) VALUES (?, ?, ?, ?)');
  for (const u of USERS) insertUser.run(u.id, u.username, u.name, hashPassword(u.password));

  return db;
}
