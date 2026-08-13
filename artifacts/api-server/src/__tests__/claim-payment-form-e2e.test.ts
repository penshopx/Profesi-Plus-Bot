/**
 * End-to-end form scenario tests: POST /users/me/claim-payment
 *
 * Covers the two scenarios from Task #83 that were not tested elsewhere:
 *
 * 1. Happy path — valid orderId + matching email:
 *    → 200 { ok: true, creditsGranted: N }
 *    → The ClaimCard shows the success banner and triggers a balance refresh.
 *
 * 2. Wrong email — orderId exists but email doesn't match:
 *    → 404 with a human-readable Indonesian error message
 *    → The ClaimCard renders the red error banner with that message.
 *
 * Also covers:
 * - Non-existent orderId → same 404 (prevents order enumeration)
 * - Missing orderId / email → 400 validation errors
 * - Unpaid order → 400 "Pembayaran belum dikonfirmasi"
 *
 * The mobile claimPayment() function (lib/api.ts) throws an Error whose
 * `.message` is the JSON `error` field from the response. Tests below verify
 * the exact strings so we know the ClaimCard's {errMsg} state will show
 * meaningful text to the user.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB queue — each awaitable DB call pops the next enqueued value ─────────────
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
    for (const m of [
      "select", "from", "where", "limit", "update", "set",
      "returning", "orderBy", "insert", "delete",
    ]) {
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
    payments:      {
      id: "id", externalId: "externalId", customerEmail: "customerEmail",
      userId: "userId", status: "status", creditsGranted: "creditsGranted",
    },
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
      id: 55,
      email: "tono@example.com",
      name: "Tono Wibowo",
      plan: null,
      planExpiresAt: null,
      exumCredits: 2,
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

// ── Rate limiter — passthrough in tests ────────────────────────────────────────
vi.mock("../middlewares/rateLimiter.js", () => ({
  chatRateLimitStore:           { get: vi.fn().mockResolvedValue(null) },
  userKey:                      vi.fn().mockReturnValue("user:55"),
  claimPaymentRateLimiter:      vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  chatMessageRateLimiter:       vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  exumRateLimiter:              vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  createChatMessageRateLimiter: vi.fn(),
  createCompetencyRateLimiter:  vi.fn(),
}));

// ── Email / push — swallow side-effects ───────────────────────────────────────
vi.mock("../lib/email.js", () => ({
  sendCreditClaimEmail: vi.fn(),
  sendEmail:            vi.fn(),
}));

// push helper is imported dynamically inside the route; mock it here.
vi.mock("../lib/push.js", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

// ── App factory ───────────────────────────────────────────────────────────────
async function buildApp() {
  const { default: usersRouter } = await import("../routes/users.js");
  const app = express();
  app.use(express.json());
  app.use("/api", usersRouter);
  return app;
}

/** Flush micro-task queue so fire-and-forget callbacks complete. */
const flush = () => new Promise<void>((r) => setTimeout(r, 30));

// ── Reusable payment fixtures ─────────────────────────────────────────────────

/** An unclaimed, paid order belonging to the authenticated user's email. */
const PAID_PAYMENT = {
  id:            1,
  externalId:    "INV-20240812-001",
  customerEmail: "tono@example.com",
  userId:        null,
  status:        "paid",
  creditsGranted: 3,
};

/** Same order, but with a different checkout email. */
const DIFFERENT_EMAIL_PAYMENT = {
  ...PAID_PAYMENT,
  customerEmail: "someoneelse@example.com",
};

