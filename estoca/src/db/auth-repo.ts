import type Database from 'better-sqlite3';
import { verifyPassword, newSessionToken } from '../auth';

/** A user as it is safe to expose: never the password hash. See docs/adr/0008. */
export interface SessionUser {
  id: string;
  username: string;
  name: string;
}

/**
 * The door to identity: verify credentials and manage sessions. Kept separate from the
 * ledger's MovementsRepo because authentication is a different concern from Stock. The
 * password hash never leaves this class — callers only ever receive a SessionUser.
 */
export class AuthRepo {
  constructor(private readonly db: Database.Database) {}

  /**
   * Verify a username/password pair. Returns the safe SessionUser on success, or null on any
   * failure — unknown user or wrong password alike, with the same error body, so the response
   * itself does not reveal which usernames exist.
   *
   * Timing caveat: an unknown user returns before any hashing runs, while a known user with a
   * wrong password pays scrypt's deliberate cost, so response latency still leaks existence to
   * an attacker who measures it. Accepted for the pilot (three seeded users, low value to the
   * attack). The fix, deferred until login is exposed beyond the pilot: always run a hash —
   * comparing against a fixed dummy hash when the user is unknown — so both paths take the
   * same time.
   */
  authenticate(username: string, password: string): SessionUser | null {
    const row = this.db
      .prepare('SELECT id, username, name, password_hash AS passwordHash FROM users WHERE username = ?')
      .get(username) as (SessionUser & { passwordHash: string }) | undefined;
    if (!row || !verifyPassword(password, row.passwordHash)) return null;
    return { id: row.id, username: row.username, name: row.name };
  }

  /** Open a session for a user, expiring at the given ISO time. Returns the opaque token. */
  createSession(userId: string, expiresAt: string): string {
    const token = newSessionToken();
    this.db
      .prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(token, userId, expiresAt);
    return token;
  }

  /**
   * Resolve the acting user from a session token, or null if the token is unknown or expired.
   * Expiry is checked against `now` (passed in, not read from the clock, so it is testable):
   * an expired session is treated as no session at all.
   */
  userForToken(token: string, now: string): SessionUser | null {
    const row = this.db
      .prepare(
        `SELECT u.id, u.username, u.name, s.expires_at AS expiresAt
           FROM sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.token = ?`,
      )
      .get(token) as (SessionUser & { expiresAt: string }) | undefined;
    if (!row || row.expiresAt <= now) return null;
    return { id: row.id, username: row.username, name: row.name };
  }

  /** Close a session (logout). Idempotent: deleting an unknown token is a no-op. */
  deleteSession(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
}
