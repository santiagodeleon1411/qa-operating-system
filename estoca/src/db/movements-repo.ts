import type Database from 'better-sqlite3';
import { makeMovement, type MovementKind } from '../domain';

export interface MovementInput {
  productId: string;
  kind: MovementKind;
  quantity: number;
  reason: string;
  at: string;
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
   * Record a movement. Domain rules (positive whole quantity, non-empty reason) are
   * validated first. The "Stock never goes negative" rule is enforced by the schema (the
   * `movements_no_negative_stock` trigger): an exit that would drop the Stock below zero is
   * rejected by the database, whatever code path attempts it.
   */
  recordMovement(input: MovementInput): void {
    const m = makeMovement(input); // throws on an invalid quantity or reason
    this.db
      .prepare('INSERT INTO movements (product_id, kind, quantity, reason, at) VALUES (?, ?, ?, ?, ?)')
      .run(m.productId, m.kind, m.quantity, m.reason, m.at);
  }
}
