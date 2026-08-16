/**
 * Task #186 — Confirm exum and competency usage counters stay accurate after
 * rate-limit hits.
 *
 * These integration tests exercise the full pipeline:
 *
 *   limiter middleware (real factory) → PgRateLimitStore (prefixed) →
 *   shared rate_limit_counters table → GET /users/me/usage (real router)
 *
 * Strategy:
 *   1. One fake in-memory pg "table" (a Map) shared by three PgRateLimitStores
 *      with prefixes "" (chat), "exum", and "competency" — the same layout
 *      production uses.
 *   2. Mini apps wire the *production* limiter factories (skip disabled) to
 *      those stores, so real requests increment real prefixed rows.
 *   3. The real users router is mounted with its rateLimiter module mocked to
 *      point the singleton stores at the same fake table, so /users/me/usage
 *      reads exactly what the limiters wrote.
 *
 * This catches regressions in: store wiring, prefix isolation, and the usage
 * endpoint's used/remaining/resetAt math.
 */

import express, { type Request, type Response } from "express";
import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import type { Pool } from "pg";

import { vi } from "vitest";

// ── Fake pg Pool backed by a shared Map (emulates rate_limit_counters) ───────

interface Row {
  hits: number;
  reset_at: Date;
}

/** One shared "database table" for the whole test file. */
const table = new Map<string, Row>();

function makeFakePool(): Pool {
  return {
    async query(sql: string, params?: unknown[]) {
      const text = sql.trim();

      if (text.startsWith("CREATE TABLE")) return { rows: [] };

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

// ── Module mocks ──────────────────────────────────────────────────────────────

// DB mock — the users router imports @workspace/db; the usage endpoint itself
// never touches the DB, and the pool here backs the production singleton
// stores in rateLimiter.ts with our fake table.
vi.mock("@workspace/db", () => {
  function makeChain() {
    const obj: Record<string, unknown> = {};
    obj["then"] = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve);
    obj["catch"] = () => obj;
    for (const m of [
      "select", "from", "where", "orderBy", "limit",
      "innerJoin", "insert", "values", "returning",
      "update", "set", "delete", "count",
    ]) {
      obj[m] = vi.fn().mockReturnValue(obj);
    }
    return obj;
  }
  const chain = makeChain();
  return {
    db: {
      select: vi.fn().mockReturnValue(chain),
      insert: vi.fn().mockReturnValue(chain),
      update: vi.fn().mockReturnValue(chain),
      delete: vi.fn().mockReturnValue(chain),
      transaction: vi.fn(),
    },
    users: {}, usageEvents: {}, messages: {}, conversations: {}, payments: {},
    pool: makeFakePool(),
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockReturnValue({}),
  and: vi.fn().mockReturnValue({}),
  desc: vi.fn().mockReturnValue({}),
  gte: vi.fn().mockReturnValue({}),
  isNull: vi.fn().mockReturnValue({}),
  count: vi.fn().mockReturnValue({}),
  sql: vi.fn().mockReturnValue({}),
}));

vi.mock("../lib/plans.js", () => ({ FREE_EXUM_LIFETIME: 3 }));
vi.mock("../lib/email.js", () => ({ sendCreditClaimEmail: vi.fn() }));
vi.mock("../lib/push.js", () => ({ sendPushNotification: vi.fn() }));

// Auth middleware — inject the test user (id set per-request via header so
// different tests can use different users against the same app instance).
vi.mock("../middlewares/auth.js", () => ({
  requireAuth: vi.fn((req: Request, _res: Response, next: () => void) => {
    const id = Number(req.headers["x-test-user"] ?? 42);
    (req as any).dbUser = { id, plan: null, planExpiresAt: null, role: "user" };
    next();
  }),
  requireRole: vi.fn(() => (_req: Request, _res: Response, next: () => void) => next()),
}));

// ── Import real modules AFTER mocks are declared ──────────────────────────────
// Because @workspace/db's pool is our fake, the production singletons
// exumRateLimitStore / competencyRateLimitStore in rateLimiter.ts are real
// PgRateLimitStores writing to our shared Map — no store mocking needed.

import {
  createExumRateLimiter,
  createCompetencyRateLimiter,
  exumRateLimitStore,
  competencyRateLimitStore,
} from "../middlewares/rateLimiter.js";
import usersRouter from "../routes/users.js";

// ── App factories ─────────────────────────────────────────────────────────────

interface DbUser {
  id: number;
  plan?: string;
  planExpiresAt?: Date | null;
}

function asUser(user: DbUser) {
  return (req: Request, _res: Response, next: () => void) => {
    (req as unknown as { dbUser: DbUser }).dbUser = user;
    next();
  };
}

/** App whose /generate route is guarded by the real exum limiter + real store. */
function makeExumApp(user: DbUser) {
  const limiter = createExumRateLimiter({ skip: () => false, store: exumRateLimitStore });
  const app = express();
  app.set("trust proxy", 1);
  app.use(asUser(user));
  app.use(limiter);
  app.post("/generate", (_req, res) => res.json({ ok: true }));
  return app;
}

/** App whose /analyze route is guarded by the real competency limiter + real store. */
function makeCompetencyApp(user: DbUser) {
  const limiter = createCompetencyRateLimiter({ skip: () => false, store: competencyRateLimitStore });
  const app = express();
  app.set("trust proxy", 1);
  app.use(asUser(user));
  app.use(limiter);
  app.post("/analyze", (_req, res) => res.json({ ok: true }));
  return app;
}

/** App exposing the real users router (usage endpoint). */
function makeUsageApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", usersRouter);
  return app;
}

async function getUsage(userId: number) {
  const res = await request(makeUsageApp())
    .get("/api/users/me/usage")
    .set("x-test-user", String(userId));
  expect(res.status).toBe(200);
  return res.body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  table.clear();
});

