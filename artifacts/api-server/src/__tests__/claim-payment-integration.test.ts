/**
 * Integration tests: POST /users/me/claim-payment — real-database correctness
 *
 * Uses the real PostgreSQL database (same DATABASE_URL as dev/prod) so tests
 * exercise actual SQL transaction isolation and the conditional
 * UPDATE … WHERE userId IS NULL guard — not scripted mocks.
 *
 * Race-condition strategy (barrier pattern):
 *   1. A test-controlled client acquires SELECT … FOR UPDATE on the payment row.
 *   2. Two simultaneous HTTP requests are fired.  Both complete their SELECT
 *      phase (plain SELECTs are not blocked by row locks in READ COMMITTED),
 *      then both enter db.transaction() and issue UPDATE … WHERE userId IS NULL.
 *   3. Both UPDATEs block, waiting for the external row lock.
 *   4. The external lock is released (COMMIT).
 *   5. Both UPDATEs race: one acquires the lock and wins (1 row); the other
 *      acquires it after the first commits and finds userId ≠ NULL → 0 rows.
 *   6. The loser's transaction rolls back → route returns 409.
 *
 * Test data is cleaned up in afterEach regardless of outcome.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db, pool, users, payments } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Shared mutable slot so the hoisted auth mock can read the current user ────
const testUserSlot = vi.hoisted(() => ({
  user: null as null | typeof users.$inferSelect,
}));

// ── Auth mock — inject the real DB user row without Clerk ─────────────────────
// @workspace/db is intentionally NOT mocked; the route uses the real database.
vi.mock("../middlewares/auth.js", () => ({
  requireAuth: vi.fn((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!testUserSlot.user) {
      res.status(500).json({ error: "Test setup error: no user in slot" });
      return;
    }
    req.dbUser = testUserSlot.user;
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    next();
  }),
  requireRole: vi.fn(() => (
    _req: express.Request, _res: express.Response, next: express.NextFunction
  ) => next()),
}));

// ── Swallow email / push so no external calls leave the test ──────────────────
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

const flush = () => new Promise<void>((r) => setTimeout(r, 60));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Unique identifiers per test run so rows never collide with real data ──────
const RUN_ID        = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const TEST_CLERK_ID = `test-race-clerk-${RUN_ID}`;
const ORDER_ID      = `TEST-RACE-${RUN_ID}`;
const CREDITS       = 10;

let testUserId    = 0;
let testPaymentId = 0;

// ── Seed / cleanup helpers ────────────────────────────────────────────────────

async function seedTestData() {
  const [user] = await db
    .insert(users)
    .values({
      clerkId:     TEST_CLERK_ID,
      role:        "user",
      name:        "Race Test User",
      email:       "race@test.example",
      exumCredits: 0,
    })
    .returning();
  testUserId = user.id;
  testUserSlot.user = user;

  // Insert with defaults, then set creditsGranted in a separate update to
  // avoid the TypeScript overload resolution issue with the insert type.
  const [payment] = await db
    .insert(payments)
    .values({
      externalId:    ORDER_ID,
      customerEmail: "race@test.example",
      status:        "paid",
      provider:      "scalev",
      amount:        100000,
      // userId intentionally omitted → NULL (unclaimed)
    })
    .returning();
  testPaymentId = payment.id;

  // Set creditsGranted via raw SQL — the drizzle update type omits this
  // column due to a TypeScript project-references resolution mismatch, but
  // the column exists in the database and the route reads it correctly.
  await pool.query(
    "UPDATE payments SET credits_granted = $1 WHERE id = $2",
    [CREDITS, testPaymentId],
  );
}

async function cleanTestData() {
  if (testPaymentId) {
    // Unassign first so the FK constraint doesn't block user deletion.
    await db.update(payments).set({ userId: null }).where(eq(payments.id, testPaymentId));
    await db.delete(payments).where(eq(payments.id, testPaymentId));
    testPaymentId = 0;
  }
  if (testUserId) {
    await db.delete(users).where(eq(users.id, testUserId));
    testUserId = 0;
    testUserSlot.user = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite: concurrent HTTP requests with a row-lock barrier
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/users/me/claim-payment — real-DB concurrent HTTP integration", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await seedTestData();
  });

  afterEach(async () => {
    await cleanTestData();
  });

  // ── Core race-condition test ─────────────────────────────────────────────────

  it("two simultaneous requests: exactly one wins (200), one loses (409); credits granted once", async () => {
    // ── Step 1: acquire an external row lock on the payment ─────────────────
    // The route's UPDATE … WHERE userId IS NULL will block until this lock
    // is released, giving us a guaranteed window where both requests are
    // in-flight simultaneously inside their transactions.
    const lockClient = await pool.connect();
    await lockClient.query("BEGIN");
    await lockClient.query(
      "SELECT id FROM payments WHERE external_id = $1 FOR UPDATE",
      [ORDER_ID],
    );

    const BODY = { orderId: ORDER_ID, customerEmail: "race@test.example" };

    // ── Step 2: fire both requests; they will block on the locked row ────────
    // Both requests will:
    //   • Complete their SELECT payment (plain SELECTs are not blocked)
    //   • Enter db.transaction()
    //   • Issue UPDATE … WHERE userId IS NULL → BLOCKS here
    const bothRequests = Promise.all([
      request(app).post("/api/users/me/claim-payment").send(BODY),
      request(app).post("/api/users/me/claim-payment").send(BODY),
    ]);

    // ── Step 3: wait for both to reach their blocked UPDATE statements ────────
    // 150 ms is far more than a local SELECT + transaction-start round-trip.
    await sleep(150);

    // ── Step 4: release the lock — both UPDATEs now race ────────────────────
    await lockClient.query("COMMIT");
    lockClient.release();

    // ── Step 5: collect responses ────────────────────────────────────────────
    const [res1, res2] = await bothRequests;
    await flush();

    // ── HTTP response assertions ──────────────────────────────────────────────
    const statuses = [res1.status, res2.status].sort();
    expect(
      statuses,
      `expected [200, 409] but got [${statuses}] — both requests may have completed before the barrier was lifted`,
    ).toEqual([200, 409]);

    const winner = res1.status === 200 ? res1 : res2;
    const loser  = res1.status === 409 ? res1 : res2;

    expect(winner.body.ok).toBe(true);
    expect(winner.body.creditsGranted).toBe(CREDITS);
    expect(loser.body.error).toBeTruthy();

    // ── Persisted DB state assertions ─────────────────────────────────────────
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, testPaymentId));

    expect(
      payment.userId,
      "payment must be assigned to the test user after a successful claim",
    ).toBe(testUserId);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId));

    expect(
      user.exumCredits,
      "exumCredits must equal exactly CREDITS — not 0 (claim failed) and not 2×CREDITS (double-grant)",
    ).toBe(CREDITS);
  });

  // ── Supporting route-behavior tests ──────────────────────────────────────────

  it("successful claim persists correct DB state: payment assigned and credits granted", async () => {
    const res = await request(app)
      .post("/api/users/me/claim-payment")
      .send({ orderId: ORDER_ID, customerEmail: "race@test.example" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.creditsGranted).toBe(CREDITS);

    await flush();

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, testPaymentId));
    expect(payment.userId).toBe(testUserId);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId));
    expect(user.exumCredits).toBe(CREDITS);
  });

  it("second claim by the same user is idempotent: 200 alreadyClaimed, no double-grant", async () => {
    const BODY = { orderId: ORDER_ID, customerEmail: "race@test.example" };

    const res1 = await request(app).post("/api/users/me/claim-payment").send(BODY);
    expect(res1.status).toBe(200);
    expect(res1.body.creditsGranted).toBe(CREDITS);

    const res2 = await request(app).post("/api/users/me/claim-payment").send(BODY);
    expect(res2.status).toBe(200);
    expect(res2.body.alreadyClaimed).toBe(true);
    expect(res2.body.creditsGranted).toBe(0);

    await flush();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId));
    expect(user.exumCredits, "credits must not be granted twice").toBe(CREDITS);
  });

  it("returns 409 when payment is pre-assigned to a different user; credits left untouched", async () => {
    const [otherUser] = await db
      .insert(users)
      .values({
        clerkId:     `other-clerk-${RUN_ID}`,
        role:        "user",
        name:        "Other User",
        email:       "other@test.example",
        exumCredits: 0,
      })
      .returning();

    try {
      await db
        .update(payments)
        .set({ userId: otherUser.id })
        .where(eq(payments.id, testPaymentId));

      const res = await request(app)
        .post("/api/users/me/claim-payment")
        .send({ orderId: ORDER_ID, customerEmail: "race@test.example" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeTruthy();

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, testUserId));
      expect(user.exumCredits, "credits must remain 0 when blocked by another user's claim").toBe(0);
    } finally {
      // Unassign before deleting to satisfy FK constraint
      await db.update(payments).set({ userId: null }).where(eq(payments.id, testPaymentId));
      await db.delete(users).where(eq(users.id, otherUser.id));
    }
  });
});
