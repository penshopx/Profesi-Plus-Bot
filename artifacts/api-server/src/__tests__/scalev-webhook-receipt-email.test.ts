/**
 * Scalev webhook receipt email test (#170)
 *
 * The receipt email send is fire-and-forget; a refactor could silently drop
 * the call without any test failing. This suite verifies:
 *
 *   1. Happy path — after a successful credit grant, `sendCreditClaimEmail`
 *      is called exactly once with the buyer's email, orderId, credit count,
 *      the freshly-fetched balance, and reason "purchase".
 *   2. Duplicate delivery — the email must NOT fire.
 *   3. No matching user (payment stored for manual claim) — no email.
 *   4. Balance-fetch failure — the response still succeeds; no email fires.
 */

import crypto from "node:crypto";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── DB mock ──────────────────────────────────────────────────────────────────
// Each top-level db.select() call pops the next staged value from the queue.
// Staged values may be arrays (resolved) or Error instances (rejected).
const dbQueue = vi.hoisted(() => ({
  q: [] as unknown[],
  push(...items: unknown[]) { this.q.push(...items); },
  shift(): unknown { return this.q.shift() ?? []; },
}));

vi.mock("@workspace/db", () => {
  function makeChain() {
    const obj: Record<string, unknown> = {};
    obj["then"] = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const next = dbQueue.shift();
      if (next instanceof Error) return Promise.reject(next).then(resolve, reject);
      return Promise.resolve(next).then(resolve, reject);
    };
    obj["catch"] = (cb: (e: unknown) => unknown) =>
      (obj["then"] as (r: (v: unknown) => void, j?: (e: unknown) => void) => Promise<unknown>)(
        (v) => v,
        cb,
      );
    for (const m of ["select", "from", "where", "limit", "update", "set",
                     "returning", "orderBy", "insert", "values", "delete"]) {
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
    users:    { id: "id", email: "email", exumCredits: "exumCredits", expoPushToken: "expoPushToken" },
    payments: {
      id: "id", externalId: "externalId", userId: "userId",
      status: "status", amount: "amount", creditsGranted: "creditsGranted",
      customerEmail: "customerEmail", provider: "provider", raw: "raw",
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq:  vi.fn().mockReturnValue({}),
  asc: vi.fn().mockReturnValue({}),
  sql: vi.fn().mockReturnValue({}),
  and: vi.fn().mockReturnValue({}),
}));

vi.mock("../lib/email.js", () => ({
  sendCreditClaimEmail: vi.fn(),
  sendEmail:            vi.fn(),
}));

vi.mock("../lib/push.js", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = "test-webhook-secret-for-receipt-email";

async function buildApp() {
  process.env.SCALEV_WEBHOOK_SECRET = SECRET;

  const { default: scalevRouter } = await import("../routes/webhooks/scalev.js");
  const app = express();

  app.use(
    express.json({
      verify: (req: Request, _res: Response, buf: Buffer) => {
        (req as unknown as { rawBody: Buffer }).rawBody = buf;
      },
    }),
  );

  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { log: Record<string, unknown> }).log = {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    };
    next();
  });

  app.use("/api", scalevRouter);
  return app;
}

function sign(body: string): string {
  return crypto.createHmac("sha512", SECRET).update(Buffer.from(body)).digest("hex");
}

async function postWebhook(app: express.Express, payload: object) {
  const body = JSON.stringify(payload);
  return request(app)
    .post("/api/webhooks/scalev")
    .set("Content-Type", "application/json")
    .set("x-scalev-signature", sign(body))
    .send(body);
}

/** The email send is fire-and-forget (a floating promise chain fired after the
 *  response is committed) — flush microtasks + a macrotask so it settles. */