describe("exum limiter hits → /users/me/usage (task #186)", () => {
  it("store receives prefixed hits when the exum limiter fires", async () => {
    const app = makeExumApp({ id: 7 });
    for (let i = 0; i < 3; i++) {
      expect((await request(app).post("/generate")).status).toBe(200);
    }
    // The hits landed under the exum-prefixed key in the shared table.
    expect(table.get("exum:user:7")?.hits).toBe(3);
    expect(table.has("user:7")).toBe(false);
    expect(table.has("competency:user:7")).toBe(false);
  });

  it("usage endpoint reports exum used/remaining matching the limiter hits", async () => {
    const app = makeExumApp({ id: 7 });
    for (let i = 0; i < 3; i++) await request(app).post("/generate");

    const body = await getUsage(7);
    expect(body.exum).toMatchObject({ used: 3, limit: 5, remaining: 2 });
    expect(typeof body.exum.resetAt).toBe("string");
    // chat & competency untouched
    expect(body.chat).toMatchObject({ used: 0, remaining: 30 });
    expect(body.competency).toMatchObject({ used: 0, remaining: 5 });
  });

  it("after the limiter blocks (429), usage shows the bucket fully consumed", async () => {
    const app = makeExumApp({ id: 8 });
    for (let i = 0; i < 5; i++) {
      expect((await request(app).post("/generate")).status).toBe(200);
    }
    const blocked = await request(app).post("/generate");
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("rate_limit_exum");

    const body = await getUsage(8);
    // The 429'd attempt also counted a hit (6), but remaining is clamped at 0.
    expect(body.exum.used).toBeGreaterThanOrEqual(5);
    expect(body.exum.remaining).toBe(0);
  });
});

describe("competency limiter hits → /users/me/usage (task #186)", () => {
  it("store receives prefixed hits when the competency limiter fires", async () => {
    const app = makeCompetencyApp({ id: 9 });
    for (let i = 0; i < 2; i++) {
      expect((await request(app).post("/analyze")).status).toBe(200);
    }
    expect(table.get("competency:user:9")?.hits).toBe(2);
    expect(table.has("exum:user:9")).toBe(false);
  });

  it("usage endpoint reports competency used/remaining matching the limiter hits", async () => {
    const app = makeCompetencyApp({ id: 9 });
    for (let i = 0; i < 4; i++) await request(app).post("/analyze");

    const body = await getUsage(9);
    expect(body.competency).toMatchObject({ used: 4, limit: 5, remaining: 1 });
    expect(body.exum).toMatchObject({ used: 0, remaining: 5 });
  });
});

describe("prefix isolation under the shared rate_limit_counters table (task #186)", () => {
  it("exum and competency hits for the same user never bleed into each other", async () => {
    const exumApp = makeExumApp({ id: 11 });
    const compApp = makeCompetencyApp({ id: 11 });

    for (let i = 0; i < 5; i++) await request(exumApp).post("/generate");   // exhaust exum
    for (let i = 0; i < 2; i++) await request(compApp).post("/analyze");    // partial competency

    // Distinct rows in the SAME table:
    expect(table.get("exum:user:11")?.hits).toBe(5);
    expect(table.get("competency:user:11")?.hits).toBe(2);

    // Exum exhausted but competency still allowed:
    expect((await request(exumApp).post("/generate")).status).toBe(429);
    expect((await request(compApp).post("/analyze")).status).toBe(200);

    const body = await getUsage(11);
    expect(body.exum.remaining).toBe(0);
    expect(body.competency).toMatchObject({ used: 3, remaining: 2 });
  });

  it("counters are isolated per user within each prefix", async () => {
    const appA = makeExumApp({ id: 21 });
    const appB = makeExumApp({ id: 22 });
    for (let i = 0; i < 5; i++) await request(appA).post("/generate");

    expect((await request(appA).post("/generate")).status).toBe(429);
    expect((await request(appB).post("/generate")).status).toBe(200);

    const bodyA = await getUsage(21);
    const bodyB = await getUsage(22);
    expect(bodyA.exum.remaining).toBe(0);
    expect(bodyB.exum).toMatchObject({ used: 1, remaining: 4 });
  });
});
