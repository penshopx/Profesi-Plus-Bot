/**
 * Integration tests for rate-limiter middleware.
 *
 * Each test creates an isolated Express mini-app using the *production* factory
 * functions from rateLimiter.ts.  The only overrides supplied are:
 *   - `skip: () => false`  — defeats the NODE_ENV=test guard so the limiter
 *                            actually fires during testing
 *   - a fresh `MemoryStore` — isolates state between tests
 *
 * This means a regression in the exported factory configuration (wrong limit,
 * wrong key function, wrong response shape) will cause these tests to fail.
 *
 * Chat messages : Free=30/hour   Pro=120/hour
 * Competency AI : Free=5/day     Pro=20/day
 */

import express, { type Request, type Response } from "express";
import { MemoryStore } from "express-rate-limit";
import request from "supertest";
import { describe, it, expect } from "vitest";

import {
  createChatMessageRateLimiter,
  createExumRateLimiter,
  createCompetencyRateLimiter,
  createClaimPaymentRateLimiter,
  createCatalogRateLimiter,
} from "../middlewares/rateLimiter.js";

// ── Test helpers ─────────────────────────────────────────────────────────────

interface DbUser {
  id: number;
  plan?: string;
  planExpiresAt?: Date | null;
}

/** Attach a fake dbUser to every request, matching the shape the production
 *  middleware reads via  `(req as any).dbUser`. */
function asUser(user: DbUser) {
  return (_req: Request, _res: Response, next: () => void) => {
    (_req as unknown as { dbUser: DbUser }).dbUser = user;
    next();
  };
}

/**
 * Parse the `limit` field from the draft-7 combined `ratelimit` response header.
 * Format: "limit=30, remaining=29, reset=3600"
 */
function parseDraft7Limit(headers: Record<string, string>): number {
  const raw = headers["ratelimit"] ?? "";
  const match = raw.match(/limit=(\d+)/);
  return match ? parseInt(match[1], 10) : NaN;
}

/** Send `count` sequential GET /test requests to app; return all status codes. */
async function sendN(
  app: express.Express,
  count: number,
): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < count; i++) {
    const res = await request(app).get("/test");
    statuses.push(res.status);
  }
  return statuses;
}

// ── chatMessageRateLimiter ────────────────────────────────────────────────────

describe("chatMessageRateLimiter", () => {
  const FREE_LIMIT = 30;
  const PRO_LIMIT = 120;

  /** Build a test app using the real production factory, skip disabled. */
  function makeApp(user: DbUser, store = new MemoryStore()) {
    const limiter = createChatMessageRateLimiter({ skip: () => false, store });
    const app = express();
    app.set("trust proxy", 1);
    app.use(asUser(user));
    app.use(limiter);
    app.get("/test", (_req, res) => res.json({ ok: true }));
    return app;
  }

  it("allows a Free user to send exactly 30 messages", async () => {
    const app = makeApp({ id: 1 });
    const statuses = await sendN(app, FREE_LIMIT);
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it("blocks a Free user on the 31st message with 429", async () => {
    const app = makeApp({ id: 2 });
    await sendN(app, FREE_LIMIT);
    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
  });

  it("returns code=rate_limit_chat (not 500) when a Free user is blocked", async () => {
    const app = makeApp({ id: 3 });
    await sendN(app, FREE_LIMIT);
    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: "rate_limit_chat" });
    expect(res.status).not.toBe(500);
  });

  it("allows a Pro user to send 30 messages without being blocked", async () => {
    const app = makeApp({ id: 4, plan: "pro" });
    const statuses = await sendN(app, FREE_LIMIT);
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it("reports RateLimit-Limit of 120 for Pro users", async () => {
    const app = makeApp({ id: 5, plan: "pro" });
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    // draft-7 combined header: "limit=120, remaining=119, reset=3600"
    expect(parseDraft7Limit(res.headers as Record<string, string>)).toBe(PRO_LIMIT);
  });

  it("reports RateLimit-Limit of 30 for Free users", async () => {
    const app = makeApp({ id: 6 });
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    // draft-7 combined header: "limit=30, remaining=29, reset=3600"
    expect(parseDraft7Limit(res.headers as Record<string, string>)).toBe(FREE_LIMIT);
  });

  it("tracks limits per user independently (different IDs do not share buckets)", async () => {
    // Share one MemoryStore between two users to confirm keying is per-user-id
    const store = new MemoryStore();
    const appA = makeApp({ id: 10 }, store);
    const appB = makeApp({ id: 11 }, store);

    // Exhaust user 10's quota
    await sendN(appA, FREE_LIMIT);

    // User 11 should still be unaffected
    const res = await request(appB).get("/test");
    expect(res.status).toBe(200);
  });

  it("treats a Pro user with an expired plan as Free (blocked at 30)", async () => {
    const app = makeApp({
      id: 7,
      plan: "pro",
      planExpiresAt: new Date("2000-01-01"), // well in the past
    });
    await sendN(app, FREE_LIMIT);
    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: "rate_limit_chat" });
  });
});

