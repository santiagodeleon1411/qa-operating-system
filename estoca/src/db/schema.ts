import Database from 'better-sqlite3';
import { PRODUCTS } from '../persistence';

// The database schema for Estoca, per docs/adr/0006. Stock is never stored — only the
// movements are. Stock is derived from them by the `product_stock` view. A value that is
// not stored cannot drift.
const SCHEMA = `
CREATE TABLE products (
  id        TEXT    PRIMARY KEY,
  name      TEXT    NOT NULL,
  threshold INTEGER NOT NULL
);

-- The append-only ledger: the single source of truth for Stock.
CREATE TABLE movements (
  id         INTEGER PRIMARY KEY,
  product_id TEXT    NOT NULL REFERENCES products(id),
  kind       TEXT    NOT NULL CHECK (kind IN ('entry','exit')),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  reason     TEXT    NOT NULL CHECK (length(trim(reason)) > 0),
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

/** Create a fresh in-memory database with the schema applied and the catalogue seeded. */
export function createDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  const insert = db.prepare('INSERT INTO products (id, name, threshold) VALUES (?, ?, ?)');
  for (const p of PRODUCTS) insert.run(p.id, p.name, p.threshold);
  return db;
}
