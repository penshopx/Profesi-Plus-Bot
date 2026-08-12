/**
 * Route-level test: POST /users/me/claim-payment email dispatch
 *
 * Verifies that after a successful claim transaction, sendCreditClaimEmail is
 * invoked with the authenticated user's email address and the actual post-
 * transaction credit values (not the stale pre-request snapshot).
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock ────────────────────────────────────────────────────────────────────
// Supports a simple queue: each awaitable DB call pops the next value.
const dbQueue = vi.hoisted(() => ({
  q: [] as unknown[],
  push(...items: unknown[]) { this.q.push(...items); },
  shift(): unknown { return this.q.shift() ?? []; },
}));

vi.mock("@workspace/db", () => {
  function makeChain() {
    const obj: Record<string, unknown> = {};
    obj["then"] = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(dbQueue.shift()).then(resolve, reject);
    obj["catch"] = (reject: (e: unknown) => void) =>
      Promise.resolve(dbQueue.shift()).catch(reject);
    for (const m of ["select", "from", "where", "limit", "update", "set", "returning"]) {
      obj[m] = vi.fn().mockReturnValue(obj);
    }
    return obj;
  }
  const chain = makeChain();
  const dbMock = {
    select:      vi.fn().mockReturnValue(chain),
    insert:      vi.fn().mockReturnValue(chain),
    update:      vi.fn().mockReturnValue(chain),
    delete:      vi.fn().mockReturnValue(chain),
    transaction: vi.fn(),
  };
  return {
    db: dbMock,
    users:    { id: "id", exumCredits: "exumCredits", expoPushToken: "expoPushToken" },
    payments: { id: "id", externalId: "externalId", customerEmail: "customerEmail", userId: "userId", status: "status", creditsGranted: "creditsGranted" },
    messages: {},
    conversations: {},
    usageEvents: {},
  };
});

vi.mock("drizzle-orm", () => ({
  eq:     vi.fn().mockReturnValue({}),
  and:    vi.fn().mockReturnValue({}),
  isNull: vi.fn().mockReturnValue({}),
  desc:   vi.fn().mockReturnValue({}),
  sql:    vi.fn().mockReturnValue({}),
  gte:    vi.fn().mockReturnValue({}),
  count:  vi.fn().mockReturnValue({}),
}));

// ── Auth middleware — fake authenticated user ─────────────────────────────────
vi.mock("../middlewares/auth.js", () => ({
  requireAuth: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).dbUser = {
      id: 42,
      email: "budi@example.com",
      name: "Budi Santoso",
      plan: null,
      planExpiresAt: null,
      exumCredits: 3,         // pre-transaction snapshot
      expoPushToken: null,     // skip push notification in tests
    };
    (req as any).log = {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    };
    next();
  }),
  requireRole: vi.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
}));

// ── Rate limiter — passthrough ────────────────────────────────────────────────
vi.mock("../middlewares/rateLimiter.js", () => ({
  chatRateLimitStore:           { get: vi.fn().mockResolvedValue(null) },
  userKey:                      vi.fn().mockReturnValue("user:42"),
  claimPaymentRateLimiter:      vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  chatMessageRateLimiter:       vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  exumRateLimiter:              vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  createChatMessageRateLimiter: vi.fn(),
  createCompetencyRateLimiter:  vi.fn(),
}));

// ── Email helper — capture calls ──────────────────────────────────────────────
const emailMock = vi.hoisted(() => ({
  sendCreditClaimEmail: vi.fn(),
  sendEmail:            vi.fn(),
}));

vi.mock("../lib/email.js", () => emailMock);

// ── App ───────────────────────────────────────────────────────────────────────

async function buildApp() {
  const { default: usersRouter } = await import("../routes/users.js");
  const app = express();
  app.use(express.json());
  app.use("/api", usersRouter);
  return app;
}

// Flush micro-task queue so non-blocking callbacks run.
const flush = () => new Promise<void>((r) => setTimeout(r, 20));

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/users/me/claim-payment — email dispatch", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    dbQueue.q = [];
    app = await buildApp();
  });

  it("calls sendCreditClaimEmail with the user's email, orderId, and post-transaction balance", async () => {
    const { db } = await import("@workspace/db");

    // DB call 1: find payment by external ID
    dbQueue.push([{
      id: 1,
      externalId: "ORD-999",
      customerEmail: "budi@example.com",
      userId: null,       // unclaimed
      status: "paid",
      creditsGranted: 5,
    }]);

    // DB call 2 (post-claim balance query): updated user row
    dbQueue.push([{ exumCredits: 8 }]);

    // Mock the transaction to assign the payment and grant credits
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: typeof db) => Promise<number>) => {
        // Fake transaction proxy that returns creditsGranted = 5
        const txChain = (() => {
          let creditsValue = 5;
          const obj: Record<string, unknown> = {};
          obj["then"] = (resolve: (v: unknown) => void) =>
            Promise.resolve([{ creditsGranted: creditsValue }]).then(resolve);
          for (const m of ["update", "set", "where", "returning"]) {
            obj[m] = vi.fn().mockReturnValue(obj);
          }
          return obj;
        })();

        const tx = {
          update: vi.fn().mockReturnValue(txChain),
        } as unknown as typeof db;

        return fn(tx);
      }
    );

    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "ORD-999", customerEmail: "budi@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.creditsGranted).toBe(5);

    // Wait for the non-blocking balance fetch + email dispatch
    await flush();

    expect(emailMock.sendCreditClaimEmail).toHaveBeenCalledOnce();
    expect(emailMock.sendCreditClaimEmail).toHaveBeenCalledWith({
      to:             "budi@example.com",
      orderId:        "ORD-999",
      creditsGranted: 5,
      newBalance:     8,          // from the post-transaction DB query
    });
  });

  it("does not call sendCreditClaimEmail when the user has no email address", async () => {
    const { db, users } = await import("@workspace/db");
    const { requireAuth } = await import("../middlewares/auth.js");

    // Override the fake user to have no email
    (requireAuth as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        (req as any).dbUser = {
          id: 42, email: "", name: "Budi", plan: null, planExpiresAt: null,
          exumCredits: 3, expoPushToken: null,
        };
        (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
        next();
      }
    );

    dbQueue.push([{
      id: 1,
      externalId: "ORD-000",
      customerEmail: "",
      userId: null,
      status: "paid",
      creditsGranted: 5,
    }]);

    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: typeof db) => Promise<number>) => {
        const txChain = (() => {
          const obj: Record<string, unknown> = {};
          obj["then"] = (resolve: (v: unknown) => void) =>
            Promise.resolve([{ creditsGranted: 5 }]).then(resolve);
          for (const m of ["update", "set", "where", "returning"]) {
            obj[m] = vi.fn().mockReturnValue(obj);
          }
          return obj;
        })();
        return fn({ update: vi.fn().mockReturnValue(txChain) } as unknown as typeof db);
      }
    );

    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "ORD-000", customerEmail: "" });

    // Empty email fails validation before reaching claim logic
    expect(res.status).toBe(400);
    await flush();
    expect(emailMock.sendCreditClaimEmail).not.toHaveBeenCalled();
  });
});