// ── exumRateLimiter ───────────────────────────────────────────────────────────

describe("exumRateLimiter (#209 — blocks excess generation attempts)", () => {
  const FREE_LIMIT = 5;
  const PRO_LIMIT = 20;

  /** Build a test app using the real production factory, skip disabled. */
  function makeApp(user: DbUser, store = new MemoryStore()) {
    const limiter = createExumRateLimiter({ skip: () => false, store });
    const app = express();
    app.set("trust proxy", 1);
    app.use(asUser(user));
    app.use(limiter);
    app.get("/test", (_req, res) => res.json({ ok: true }));
    return app;
  }

  it("allows a Free user exactly 5 generations", async () => {
    const app = makeApp({ id: 1 });
    const statuses = await sendN(app, FREE_LIMIT);
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it("blocks a Free user on the 6th request with 429 and code=rate_limit_exum", async () => {
    const app = makeApp({ id: 2 });
    await sendN(app, FREE_LIMIT);
    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: "rate_limit_exum" });
  });

  it("allows a Pro user 20 generations before blocking the 21st", async () => {
    const app = makeApp({ id: 3, plan: "pro" });
    const statuses = await sendN(app, PRO_LIMIT);
    expect(statuses.every((s) => s === 200)).toBe(true);
    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: "rate_limit_exum" });
  });

  it("tracks limits per user independently (different IDs do not share buckets)", async () => {
    // Share one MemoryStore between two users to confirm keying is per-user-id
    const store = new MemoryStore();
    const appA = makeApp({ id: 10 }, store);
    const appB = makeApp({ id: 11 }, store);

    // Exhaust user 10's quota
    await sendN(appA, FREE_LIMIT);

    // User 11 should still be unaffected
    const res = await request(appB).get("/test");
    expect(res.status).toBe(200);
  });

  it("reports the draft-7 RateLimit-Limit matching the configured limits", async () => {
    const freeRes = await request(makeApp({ id: 20 })).get("/test");
    expect(parseDraft7Limit(freeRes.headers as Record<string, string>)).toBe(FREE_LIMIT);

    const proRes = await request(makeApp({ id: 21, plan: "pro" })).get("/test");
    expect(parseDraft7Limit(proRes.headers as Record<string, string>)).toBe(PRO_LIMIT);
  });
});

// ── competencyRateLimiter ─────────────────────────────────────────────────────

