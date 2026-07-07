import type Database from 'better-sqlite3';
import { makeMovement, type MovementKind, type StockMovement } from '../domain';

export interface MovementInput {
  productId: string;
  kind: MovementKind;
  quantity: number;
  reason: string;
  /** The authenticated user recording this movement (ADR-0008). Never client-supplied. */
  actorId: string;
  at: string;
}

/** A Product with its Stock derived from the ledger. `stock`/`stockout` are never stored. */
export interface ProductView {
  id: string;
  name: string;
  threshold: number;
  stock: number;
  stockout: boolean;
}

/** A recorded movement as read back from the ledger, carrying who recorded it. */
export interface RecordedMovement extends StockMovement {
  actorId: string;
  actorName: string;
}

/**
 * The only door to the ledger. Reads the Stock (derived, never stored) and records
 * movements while upholding the invariant "the Stock never lies".
 */
export class MovementsRepo {
  constructor(private readonly db: Database.Database) {}

  /** The Stock of a Product, derived from its movements by the DB view. */
  deriveStock(productId: string): number {
    const row = this.db
      .prepare('SELECT stock FROM product_stock WHERE product_id = ?')
      .get(productId) as { stock: number } | undefined;
    return row?.stock ?? 0;
  }

  /**
   * The catalogue with each Product's Stock, derived by the DB view — the read model behind
   * `GET /products`. Stockout follows the domain rule (Stock at or below the threshold);
   * it is computed here, never stored.
   */
  listProductViews(): ProductView[] {
    const rows = this.db
      .prepare(
        `SELECT p.id, p.name, p.threshold, ps.stock
           FROM products p
           JOIN product_stock ps ON ps.product_id = p.id
          ORDER BY p.name`,
      )
      .all() as Array<{ id: string; name: string; threshold: number; stock: number }>;
    return rows.map((r) => ({ ...r, stockout: r.stock <= r.threshold }));
  }

  /**
   * The recent ledger, most recent first, each movement joined to the user who recorded it —
   * the read model behind `GET /movements`. This is what makes attribution visible: the
   * ledger answers not only what and when, but who (ADR-0008).
   */
  listMovements(limit = 50): RecordedMovement[] {
    return this.db
      .prepare(
        `SELECT m.product_id AS productId, m.kind, m.quantity, m.reason, m.at,
                m.actor_id AS actorId, u.name AS actorName
           FROM movements m
           JOIN users u ON u.id = m.actor_id
          ORDER BY m.id DESC
          LIMIT ?`,
      )
      .all(limit) as RecordedMovement[];
  }

  /**
   * Record a movement. Domain rules (positive whole quantity, non-empty reason) are
   * validated first. The "Stock never goes negative" rule is enforced by the schema (the
   * `movements_no_negative_stock` trigger): an exit that would drop the Stock below zero is
   * rejected by the database, whatever code path attempts it. The actor is stamped onto the
   * row so the ledger records who made the change.
   */
  recordMovement(input: MovementInput): StockMovement {
    const m = makeMovement(input); // throws on an invalid quantity or reason
    this.db
      .prepare(
        'INSERT INTO movements (product_id, kind, quantity, reason, actor_id, at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(m.productId, m.kind, m.quantity, m.reason, input.actorId, m.at);
    return m;
  }
}