async function flushAsync() {
  await new Promise<void>((r) => setTimeout(r, 20));
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PAYLOAD = {
  data: {
    order: {
      order_id: "ORD-EMAIL-001",
      status:   "paid",
      quantity: 3,
      amount:   500_000,
      customer: { email: "budi@example.com" },
    },
  },
};

const MATCHED_USER = { id: 42, email: "budi@example.com", expoPushToken: null };

// ─── Transaction builders ─────────────────────────────────────────────────────

/** Fresh-insert transaction: insert returns one row, credit UPDATE runs. */
function makeFirstDeliveryTx() {
  const insertChain: Record<string, unknown> = {};
  insertChain["then"] = (resolve: (v: unknown) => void) =>
    Promise.resolve([{ id: 1 }]).then(resolve);
  for (const m of ["values", "onConflictDoNothing", "returning"]) {
    insertChain[m] = vi.fn().mockReturnValue(insertChain);
  }

  const updateChain: Record<string, unknown> = {};
  updateChain["then"] = (resolve: (v: unknown) => void) =>
    Promise.resolve([]).then(resolve);
  for (const m of ["set", "where"]) {
    updateChain[m] = vi.fn().mockReturnValue(updateChain);
  }

  return {
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
  };
}

/** Duplicate-delivery transaction: insert returns zero rows (conflict). */
function makeDuplicateDeliveryTx() {
  const insertChain: Record<string, unknown> = {};
  insertChain["then"] = (resolve: (v: unknown) => void) =>
    Promise.resolve([]).then(resolve);
  for (const m of ["values", "onConflictDoNothing", "returning"]) {
    insertChain[m] = vi.fn().mockReturnValue(insertChain);
  }
  return {
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Scalev webhook — receipt email on credit grant (#170)", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    dbQueue.q = [];
    app = await buildApp();
  });

  afterEach(() => {
    delete process.env.SCALEV_WEBHOOK_SECRET;
  });

  it("sends the receipt email exactly once after a successful credit grant", async () => {
    const { db } = await import("@workspace/db");
    const { sendCreditClaimEmail } = await import("../lib/email.js");

    // 1) user lookup by email, 2) post-grant balance fetch for the email
    dbQueue.push([MATCHED_USER]);
    dbQueue.push([{ exumCredits: 14 }]);

    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<void>) => fn(makeFirstDeliveryTx()),
    );

    const res = await postWebhook(app, PAYLOAD);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, credited: true, quantity: 3 });

    await flushAsync();

    expect(sendCreditClaimEmail).toHaveBeenCalledTimes(1);
    expect(sendCreditClaimEmail).toHaveBeenCalledWith({
      to: "budi@example.com",
      orderId: "ORD-EMAIL-001",
      creditsGranted: 3,
      newBalance: 14,
      reason: "purchase",
    });
  });

  it("does NOT send the email on a duplicate delivery", async () => {
    const { db } = await import("@workspace/db");
    const { sendCreditClaimEmail } = await import("../lib/email.js");

    dbQueue.push([MATCHED_USER]);

    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<void>) => fn(makeDuplicateDeliveryTx()),
    );

    const res = await postWebhook(app, PAYLOAD);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, duplicate: true });

    await flushAsync();

    expect(sendCreditClaimEmail).not.toHaveBeenCalled();
  });

  it("does NOT send the email when no user matches the buyer email", async () => {
    const { db } = await import("@workspace/db");
    const { sendCreditClaimEmail } = await import("../lib/email.js");

    // User lookup returns no rows → payment stored for manual claim, credited=false
    dbQueue.push([]);

    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<void>) => fn(makeFirstDeliveryTx()),
    );

    const res = await postWebhook(app, PAYLOAD);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, credited: false });

    await flushAsync();

    expect(sendCreditClaimEmail).not.toHaveBeenCalled();
  });

  it("still returns 200 and skips the email when the balance fetch fails", async () => {
    const { db } = await import("@workspace/db");
    const { sendCreditClaimEmail } = await import("../lib/email.js");

    dbQueue.push([MATCHED_USER]);
    dbQueue.push(new Error("balance query failed"));

    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<void>) => fn(makeFirstDeliveryTx()),
    );

    const res = await postWebhook(app, PAYLOAD);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, credited: true });

    await flushAsync();

    expect(sendCreditClaimEmail).not.toHaveBeenCalled();
  });
});