describe("competencyRateLimiter", () => {
  const FREE_LIMIT = 5;
  const PRO_LIMIT = 20;

  function makeApp(user: DbUser, store = new MemoryStore()) {
    const limiter = createCompetencyRateLimiter({ skip: () => false, store });
    const app = express();
    app.set("trust proxy", 1);
    app.use(asUser(user));
    app.use(limiter);
    app.get("/test", (_req, res) => res.json({ ok: true }));
    return app;
  }

  it("allows a Free user exactly 5 analyses", async () => {
    const app = makeApp({ id: 20 });
    const statuses = await sendN(app, FREE_LIMIT);
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it("blocks a Free user on the 6th analysis with 429", async () => {
    const app = makeApp({ id: 21 });
    await sendN(app, FREE_LIMIT);
    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
  });

  it("returns code=rate_limit_competency (not 500) when a Free user is blocked", async () => {
    const app = makeApp({ id: 22 });
    await sendN(app, FREE_LIMIT);
    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: "rate_limit_competency" });
    expect(res.status).not.toBe(500);
  });

  it("allows a Pro user 5 analyses without being blocked (Free limit does not apply)", async () => {
    const app = makeApp({ id: 23, plan: "pro" });
    const statuses = await sendN(app, FREE_LIMIT);
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it("reports RateLimit-Limit of 20 for Pro users", async () => {
    const app = makeApp({ id: 24, plan: "pro" });
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    // draft-7 combined header: "limit=20, remaining=19, reset=86400"
    expect(parseDraft7Limit(res.headers as Record<string, string>)).toBe(PRO_LIMIT);
  });

  it("reports RateLimit-Limit of 5 for Free users", async () => {
    const app = makeApp({ id: 25 });
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    // draft-7 combined header: "limit=5, remaining=4, reset=86400"
    expect(parseDraft7Limit(res.headers as Record<string, string>)).toBe(FREE_LIMIT);
  });

  it("tracks limits per user independently", async () => {
    const store = new MemoryStore();
    const appA = makeApp({ id: 30 }, store);
    const appB = makeApp({ id: 31 }, store);

    // Exhaust user 30's quota
    await sendN(appA, FREE_LIMIT);

    // User 31's first request must still succeed
    const res = await request(appB).get("/test");
    expect(res.status).toBe(200);
  });

  it("treats a Pro user with an expired plan as Free (blocked at 5)", async () => {
    const app = makeApp({
      id: 26,
      plan: "pro",
      planExpiresAt: new Date("2000-01-01"),
    });
    await sendN(app, FREE_LIMIT);
    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: "rate_limit_competency" });
  });
});

// ── claimPaymentRateLimiter ───────────────────────────────────────────────────
// Task #87: confirm the limiter actually blocks brute-force order ID guessing.
//
// The limiter is account-keyed (userKey), not IP-keyed, so different user IDs
// must have independent buckets even when sharing a MemoryStore.

describe("claimPaymentRateLimiter (#87 — blocks brute-force order ID guessing)", () => {
  const CLAIM_LIMIT = 10;

  function makeApp(user: DbUser, store = new MemoryStore()) {
    const limiter = createClaimPaymentRateLimiter({ skip: () => false, store });
    const app = express();
    app.set("trust proxy", 1);
    app.use(asUser(user));
    app.use(limiter);
    app.post("/test", (_req, res) => res.json({ ok: true }));
    return app;
  }

  async function postN(app: express.Express, count: number): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < count; i++) {
      const res = await request(app).post("/test");
      statuses.push(res.status);
    }
    return statuses;
  }

  it("allows exactly 10 claim attempts before blocking", async () => {
    const app = makeApp({ id: 50 });
    const statuses = await postN(app, CLAIM_LIMIT);
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it("blocks the 11th attempt with 429", async () => {
    const app = makeApp({ id: 51 });
    await postN(app, CLAIM_LIMIT);
    const res = await request(app).post("/test");
    expect(res.status).toBe(429);
  });

  it("returns code=rate_limit_claim (not 500) when blocked", async () => {
    const app = makeApp({ id: 52 });
    await postN(app, CLAIM_LIMIT);
    const res = await request(app).post("/test");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: "rate_limit_claim" });
    expect(res.status).not.toBe(500);
  });

  it("includes a human-readable error message the mobile ClaimCard can display", async () => {
    const app = makeApp({ id: 53 });
    await postN(app, CLAIM_LIMIT);
    const res = await request(app).post("/test");
    expect(res.status).toBe(429);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
    expect(res.body.error).toBe(
      "Terlalu banyak percobaan klaim. Coba lagi dalam beberapa saat.",
    );
  });

  it("tracks limits per user independently — different users share no bucket", async () => {
    // One shared store to confirm keying is per-user-id
    const store = new MemoryStore();
    const appA = makeApp({ id: 60 }, store);
    const appB = makeApp({ id: 61 }, store);

    // Exhaust user 60's quota entirely
    await postN(appA, CLAIM_LIMIT);
    const blockedA = await request(appA).post("/test");
    expect(blockedA.status).toBe(429);

    // User 61 must still be allowed — their bucket is independent
    const allowedB = await request(appB).post("/test");
    expect(allowedB.status).toBe(200);
  });

  it("reports RateLimit-Limit of 10 in the response headers", async () => {
    const app = makeApp({ id: 62 });
    const res = await request(app).post("/test");
    expect(res.status).toBe(200);
    // draft-7 combined header: "limit=10, remaining=9, reset=3600"
    expect(parseDraft7Limit(res.headers as Record<string, string>)).toBe(CLAIM_LIMIT);
  });
});

