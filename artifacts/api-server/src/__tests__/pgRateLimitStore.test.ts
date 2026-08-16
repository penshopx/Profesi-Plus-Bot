/**
 * Persistence tests for PgRateLimitStore.
 *
 * Uses a fake in-memory pg Pool that emulates the `rate_limit_counters` table
 * semantics (upsert, expiry-based reset, select, delete).  The shared Map
 * survives store re-creation, so these tests verify the property the store
 * exists for: counters outlive a server restart (i.e. a brand-new
 * PgRateLimitStore instance pointed at the same database still sees the
 * accumulated hits and keeps a exhausted bucket blocked).
 */

import express, { type Request, type Response } from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import type { Pool } from "pg";

import { PgRateLimitStore } from "../lib/pgRateLimitStore.js";
import { createClaimPaymentRateLimiter } from "../middlewares/rateLimiter.js";

// ── Fake pg Pool backed by a Map ─────────────────────────────────────────────

interface Row {
  hits: number;
  reset_at: Date;
}

/** Minimal pg Pool double implementing just the queries the store issues. */
function makeFakePool(table: Map<string, Row>): Pool {
  return {
    async query(sql: string, params?: unknown[]) {
      const text = sql.trim();

      if (text.startsWith("CREATE TABLE")) {
        return { rows: [] };
      }

      if (text.startsWith("INSERT INTO rate_limit_counters")) {
        const [key, resetAt] = params as [string, Date];
        const existing = table.get(key);
        const now = new Date();
        let row: Row;
        if (!existing || existing.reset_at <= now) {
          row = { hits: 1, reset_at: resetAt };
        } else {
          row = { hits: existing.hits + 1, reset_at: existing.reset_at };
        }
        table.set(key, row);
        return { rows: [{ hits: row.hits, reset_at: row.reset_at }] };
      }

      if (text.startsWith("UPDATE rate_limit_counters")) {
        const [key] = params as [string];
        const row = table.get(key);
        if (row && row.reset_at > new Date()) {
          row.hits = Math.max(0, row.hits - 1);
        }
        return { rows: [] };
      }

      if (text.startsWith("SELECT")) {
        const [key] = params as [string];
        const row = table.get(key);
        if (!row || row.reset_at <= new Date()) return { rows: [] };
        return { rows: [{ hits: row.hits, reset_at: row.reset_at }] };
      }

      if (text.startsWith("DELETE FROM rate_limit_counters WHERE")) {
        const [key] = params as [string];
        table.delete(key);
        return { rows: [] };
      }

      if (text.startsWith("DELETE FROM rate_limit_counters")) {
        table.clear();
        return { rows: [] };
      }

      throw new Error(`FakePool: unhandled query: ${text.slice(0, 80)}`);
    },
  } as unknown as Pool;
}

// ── Store-level persistence ──────────────────────────────────────────────────

describe("PgRateLimitStore persistence", () => {
  it("increments and reads back hits through the pool", async () => {
    const table = new Map<string, Row>();
    const store = new PgRateLimitStore(makeFakePool(table), { prefix: "claim" });
    store.init({ windowMs: 60 * 60 * 1000 } as never);

    const first = await store.increment("user:1");
    expect(first.totalHits).toBe(1);
    const second = await store.increment("user:1");
    expect(second.totalHits).toBe(2);

    // The row is namespaced by prefix and visible via get()
    expect(table.has("claim:user:1")).toBe(true);
    const info = await store.get("user:1");
    expect(info?.totalHits).toBe(2);
  });

  it("a new store instance (simulated restart) sees prior hits", async () => {
    const table = new Map<string, Row>();

    const storeA = new PgRateLimitStore(makeFakePool(table), { prefix: "claim" });
    storeA.init({ windowMs: 60 * 60 * 1000 } as never);
    for (let i = 0; i < 5; i++) await storeA.increment("user:9");

    // "Restart": brand-new store instance over the same database.
    const storeB = new PgRateLimitStore(makeFakePool(table), { prefix: "claim" });
    storeB.init({ windowMs: 60 * 60 * 1000 } as never);

    const next = await storeB.increment("user:9");
    expect(next.totalHits).toBe(6);
  });

  it("starts a fresh window when the stored window has expired", async () => {
    const table = new Map<string, Row>();
    table.set("claim:user:2", { hits: 10, reset_at: new Date(Date.now() - 1000) });

    const store = new PgRateLimitStore(makeFakePool(table), { prefix: "claim" });
    store.init({ windowMs: 60 * 60 * 1000 } as never);

    const info = await store.increment("user:2");
    expect(info.totalHits).toBe(1);
  });
});

// ── Limiter-level persistence (claim limiter across a "restart") ────────────

describe("claimPaymentRateLimiter with PgRateLimitStore", () => {
  function makeApp(store: PgRateLimitStore) {
    const limiter = createClaimPaymentRateLimiter({ skip: () => false, store });
    const app = express();
    app.set("trust proxy", 1);
    app.use((req: Request, _res: Response, next: () => void) => {
      (req as unknown as { dbUser: { id: number } }).dbUser = { id: 42 };
      next();
    });
    app.use(limiter);
    app.get("/test", (_req, res) => res.json({ ok: true }));
    return app;
  }

  it("an exhausted claim bucket stays blocked after limiter/store re-creation", async () => {
    const table = new Map<string, Row>();

    // Exhaust the 10/hour budget on the first "server".
    const appA = makeApp(new PgRateLimitStore(makeFakePool(table), { prefix: "claim" }));
    for (let i = 0; i < 10; i++) {
      const res = await request(appA).get("/test");
      expect(res.status).toBe(200);
    }
    expect((await request(appA).get("/test")).status).toBe(429);

    // "Restart": fresh limiter + fresh store over the same database.
    const appB = makeApp(new PgRateLimitStore(makeFakePool(table), { prefix: "claim" }));
    const res = await request(appB).get("/test");
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("rate_limit_claim");
  });
});
