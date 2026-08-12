/**
 * Race-condition test: POST /users/me/claim-payment
 *
 * Verifies that two simultaneous claim requests for the same orderId cannot
 * both succeed. The atomic UPDATE … WHERE userId IS NULL inside the transaction
 * is the application-level guard; this test confirms the route correctly
 * translates a "zero rows updated" result (the race loser) into a 409 and
 * does NOT increment the user's credit balance a second time.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB queue — each awaitable DB call pops the next value ─────────────────────
// Using the same queue pattern as claim-payment-route.test.ts so the
// SELECT-before-transaction returns whatever the test pushes.
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
    for (const m of ["select", "from", "where", "limit", "update", "set",
                     "returning", "orderBy", "insert", "delete"]) {
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
    db:            dbMock,
    users:         { id: "id", exumCredits: "exumCredits", expoPushToken: "expoPushToken" },
    payments:      { id: "id", externalId: "externalId", customerEmail: "customerEmail",
                     userId: "userId", status: "status", creditsGranted: "creditsGranted" },
    messages:      {},
    conversations: {},
    usageEvents:   {},
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
      id: 99,
      email: "ani@example.com",
      name: "Ani Rahayu",
      plan: null,
      planExpiresAt: null,
      exumCredits: 0,
      expoPushToken: null,
    };
    (req as any).log = {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    };
    next();
  }),
  requireRole: vi.fn(() => (
    _req: express.Request, _res: express.Response, next: express.NextFunction
  ) => next()),
}));

// ── Rate limiter — passthrough ────────────────────────────────────────────────
vi.mock("../middlewares/rateLimiter.js", () => ({
  chatRateLimitStore:           { get: vi.fn().mockResolvedValue(null) },
  userKey:                      vi.fn().mockReturnValue("user:99"),
  claimPaymentRateLimiter:      vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  chatMessageRateLimiter:       vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  exumRateLimiter:              vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  createChatMessageRateLimiter: vi.fn(),
  createCompetencyRateLimiter:  vi.fn(),
}));

// ── Email helper — swallow ────────────────────────────────────────────────────
vi.mock("../lib/email.js", () => ({
  sendCreditClaimEmail: vi.fn(),
  sendEmail:            vi.fn(),
}));

// ── App factory ───────────────────────────────────────────────────────────────
async function buildApp() {
  const { default: usersRouter } = await import("../routes/users.js");
  const app = express();
  app.use(express.json());
  app.use("/api", usersRouter);
  return app;
}

// Flush micro-task queue so non-blocking callbacks settle.
const flush = () => new Promise<void>((r) => setTimeout(r, 30));

// ─────────────────────────────────────────────────────────────────────────────

/** Shared payment fixture: unclaimed, status=paid, 10 credits. */
const PAYMENT = {
  id: 7,
  externalId: "ORD-RACE-001",
  customerEmail: "ani@example.com",
  userId: null,
  status: "paid",
  creditsGranted: 10,
};

const BODY = { orderId: "ORD-RACE-001", customerEmail: "ani@example.com" };

// ── Helpers to build fake transaction proxies ─────────────────────────────────
/**
 * Winner transaction: UPDATE returns the claimed row, then the credit
 * increment runs and we track it via `onCreditIncrement`.
 */
function makeWinnerTx(creditsGranted: number, onCreditIncrement: () => void) {
  // tx.update() call #1 → payments update → returns the row
  const paymentsChain: Record<string, unknown> = {};
  paymentsChain["then"] = (resolve: (v: unknown) => void) =>
    Promise.resolve([{ creditsGranted }]).then(resolve);
  for (const m of ["set", "where", "returning"]) {
    paymentsChain[m] = vi.fn().mockReturnValue(paymentsChain);
  }

  // tx.update() call #2 → users credit increment → returns []
  const usersChain: Record<string, unknown> = {};
  usersChain["then"] = (resolve: (v: unknown) => void) => {
    onCreditIncrement();
    return Promise.resolve([]).then(resolve);
  };
  for (const m of ["set", "where"]) {
    usersChain[m] = vi.fn().mockReturnValue(usersChain);
  }

  let callCount = 0;
  return {
    update: vi.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? paymentsChain : usersChain;
    }),
  };
}

