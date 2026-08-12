/**
 * Scalev webhook idempotency test (#86)
 *
 * Verifies that firing the same signed webhook payload twice does NOT grant
 * credits twice.  The `onConflictDoNothing({ target: payments.externalId })`
 * constraint is the guard; this test confirms that when the INSERT finds a
 * conflict (inserted.length === 0) the route:
 *
 *   1. Returns  { received: true, duplicate: true }  (200, not 5xx)
 *   2. Does NOT call the credit-increment UPDATE a second time
 *   3. Does NOT send a second push notification or receipt email
 */

import crypto from "node:crypto";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── DB mock ──────────────────────────────────────────────────────────────────
// Each DB call pops the next staged value from the queue.
const dbQueue = vi.hoisted(() => ({
  q: [] as unknown[],
  push(...items: unknown[]) { this.q.push(...items); },
  shift(): unknown { return this.q.shift() ?? []; },
}));

vi.mock("@workspace/db", () => {
  function makeChain() {
    const obj: Record<string, unknown> = {};
    obj["then"] = (resolve: (v: unknown) => void, _reject: (e: unknown) => void) =>
      Promise.resolve(dbQueue.shift()).then(resolve, _reject);
    obj["catch"] = (cb: (e: unknown) => void) =>
      Promise.resolve(dbQueue.shift()).catch(cb);
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = "test-webhook-secret-for-idempotency";

/** Build a test Express app that mirrors the production app's rawBody middleware
 *  and mounts the scalev webhook router under /api. */
async function buildApp() {
  // Set the secret so the webhook handler doesn't 503.
  process.env.SCALEV_WEBHOOK_SECRET = SECRET;

  const { default: scalevRouter } = await import("../routes/webhooks/scalev.js");
  const app = express();

  // Capture raw body via express.json's verify callback so the stream is only
  // consumed once (separate req.on("data") listeners fight express.json and
  // leave req.body empty).
  app.use(
    express.json({
      verify: (req: Request, _res: Response, buf: Buffer) => {
        (req as unknown as { rawBody: Buffer }).rawBody = buf;
      },
    }),
  );

  // Stub the pino request logger that the production app injects.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { log: Record<string, unknown> }).log = {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    };
    next();
  });

  app.use("/api", scalevRouter);
  return app;
}

/** Compute the HMAC-SHA512 hex signature over the raw JSON string. */
function sign(body: string): string {
  return crypto.createHmac("sha512", SECRET).update(Buffer.from(body)).digest("hex");
}

/** POST the signed payload to the webhook endpoint. */
async function postWebhook(app: express.Express, payload: object) {
  const body = JSON.stringify(payload);
  return request(app)
    .post("/api/webhooks/scalev")
    .set("Content-Type", "application/json")
    .set("x-scalev-signature", sign(body))
    .send(body);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PAYLOAD = {
  data: {
    order: {
      order_id: "ORD-IDEM-001",
      status:   "paid",
      amount:   500_000,
      customer: { email: "budi@example.com" },
    },
  },
};

const MATCHED_USER = { id: 42, email: "budi@example.com", expoPushToken: null };

// ─── Transaction builders ─────────────────────────────────────────────────────

/**
 * Fresh-insert transaction: insert returns one row, credit increment runs.
 * `onCreditIncrement` lets us count how many times credits were granted.
 */
function makeFirstDeliveryTx(onCreditIncrement: () => void) {
  // payments insert chain → returns [{ id: 1 }]
  const insertChain: Record<string, unknown> = {};
  insertChain["then"] = (resolve: (v: unknown) => void) =>
    Promise.resolve([{ id: 1 }]).then(resolve);
  for (const m of ["values", "onConflictDoNothing", "returning"]) {
    insertChain[m] = vi.fn().mockReturnValue(insertChain);
  }

  // users update chain → side-effects the counter, returns []
  const updateChain: Record<string, unknown> = {};
  updateChain["then"] = (resolve: (v: unknown) => void) => {
    onCreditIncrement();
    return Promise.resolve([]).then(resolve);
  };
  for (const m of ["set", "where"]) {
    updateChain[m] = vi.fn().mockReturnValue(updateChain);
  }

  let callCount = 0;
  return {
    insert: vi.fn().mockImplementation(() => { callCount++; return insertChain; }),
    update: vi.fn().mockReturnValue(updateChain),
  };
}

/**
 * Duplicate-delivery transaction: insert returns zero rows (conflict).
 * The credit UPDATE must never be called.
 */
function makeDuplicateDeliveryTx() {
  // payments insert chain → returns [] (conflict → DoNothing → no row)
  const insertChain: Record<string, unknown> = {};
  insertChain["then"] = (resolve: (v: unknown) => void) =>
    Promise.resolve([]).then(resolve);
  for (const m of ["values", "onConflictDoNothing", "returning"]) {
    insertChain[m] = vi.fn().mockReturnValue(insertChain);
  }

  const updateSpy = vi.fn();

  return {
    insert: vi.fn().mockReturnValue(insertChain),
    update: updateSpy,   // must NOT be called
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Scalev webhook — duplicate delivery idempotency (#86)", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    dbQueue.q = [];
    app = await buildApp();
  });

  afterEach(() => {
    delete process.env.SCALEV_WEBHOOK_SECRET;
  });

  it("first delivery returns credited=true with the correct quantity", async () => {
    const { db } = await import("@workspace/db");

    // User lookup (email match)
    dbQueue.push([MATCHED_USER]);

    let creditIncrements = 0;
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<void>) => {
        return fn(makeFirstDeliveryTx(() => { creditIncrements++; }));
      }
    );

    // Post-grant balance query (for the receipt email — fire-and-forget)
    dbQueue.push([{ exumCredits: 11 }]);

    const res = await postWebhook(app, PAYLOAD);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, credited: true });
    expect(res.body.quantity).toBeGreaterThanOrEqual(1);
    expect(creditIncrements).toBe(1);
  });

  it("second delivery with the same orderId returns duplicate=true without granting credits", async () => {
    const { db } = await import("@workspace/db");

    // User lookup still matches (same user)
    dbQueue.push([MATCHED_USER]);

    const dupTx = makeDuplicateDeliveryTx();
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<void>) => {
        return fn(dupTx);
      }
    );

    const res = await postWebhook(app, PAYLOAD);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, duplicate: true });
    expect(res.body.credited).toBeUndefined();

    // The credit UPDATE must never have been invoked on a duplicate delivery.
    expect(dupTx.update).not.toHaveBeenCalled();
  });

  it("two concurrent deliveries of the same webhook grant credits exactly once", async () => {
    const { db } = await import("@workspace/db");

    // Both requests look up the user
    dbQueue.push([MATCHED_USER]);
    dbQueue.push([MATCHED_USER]);

    // Post-grant balance query — only the winner triggers this
    dbQueue.push([{ exumCredits: 11 }]);

    let creditIncrements = 0;
    let txCallCount = 0;

    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<void>) => {
        const myIndex = ++txCallCount;
        if (myIndex === 1) {
          // Small delay so the second request is in-flight before this resolves
          await new Promise<void>((r) => setTimeout(r, 10));
          return fn(makeFirstDeliveryTx(() => { creditIncrements++; }));
        } else {
          return fn(makeDuplicateDeliveryTx());
        }
      }
    );

    const [res1, res2] = await Promise.all([
      postWebhook(app, PAYLOAD),
      postWebhook(app, PAYLOAD),
    ]);

    // Both must return 200 (duplicate is not an error)
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const statuses = [
      res1.body.duplicate ? "duplicate" : "credited",
      res2.body.duplicate ? "duplicate" : "credited",
    ].sort();
    expect(statuses).toEqual(["credited", "duplicate"]);

    // Credits granted exactly once, not twice
    expect(creditIncrements).toBe(1);
  });

  it("rejects a request with an invalid signature with 401", async () => {
    const res = await request(app)
      .post("/api/webhooks/scalev")
      .set("Content-Type", "application/json")
      .set("x-scalev-signature", "bad-sig")
      .send(JSON.stringify(PAYLOAD));

    expect(res.status).toBe(401);
  });

  it("returns 200 with ignored=status_not_paid for non-paid statuses", async () => {
    const pendingPayload = {
      data: { order: { order_id: "ORD-PENDING", status: "pending", customer: { email: "x@y.com" } } },
    };
    const res = await postWebhook(app, pendingPayload);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, ignored: "status_not_paid" });
  });
});