// Fake transaction that successfully claims PAID_PAYMENT
function makeSuccessTx(creditsGranted: number) {
  const paymentsChain: Record<string, unknown> = {};
  paymentsChain["then"] = (resolve: (v: unknown) => void) =>
    Promise.resolve([{ creditsGranted }]).then(resolve);
  for (const m of ["set", "where", "returning"]) {
    paymentsChain[m] = vi.fn().mockReturnValue(paymentsChain);
  }

  const usersChain: Record<string, unknown> = {};
  usersChain["then"] = (resolve: (v: unknown) => void) =>
    Promise.resolve([]).then(resolve);
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

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 — Happy path: valid orderId + matching email
// Simulates: user enters correct details → success banner + balance increment
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/users/me/claim-payment — happy path (success banner scenario)", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    dbQueue.q = [];
    app = await buildApp();
  });

  it("returns 200 { ok: true, creditsGranted } when orderId and email both match", async () => {
    const { db } = await import("@workspace/db");

    // Pre-transaction SELECT finds the unclaimed paid order
    dbQueue.push([PAID_PAYMENT]);
    // Post-transaction balance fetch (for email receipt)
    dbQueue.push([{ exumCredits: 5 }]);

    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (tx: unknown) => Promise<number>) =>
        fn(makeSuccessTx(PAID_PAYMENT.creditsGranted)),
    );

    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "INV-20240812-001", customerEmail: "tono@example.com" });

    // The mobile ClaimCard checks res.ok === true to show the success banner.
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // The success banner reads: "{creditsGranted} kredit Exum ditambahkan"
    expect(res.body.creditsGranted).toBe(PAID_PAYMENT.creditsGranted);
    expect(typeof res.body.creditsGranted).toBe("number");

    // alreadyClaimed must be absent (or falsy) so the green banner — not the
    // blue "sudah dikreditkan" banner — is shown.
    expect(res.body.alreadyClaimed).toBeFalsy();
  });

  it("response shape matches what claimPayment() in api.ts expects", async () => {
    // api.ts claimPayment() checks response.ok then calls response.json().
    // The resulting object drives the ClaimCard's `result` state:
    //   { ok: boolean; creditsGranted: number; alreadyClaimed?: boolean }
    const { db } = await import("@workspace/db");

    dbQueue.push([PAID_PAYMENT]);
    dbQueue.push([{ exumCredits: 5 }]);

    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (tx: unknown) => Promise<number>) =>
        fn(makeSuccessTx(PAID_PAYMENT.creditsGranted)),
    );

    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "INV-20240812-001", customerEmail: "tono@example.com" });

    await flush();

    // These three fields are the complete contract with the mobile client.
    const body = res.body as { ok: boolean; creditsGranted: number; alreadyClaimed?: boolean };
    expect(body.ok).toBe(true);
    expect(body.creditsGranted).toBeGreaterThan(0);
    // alreadyClaimed is omitted on first claim (not false — just absent)
    expect(body.alreadyClaimed).toBeUndefined();
  });

  it("returns 200 alreadyClaimed when the same user reclaims their own order", async () => {
    // ClaimCard renders the blue "sudah dikreditkan" banner in this case.
    dbQueue.push([{ ...PAID_PAYMENT, userId: 55 }]);

    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "INV-20240812-001", customerEmail: "tono@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.alreadyClaimed).toBe(true);
    expect(res.body.creditsGranted).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 — Wrong email: 404 error message displayed in the red banner
// Simulates: user types the wrong checkout email → red error banner
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/users/me/claim-payment — wrong email (error banner scenario)", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    dbQueue.q = [];
    app = await buildApp();
  });

  it("returns 404 when the order exists but the email doesn't match", async () => {
    // The route returns the same 404 whether the order is missing or the email
    // is wrong — this prevents confirming that a given order ID exists.
    dbQueue.push([DIFFERENT_EMAIL_PAYMENT]);

    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "INV-20240812-001", customerEmail: "tono@example.com" });

    expect(res.status).toBe(404);

    // The error message is what the mobile ClaimCard displays in the red banner.
    // It must be present and user-readable (Indonesian).
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);

    // Confirm the message guides the user to double-check their inputs —
    // it should mention "ID pesanan" and "email" so they know what to fix.
    expect(res.body.error).toMatch(/ID pesanan/i);
    expect(res.body.error).toMatch(/email/i);
  });

  it("returns 404 when the orderId does not exist at all", async () => {
    // Non-existent order: DB returns an empty array from the SELECT.
    dbQueue.push([]);  // empty result = order not found

    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "NONEXISTENT-ORDER", customerEmail: "tono@example.com" });

    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it("does NOT reveal whether the order ID exists (same 404 for both cases)", async () => {
    // Security: the wrong-email 404 and not-found 404 must return the same
    // error message so an attacker cannot enumerate valid order IDs.
    dbQueue.push([DIFFERENT_EMAIL_PAYMENT]);
    const wrongEmailRes = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "INV-20240812-001", customerEmail: "tono@example.com" });

    dbQueue.push([]);
    const notFoundRes = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "NONEXISTENT-ORDER", customerEmail: "tono@example.com" });

    expect(wrongEmailRes.status).toBe(404);
    expect(notFoundRes.status).toBe(404);
    // The error messages must be identical strings.
    expect(wrongEmailRes.body.error).toBe(notFoundRes.body.error);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 — Input validation: missing or empty fields
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/users/me/claim-payment — input validation", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    dbQueue.q = [];
    app = await buildApp();
  });

  it("returns 400 when orderId is missing", async () => {
    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ customerEmail: "tono@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("returns 400 when customerEmail is missing", async () => {
    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "INV-20240812-001" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("returns 400 when orderId is whitespace-only", async () => {
    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "   ", customerEmail: "tono@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("returns 400 when payment status is not a confirmed-paid status", async () => {
    // A pending payment should not grant credits — the user must wait.
    dbQueue.push([{ ...PAID_PAYMENT, status: "pending" }]);

    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "INV-20240812-001", customerEmail: "tono@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/belum dikonfirmasi/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4 — Mobile client contract: claimPayment() error propagation
//
// The ClaimCard's onError handler receives err.message as errMsg — so we
// verify the route's error field is the exact string that will appear in the
// red banner.
// ─────────────────────────────────────────────────────────────────────────────

describe("mobile claimPayment() error propagation contract", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    dbQueue.q = [];
    app = await buildApp();
  });

  it("404 error field matches what api.ts throws as err.message", async () => {
    // The mobile api.ts claimPayment() does:
    //   throw new Error((body as { error?: string }).error ?? 'Gagal klaim pesanan')
    // So err.message === res.body.error.
    // The ClaimCard's onError sets errMsg = err.message and renders it.
    dbQueue.push([]);  // not found

    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "BAD-ORDER", customerEmail: "tono@example.com" });

    expect(res.status).toBe(404);

    // This string will be rendered verbatim in the red error banner.
    const errorMessage = res.body.error as string;
    expect(errorMessage).toBeTruthy();

    // Must not be a raw JSON dump, a stack trace, or an HTTP status code.
    expect(errorMessage).not.toMatch(/^\d{3}$/);  // not a bare status code
    expect(errorMessage).not.toMatch(/Error:/);   // not a JS error string
    expect(errorMessage).not.toMatch(/"error":/); // not raw JSON

    // Should be a complete Indonesian sentence that users can understand.
    expect(errorMessage.split(" ").length).toBeGreaterThanOrEqual(4);
  });

  it("409 error field is also a human-readable string for the error banner", async () => {
    // Payment already claimed by a different user → 409
    dbQueue.push([{ ...PAID_PAYMENT, userId: 99 }]);  // different user

    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: "INV-20240812-001", customerEmail: "tono@example.com" });

    expect(res.status).toBe(409);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.split(" ").length).toBeGreaterThanOrEqual(4);
  });
});
