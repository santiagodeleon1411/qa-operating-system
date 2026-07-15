import type Database from 'better-sqlite3';
import { isLowStock } from '../domain';

// Estoca — the Product read model and the owner-only threshold write. See docs/adr/0006–0008.
//
// Stock is never stored — only derived from the movements ledger (the `product_stock` view).
// The threshold, by contrast, IS a stored setting: what counts as "low" for each Product. This
// repo reads the two together into the view behind `GET /products`, and owns the threshold
// write — which updates the current value and appends an attribution row, the same who-did-what
// discipline the ledger applies to Stock (ADR-0008).

/** A Product with its Stock derived from the ledger. `stock`/`belowThreshold` are never stored. */
export interface ProductView {
  id: string;
  name: string;
  /** `null` when the owner has set none; it resolves to the default in `belowThreshold`. */
  threshold: number | null;
  stock: number;
  /** Stock at or below the effective threshold (own, or the default when unset). */
  belowThreshold: boolean;
}

/** A recorded threshold change as read back, carrying who set it — the audit read model. */
export interface ThresholdChange {
  productId: string;
  threshold: number;
  actorId: string;
  actorName: string;
  at: string;
}

type ProductRow = { id: string; name: string; threshold: number | null; stock: number };

const PRODUCT_VIEW_SELECT = `SELECT p.id, p.name, p.threshold, ps.stock
   FROM products p
   JOIN product_stock ps ON ps.product_id = p.id`;

/** Product configuration and its read model — the door to thresholds and the low-stock flag. */
export class ProductsRepo {
  constructor(private readonly db: Database.Database) {}

  /** Resolve the low-stock flag on read: Stock at or below the effective threshold. Never stored. */
  private toView(r: ProductRow): ProductView {
    return { ...r, belowThreshold: isLowStock(r.stock, r) };
  }

  /** The catalogue with each Product's derived Stock and low-stock flag — behind `GET /products`. */
  listProductViews(): ProductView[] {
    const rows = this.db.prepare(`${PRODUCT_VIEW_SELECT} ORDER BY p.name`).all() as ProductRow[];
    return rows.map((r) => this.toView(r));
  }

  /** One Product's view, or `null` if there is no such Product. */
  getProductView(productId: string): ProductView | null {
    const row = this.db.prepare(`${PRODUCT_VIEW_SELECT} WHERE p.id = ?`).get(productId) as
      | ProductRow
      | undefined;
    return row ? this.toView(row) : null;
  }

  /**
   * Set a Product's threshold, stamped with the actor who set it. In one transaction it updates
   * the current value and appends an attribution row, so a stored threshold always has a
   * recorded author. Returns the updated view, or `null` when there is no such Product — in
   * which case NOTHING is stored (the audit row is never written). The value must already be a
   * valid threshold (validated at the boundary); the schema's CHECK is the last line of defense.
   */
  setThreshold(productId: string, threshold: number, actorId: string, at: string): ProductView | null {
    const tx = this.db.transaction((): ProductView | null => {
      const res = this.db.prepare('UPDATE products SET threshold = ? WHERE id = ?').run(threshold, productId);
      if (res.changes === 0) return null; // no such Product — nothing stored, no audit row
      this.db
        .prepare('INSERT INTO threshold_changes (product_id, threshold, actor_id, at) VALUES (?, ?, ?, ?)')
        .run(productId, threshold, actorId, at);
      return this.getProductView(productId);
    });
    return tx();
  }

  /** The history of threshold changes, most recent first, each joined to who made it. */
  listThresholdChanges(productId?: string): ThresholdChange[] {
    const base = `SELECT t.product_id AS productId, t.threshold, t.at,
                         t.actor_id AS actorId, u.name AS actorName
                    FROM threshold_changes t
                    JOIN users u ON u.id = t.actor_id`;
    return productId
      ? (this.db.prepare(`${base} WHERE t.product_id = ? ORDER BY t.id DESC`).all(productId) as ThresholdChange[])
      : (this.db.prepare(`${base} ORDER BY t.id DESC`).all() as ThresholdChange[]);
  }
}
