/**
 * Route-level tests for POST/PATCH /users/me/push-token
 *
 * Covers:
 *  - A new token is stored and expoPushTokenSetAt is written
 *  - An unchanged token (same ExponentPushToken returned by Expo) STILL writes
 *    expoPushTokenSetAt — this is the critical regression guard: stable devices
 *    must never lose their token after 90 days just because Expo reused the token
 *  - Missing / invalid token body returns 400
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Captured DB call arguments ─────────────────────────────────────────────────
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@workspace/db", () => {
  const chain = {
    set:   (...args: unknown[]) => { mockSet(...args); return chain; },
    where: (...args: unknown[]) => { mockWhere(...args); return chain; },
    then:  (resolve: (v: unknown) => void) => Promise.resolve(undefined).then(resolve),
    catch: (cb: (e: unknown) => void) => Promise.resolve(undefined).catch(cb),
  };
  return {
    db: {
      update: (...args: unknown[]) => { mockUpdate(...args); return chain; },
    },
    users: { id: "id", expoPushToken: "expoPushToken", expoPushTokenSetAt: "expoPushTokenSetAt" },
    payments: {},
    messages: {},
    conversations: {},
    usageEvents: {},
    // pool is imported by rateLimiter.ts (via PgRateLimitStore); provide a no-op
    // so the module can load even though the real DB is not used in these tests.
    pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
  };
});

vi.mock("drizzle-orm", () => ({
  eq:  vi.fn((_col, val) => ({ col: _col, val })),
  and: vi.fn((...args) => ({ and: args })),
  sql: vi.fn().mockReturnValue({}),
}));

// ── Auth middleware ───────────────────────────────────────────────────────────
const STORED_TOKEN = "ExponentPushToken[stableDeviceABC]";

vi.mock("../middlewares/auth.js", () => ({
  requireAuth: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).dbUser = {
      id: 7,
      email: "user@example.com",
      name: "Test User",
      expoPushToken: STORED_TOKEN,
      expoPushTokenSetAt: new Date("2025-01-01"),
    };
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    next();
  }),
  requireRole: vi.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
}));

// ── App setup ────────────────────────────────────────────────────────────────
async function buildApp() {
  const { default: usersRouter } = await import("../routes/users.js");
  const app = express();
  app.use(express.json());
  app.use("/api", usersRouter);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("POST/PATCH /users/me/push-token", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores a new token and writes expoPushTokenSetAt", async () => {
    const app = await buildApp();
    const newToken = "ExponentPushToken[brandNewToken123]";

    const res = await request(app)
      .post("/api/users/me/push-token")
      .send({ token: newToken });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const setCall = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCall.expoPushToken).toBe(newToken);
    expect(setCall.expoPushTokenSetAt).toBeInstanceOf(Date);
  });

  it("refreshes expoPushTokenSetAt even when the token is unchanged (stable device)", async () => {
    // The stored token equals STORED_TOKEN — Expo returned the same token again.
    // The handler must still write expoPushTokenSetAt to keep the 90-day clock fresh.
    const app = await buildApp();

    const res = await request(app)
      .post("/api/users/me/push-token")
      .send({ token: STORED_TOKEN });

    expect(res.status).toBe(200);
    // DB update must be called — the timestamp must always be refreshed
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const setCall = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCall.expoPushToken).toBe(STORED_TOKEN);
    expect(setCall.expoPushTokenSetAt).toBeInstanceOf(Date);
  });

  it("returns 400 when token is missing from the body", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/users/me/push-token")
      .send({});

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when token is not a string", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/users/me/push-token")
      .send({ token: 12345 });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("also accepts PATCH method", async () => {
    const app = await buildApp();
    const res = await request(app)
      .patch("/api/users/me/push-token")
      .send({ token: STORED_TOKEN });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
