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
  createCompetencyRateLimiter,
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