/**
 * Loser transaction: UPDATE finds userId already set → returns zero rows →
 * the route calls tx.rollback() which throws to abort.
 */
function makeLoserTx() {
  const paymentsChain: Record<string, unknown> = {};
  paymentsChain["then"] = (resolve: (v: unknown) => void) =>
    // Zero rows: the conditional WHERE isNull(userId) matched nothing.
    Promise.resolve([]).then(resolve);
  for (const m of ["set", "where", "returning"]) {
    paymentsChain[m] = vi.fn().mockReturnValue(paymentsChain);
  }

  return {
    update: vi.fn().mockReturnValue(paymentsChain),
    rollback: vi.fn().mockImplementation(() => {
      // Drizzle's tx.rollback() throws to abort the transaction.
      throw new Error("Transaction rolled back");
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/users/me/claim-payment — concurrent race condition", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    dbQueue.q = [];
    app = await buildApp();
  });

  it("only one of two simultaneous requests succeeds; the other gets 409", async () => {
    const { db } = await import("@workspace/db");

    // Both requests see the same unclaimed payment from the pre-transaction SELECT.
    dbQueue.push([PAYMENT]);  // request 1 SELECT
    dbQueue.push([PAYMENT]);  // request 2 SELECT

    // Post-claim balance query (for the email — only winner triggers this).
    dbQueue.push([{ exumCredits: 10 }]);

    let creditIncrements = 0;

    // First call → winner; second call → loser.
    // We add a small delay to the winner so both transactions are truly
    // in-flight simultaneously when the loser's UPDATE runs.
    let txCallCount = 0;

    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<number>) => {
        const myIndex = ++txCallCount;

        if (myIndex === 1) {
          // Winner: wait briefly so the second request also enters the tx mock
          // before we resolve, simulating true concurrency.
          await new Promise<void>((r) => setTimeout(r, 10));
          return fn(makeWinnerTx(PAYMENT.creditsGranted, () => { creditIncrements++; }));
        } else {
          // Loser: the UPDATE finds zero matching rows → rollback → 409.
          return fn(makeLoserTx());
        }
      }
    );

    // Fire both requests simultaneously.
    const [res1, res2] = await Promise.all([
      request(app).post("/api/users/me/claim-payment").send(BODY),
      request(app).post("/api/users/me/claim-payment").send(BODY),
    ]);

    await flush();

    // Exactly one 200 and one 409.
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = res1.status === 200 ? res1 : res2;
    const loser  = res1.status === 409 ? res1 : res2;

    expect(winner.body.ok).toBe(true);
    expect(winner.body.creditsGranted).toBe(PAYMENT.creditsGranted);

    expect(loser.body.ok).toBeUndefined();
    expect(loser.body.error).toBeTruthy();

    // Credits must be granted exactly once, not twice.
    expect(creditIncrements).toBe(1);
  });

  it("returns 409 immediately when the payment is already claimed by another user (pre-check)", async () => {
    const { db } = await import("@workspace/db");

    // Payment already owned by a different user (userId: 1 ≠ req.dbUser.id: 99).
    dbQueue.push([{ ...PAYMENT, userId: 1 }]);

    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send(BODY);

    expect(res.status).toBe(409);
    // The transaction must never be entered when the pre-check already sees a
    // claimed payment.
    expect((db.transaction as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("returns idempotent 200 when the same user claims the same order again", async () => {
    const { db } = await import("@workspace/db");

    // Payment already owned by the same user (id: 99).
    dbQueue.push([{ ...PAYMENT, userId: 99 }]);

    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send(BODY);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.alreadyClaimed).toBe(true);
    expect(res.body.creditsGranted).toBe(0);
    expect((db.transaction as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});
