# ADR-0006 — A backend and database, with the invariant preserved in the schema

## Status
Accepted — 2026-07-06. This is the point at which the story justifies the cost that
[ADR-0003](0003-genesis-quality-posture.md) deliberately deferred ("no backend, no
database yet"). Extends the guardianship established in
[ADR-0004](0004-a-merge-gate-for-the-invariant.md) and
[ADR-0005](0005-human-review-and-the-break-glass-valve.md) across the new boundary.

## Context
In the Genesis slice, Stock movements were stored in the browser's `localStorage`
(`estoca/src/persistence.ts`), and Stock was derived from them in a single codebase. That
was the correct trade-off for one Merchant on one device, pre-PMF.

As the team differentiates into distinct roles and the product serves more than one device
and more than one user, `localStorage` can no longer be the source of truth: it is
per-browser, per-device, and does not survive a cleared cache. The data must become
shared and durable, which requires a backend service and a database.

This moves the principal risk. Until now the invariant "the Stock never lies" lived inside
one process; now it must survive a network boundary, a persistence layer, and concurrent
writes. The guardian of the invariant must move with the source of truth.

## Decision
Introduce a backend service and a relational database. The invariant is preserved **at the
schema level**, so that the illegal state — a stored, mutable Stock — cannot be
represented.

- **Movements are an append-only ledger.** One `movements` table is the single source of
  truth. Rows are only inserted, never updated or deleted.
- **Stock is never stored.** There is no Stock column. Stock is derived from the movements
  by query, exposed as a database view. A value that is not stored cannot drift.
- **Write-time guards live in the schema.** The single-row rules become `CHECK`
  constraints: a positive whole quantity, a non-empty reason, and a `kind` limited to the
  known movement kinds. The cross-row rule — Stock may never go negative — cannot be a
  single-row constraint, so it is enforced by a trigger (`movements_no_negative_stock`)
  that rejects an exit larger than the current derived Stock. Because it is in the schema,
  the guarantee holds against any writer, including raw SQL that bypasses the application
  (see Consequences: concurrency).
- **No caching of the derived value yet.** Materialising or caching the Stock count is
  deferred until scale justifies it; at a Merchant's catalogue size, deriving on read is
  negligible, and a cache would reintroduce the drift risk this decision exists to remove.

### Schema (faithful to `estoca/src/domain.ts`)

```sql
-- The catalogue. No stock column, by design: Stock is never stored.
CREATE TABLE products (
  id        TEXT    PRIMARY KEY,
  name      TEXT    NOT NULL,
  threshold INTEGER NOT NULL
);

-- The append-only ledger: the single source of truth for Stock.
-- Rows are only ever inserted, never updated or deleted.
CREATE TABLE movements (
  id         INTEGER PRIMARY KEY,                          -- surrogate, insertion order
  product_id TEXT    NOT NULL REFERENCES products(id),
  kind       TEXT    NOT NULL CHECK (kind IN ('entry','exit')),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),        -- always positive; kind sets the sign
  reason     TEXT    NOT NULL CHECK (length(trim(reason)) > 0),
  at         TEXT    NOT NULL                              -- ISO timestamp
);

-- Stock, derived. Never stored. A number that does not exist cannot drift.
CREATE VIEW product_stock AS
SELECT p.id AS product_id,
       COALESCE(SUM(CASE WHEN m.kind = 'entry' THEN m.quantity ELSE -m.quantity END), 0) AS stock
FROM products p
LEFT JOIN movements m ON m.product_id = p.id
GROUP BY p.id;

-- The never-negative rule, enforced in the schema: an exit larger than the current derived
-- Stock is refused, whatever writer attempts it. This closes the concurrency window.
CREATE TRIGGER movements_no_negative_stock
BEFORE INSERT ON movements
WHEN NEW.kind = 'exit'
 AND (SELECT stock FROM product_stock WHERE product_id = NEW.product_id) < NEW.quantity
BEGIN
  SELECT RAISE(ABORT, 'Una salida no puede dejar el Stock en negativo.');
END;
```

### Guardianship across the boundary
The invariant is defended in layers, each with a clear owner:

1. **Schema** — with no Stock column, a stored counter cannot be written. The strongest
   guard: the illegal state is unrepresentable. Owned by whoever designs the schema.
2. **Safety net** — the automated tests that today verify "derive from movements" extend to
   the backend: insert movements, assert the derived Stock is correct, and assert
   concurrent writes do not corrupt it. The CI gate now exercises the database path. Owned
   by whoever writes the endpoint, backed by the machine.
3. **Human review** — the first check of the [Definition of Done](../DEFINITION_OF_DONE.md)
   ("the invariant is respected by design; no second source of truth") now explicitly
   includes "no stored Stock column." Certified by the reviewer.

## Considered options
- **A stored `stock` column, incremented per movement** — rejected: this is the mutable
  counter the invariant forbids, relocated into the schema. It is a second source of truth
  that can diverge from the movements, which is the Stock lying.
- **Keep `localStorage`** — rejected: it cannot be a shared or durable source of truth for
  more than one device or user.
- **Cache or materialise the derived Stock now** — deferred: unnecessary at current scale
  and reintroduces the drift risk. Revisit only when read cost is demonstrably a problem.
- **Full event-sourcing framework** — rejected as premature: an append-only movements
  table already gives the derived-truth property without the operational weight of a
  dedicated event-sourcing system.

## Consequences
- The invariant, the safety net, and the Definition of Done **extend** to the new
  architecture rather than being replaced. The same principle now holds across a service
  and a database boundary.
- **Concurrency is a new failure mode, addressed in the schema.** An application-level
  guard that reads the current Stock and then writes leaves a window: two concurrent exits
  can each read the same Stock, both pass the check, and together drive it negative — a
  race a single-threaded browser never had. Placing the guard in the schema trigger closes
  the window, because the database evaluates the current Stock at the moment of each write.
  The safety net verifies this with a test that bypasses the repository and writes raw SQL,
  proving the guarantee does not depend on the application reading carefully.
- New surface to manage: schema migrations, and a contract between frontend and backend so
  they do not drift. Each is a candidate for a later decision, introduced when its own
  cost is justified — not pre-built here.
- Mechanical enforcement of the human-review gate remains armed on the condition set in
  ADR-0005 (a second engineer's account joining the repository).
