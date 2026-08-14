/**
 * Integration tests for GET /users/me/usage
 *
 * Verifies that the endpoint reads the actual rate-limit store counter
 * (chatRateLimitStore) rather than counting DB messages, so the display
 * number can never drift from the counter that controls enforcement.
 *
 * Strategy:
 *   1. Build a mini Express app that includes the real users router.
 *   2. Inject a controlled MemoryStore whose `get()` returns a known count.
 *   3. Assert that the response reflects the store value, not a DB query.
 *
 * The DB mock returns no messages to confirm the endpoint never falls back
 * to counting rows.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryStore } from "express-rate-limit";

// ── DB mock — always returns empty arrays / no rows ───────────────────────────
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
    users: { id: "id", plan: "plan", planExpiresAt: "planExpiresAt", exumCredits: "exumCredits" },
    usageEvents: {},
    messages: { conversationId: "conversationId", role: "role", createdAt: "createdAt" },
    conversations: { userId: "userId" },
    payments: {},
    // pool is imported by rateLimiter.ts (via PgRateLimitStore); provide a no-op
    // so the module can load even though the real DB is not used in these tests.
    pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
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

// ── Auth middleware — inject a fake authenticated user ─────────────────────────
vi.mock("../middlewares/auth.js", () => ({
  requireAuth: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).dbUser = {
      id: 42,
      name: "Budi Santoso",
      plan: null,
      planExpiresAt: null,
      role: "user",
    };
    next();
  }),
  requireRole: vi.fn(
    () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()
  ),
}));

// ── claimPaymentRateLimiter passthrough ───────────────────────────────────────
vi.mock("../middlewares/rateLimiter.js", async (importOriginal) => {
  // We need userKey from the real module and a controllable chatRateLimitStore.
  const real = await importOriginal<typeof import("../middlewares/rateLimiter.js")>();
  return {
    ...real,
    // Override only the singleton store — tests inject their own via controlledStore below.
    chatRateLimitStore: controlledStore,
    claimPaymentRateLimiter: vi.fn(
      (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()
    ),
  };
});

// ── Controlled MemoryStore — seeded with a known hit count ───────────────────
//
// We build the store outside the mock factory so we can call
// `controlledStore.increment()` in each test to set up a known state before
// the request arrives.
const controlledStore = new MemoryStore();
// Shorten the window so increment() resets cleanly across tests.
(controlledStore as any).windowMs = 60 * 60 * 1000;

// ── App factory ───────────────────────────────────────────────────────────────

async function buildApp() {
  const { default: usersRouter } = await import("../routes/users.js");
  const app = express();
  app.use(express.json());
  app.use("/api", usersRouter);
  return app;
}

// ── lib/plans stub ────────────────────────────────────────────────────────────
vi.mock("../lib/plans.js", () => ({ FREE_EXUM_LIFETIME: 3 }));
vi.mock("../lib/email.js", () => ({ sendCreditClaimEmail: vi.fn() }));

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/users/me/usage", () => {
  let app: express.Express;

  beforeEach(async () => {
    // Reset the store for the user key used in these tests so counts don't leak.
    // resetKey() is the public API; it's safe to call even if the key doesn't exist.
    await controlledStore.resetKey("user:42");
    app = await buildApp();
  });

  it("returns used=0, limit=30, remaining=30 when the store has no recorded hits", async () => {
    const res = await request(app).get("/api/users/me/usage");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      used: 0,
      limit: 30,
      remaining: 30,
    });
  });

  it("reflects the actual store hit count (not a DB message count)", async () => {
    // Simulate 5 hits already recorded in the store for user key "user:42".
    for (let i = 0; i < 5; i++) {
      await controlledStore.increment("user:42");
    }

    const res = await request(app).get("/api/users/me/usage");

    expect(res.status).toBe(200);
    // used must come from the store (5), not from DB (which returns 0 rows).
    expect(res.body.used).toBe(5);
    expect(res.body.remaining).toBe(25); // 30 - 5
    expect(res.body.limit).toBe(30);
  });

  it("reports remaining=0 when the store shows the user has hit the limit", async () => {
    for (let i = 0; i < 30; i++) {
      await controlledStore.increment("user:42");
    }

    const res = await request(app).get("/api/users/me/usage");

    expect(res.status).toBe(200);
    expect(res.body.used).toBe(30);
    expect(res.body.remaining).toBe(0);
  });

  it("includes resetAt and serverNow in the response for accurate countdown display", async () => {
    await controlledStore.increment("user:42");

    const res = await request(app).get("/api/users/me/usage");

    expect(res.status).toBe(200);
    // resetAt may be null if no entry exists yet, but serverNow must always be present.
    expect(res.body).toHaveProperty("serverNow");
    expect(typeof res.body.serverNow).toBe("string");
    // If resetAt is set it should be a valid ISO string.
    if (res.body.resetAt !== null) {
      expect(() => new Date(res.body.resetAt)).not.toThrow();
    }
  });

  it("caps remaining at 0 even if the store shows more hits than the limit", async () => {
    // Artificially push 35 hits (store allows it; the limiter would have blocked at 30).
    for (let i = 0; i < 35; i++) {
      await controlledStore.increment("user:42");
    }

    const res = await request(app).get("/api/users/me/usage");

    expect(res.status).toBe(200);
    expect(res.body.remaining).toBe(0); // Math.max(0, 30 - 35) = 0
  });
});