// ── catalogRateLimiter ────────────────────────────────────────────────────────
// Task #115: confirm the public course catalog can't be scraped before the
// rate limiter blocks it.
//
// The limiter is IP-keyed (no auth required), so different source IPs must
// have independent buckets even when sharing a MemoryStore.

describe("catalogRateLimiter (#115 — blocks catalog scraping)", () => {
  const CATALOG_LIMIT = 120;

  /** Build a test app that simulates a given source IP via X-Forwarded-For. */
  function makeApp(store = new MemoryStore()) {
    const limiter = createCatalogRateLimiter({ skip: () => false, store });
    const app = express();
    app.set("trust proxy", 1);
    app.use(limiter);
    app.get("/test", (_req, res) => res.json({ ok: true }));
    return app;
  }

  /** Send `count` sequential GET /test requests from a specific IP. */
  async function sendNFromIp(
    app: express.Express,
    count: number,
    ip: string,
  ): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < count; i++) {
      const res = await request(app)
        .get("/test")
        .set("X-Forwarded-For", ip);
      statuses.push(res.status);
    }
    return statuses;
  }

  it("allows exactly 120 requests before blocking", async () => {
    const app = makeApp();
    const statuses = await sendNFromIp(app, CATALOG_LIMIT, "1.2.3.4");
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it("blocks the 121st request with 429", async () => {
    const app = makeApp();
    await sendNFromIp(app, CATALOG_LIMIT, "1.2.3.4");
    const res = await request(app)
      .get("/test")
      .set("X-Forwarded-For", "1.2.3.4");
    expect(res.status).toBe(429);
  });

  it("returns code=rate_limit_catalog (not 500) when blocked", async () => {
    const app = makeApp();
    await sendNFromIp(app, CATALOG_LIMIT, "1.2.3.4");
    const res = await request(app)
      .get("/test")
      .set("X-Forwarded-For", "1.2.3.4");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: "rate_limit_catalog" });
    expect(res.status).not.toBe(500);
  });

  it("tracks limits per IP independently — exhausted IP A does not block IP B", async () => {
    // One shared store to confirm keying is per-IP
    const store = new MemoryStore();
    const app = makeApp(store);

    // Exhaust IP A's quota entirely
    await sendNFromIp(app, CATALOG_LIMIT, "10.0.0.1");
    const blockedA = await request(app)
      .get("/test")
      .set("X-Forwarded-For", "10.0.0.1");
    expect(blockedA.status).toBe(429);

    // IP B must still be allowed — its bucket is independent
    const allowedB = await request(app)
      .get("/test")
      .set("X-Forwarded-For", "10.0.0.2");
    expect(allowedB.status).toBe(200);
  });

  it("reports RateLimit-Limit: 120 on the first response (draft-7 header)", async () => {
    const app = makeApp();
    const res = await request(app)
      .get("/test")
      .set("X-Forwarded-For", "1.2.3.4");
    expect(res.status).toBe(200);
    // draft-7 combined header: "limit=120, remaining=119, reset=3600"
    expect(parseDraft7Limit(res.headers as Record<string, string>)).toBe(CATALOG_LIMIT);
  });
});
