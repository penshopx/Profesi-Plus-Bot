/**
 * PostgreSQL-backed store for express-rate-limit.
 *
 * Persists rate-limit counters in the `rate_limit_counters` table so they
 * survive server restarts.  Uses a single upsert per `increment()` call to
 * keep hot-path latency low while staying safe under concurrent requests.
 *
 * The table is created automatically on first use (CREATE TABLE IF NOT EXISTS)
 * so no separate migration step is required.
 */

import type { Store, ClientRateLimitInfo, Options } from "express-rate-limit";
import type { Pool } from "pg";

export class PgRateLimitStore implements Store {
  /**
   * Window length in milliseconds.  Set by express-rate-limit via `init()`.
   * Defaults to 1 hour so callers that read the store directly (e.g. the
   * /users/me/usage endpoint) get a sensible fallback before init fires.
   */
  private windowMs: number = 60 * 60 * 1000;

  /** Resolves once the DDL CREATE TABLE IF NOT EXISTS has completed. */
  private readyPromise: Promise<void>;

  constructor(private readonly pool: Pool) {
    this.readyPromise = this.createTable();
  }

  // ── express-rate-limit Store interface ──────────────────────────────────────

  /** Called by express-rate-limit when the middleware is constructed. */
  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  /**
   * Atomically increment (or reset-then-set) the hit counter for `key`.
   * Returns the new total and the window reset time.
   */
  async increment(key: string): Promise<ClientRateLimitInfo> {
    await this.readyPromise;

    const resetAt = new Date(Date.now() + this.windowMs);

    // Single upsert:
    //   • On INSERT (first hit in this window): hits=1, reset_at=now+windowMs
    //   • On CONFLICT (key already exists):
    //       - If the stored window has expired, treat as a fresh window (hits=1)
    //       - Otherwise increment within the existing window
    const result = await this.pool.query<{ hits: number; reset_at: Date }>(
      `
      INSERT INTO rate_limit_counters (key, hits, reset_at)
      VALUES ($1, 1, $2)
      ON CONFLICT (key) DO UPDATE SET
        hits    = CASE
                    WHEN rate_limit_counters.reset_at <= NOW() THEN 1
                    ELSE rate_limit_counters.hits + 1
                  END,
        reset_at = CASE
                    WHEN rate_limit_counters.reset_at <= NOW() THEN $2
                    ELSE rate_limit_counters.reset_at
                  END
      RETURNING hits, reset_at
      `,
      [key, resetAt],
    );

    const row = result.rows[0];
    return { totalHits: row.hits, resetTime: row.reset_at };
  }

  /** Decrement the hit counter by 1 (floor 0). No-op if the window has expired. */
  async decrement(key: string): Promise<void> {
    await this.readyPromise;
    await this.pool.query(
      `UPDATE rate_limit_counters
       SET hits = GREATEST(0, hits - 1)
       WHERE key = $1 AND reset_at > NOW()`,
      [key],
    );
  }

  /** Return the current info for `key`, or undefined if no active window exists. */
  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    await this.readyPromise;
    const result = await this.pool.query<{ hits: number; reset_at: Date }>(
      `SELECT hits, reset_at
       FROM rate_limit_counters
       WHERE key = $1 AND reset_at > NOW()`,
      [key],
    );
    if (result.rows.length === 0) return undefined;
    const row = result.rows[0];
    return { totalHits: row.hits, resetTime: row.reset_at };
  }

  /** Remove the stored record for `key` (used by express-rate-limit and tests). */
  async resetKey(key: string): Promise<void> {
    await this.readyPromise;
    await this.pool.query(`DELETE FROM rate_limit_counters WHERE key = $1`, [key]);
  }

  /** Remove all stored records. */
  async resetAll(): Promise<void> {
    await this.readyPromise;
    await this.pool.query(`DELETE FROM rate_limit_counters`);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async createTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_counters (
        key      TEXT        PRIMARY KEY,
        hits     INTEGER     NOT NULL DEFAULT 0,
        reset_at TIMESTAMPTZ NOT NULL
      )
    `);
  }
}
