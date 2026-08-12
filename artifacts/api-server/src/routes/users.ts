import { Router } from "express";
import { db, users, usageEvents, messages, conversations, payments } from "@workspace/db";
import { eq, and, count, gte, desc, isNull, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { claimPaymentRateLimiter } from "../middlewares/rateLimiter";
import { FREE_EXUM_LIFETIME } from "../lib/plans";
import { sendCreditClaimEmail } from "../lib/email.js";

const router = Router();

router.get("/users/me", requireAuth, async (req, res) => {
  res.json(req.dbUser);
});

// Current Exum credit balance + free-trial status for the authenticated user.
router.get("/users/me/plan", requireAuth, async (req, res) => {
  const u = req.dbUser!;
  const freeExumRemaining = u.freeExumUsed ? 0 : FREE_EXUM_LIFETIME;
  res.json({
    exumCredits: u.exumCredits,
    freeExumUsed: u.freeExumUsed,
    freeExumRemaining,
    canGenerate: u.exumCredits > 0 || freeExumRemaining > 0,
  });
});

/**
 * Returns how many chat messages the user has sent in the last hour,
 * plus the limit for their plan, so the frontend can show a usage indicator.
 *
 * Note: counts outbound user messages in the DB (role='user'), which is a faithful
 * proxy for rate-limiter hits. The in-memory limiter resets independently but the
 * delta is negligible for a progress indicator.
 */
router.get("/users/me/usage", requireAuth, async (req, res) => {
  const userIsProPlan = req.dbUser!.plan === "pro" &&
    (!req.dbUser!.planExpiresAt || new Date(req.dbUser!.planExpiresAt) > new Date());
  const limit = userIsProPlan ? 120 : 30;

  // ── Source of truth: the rate-limiter store ──────────────────────────────────
  // Reading from the same MemoryStore that chatMessageRateLimiter uses guarantees
  // the display counter can never diverge from the counter that controls enforcement
  // (Task #40).  This eliminates the previous dual-counter approach where the DB
  // query counted stored messages while the limiter counted requests — two values
  // that could differ after server restarts, failed requests, or direct DB writes.
  const { chatRateLimitStore, userKey } = await import("../middlewares/rateLimiter");
  const key = userKey(req);
  const storeInfo = await chatRateLimitStore.get(key).catch(() => null);

  const used      = storeInfo?.totalHits ?? 0;
  const remaining = Math.max(0, limit - used);
  // resetTime is the moment the current window expires and the counter resets.
  const resetAt   = storeInfo?.resetTime?.toISOString() ?? null;

  res.json({ used, limit, remaining, resetAt });
});

// Credit balance + purchase history for the authenticated user.
router.get("/users/me/payments", requireAuth, async (req, res) => {
  const uid = req.dbUser!.id;
  const history = await db
    .select({
      id: payments.id,
      provider: payments.provider,
      externalId: payments.externalId,
      customerEmail: payments.customerEmail,
      status: payments.status,
      amount: payments.amount,
      creditsGranted: payments.creditsGranted,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.userId, uid))
    .orderBy(desc(payments.createdAt))
    .limit(50);
  res.json(history);
});

const CLAIM_PAID_STATUSES = new Set([
  "paid", "settlement", "settled", "success", "successful",
  "completed", "complete", "capture", "lunas",
]);

/**
 * POST /users/me/claim-payment
 * Lets a user manually claim a Scalev order whose email didn't match their account.
 *
 * Security controls:
 * 1. claimPaymentRateLimiter — 10 attempts/hour/account prevents brute-force
 *    enumeration of order IDs.
 * 2. customerEmail verification — the caller must supply the email address that
 *    appears on the order record. Only the buyer (who received the Scalev
 *    confirmation email) knows both the orderId AND the exact email used at
 *    checkout. This provides non-enumerable purchaser proof without requiring a
 *    signed receipt.
 * 3. Atomic transaction — the payment userId assignment and the credit increment
 *    happen in a single serializable transaction with a conditional WHERE clause,
 *    so a race between two concurrent claims cannot double-grant or leave the
 *    payment in an inconsistent "assigned but no credits" state.
 */
router.post("/users/me/claim-payment", requireAuth, claimPaymentRateLimiter, async (req, res) => {
  const { orderId, customerEmail } = req.body as { orderId?: string; customerEmail?: string };

  if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
    res.status(400).json({ error: "orderId diperlukan" });
    return;
  }
  if (!customerEmail || typeof customerEmail !== "string" || !customerEmail.trim()) {
    res.status(400).json({ error: "customerEmail diperlukan" });
    return;
  }

  const uid = req.dbUser!.id;
  const trimmedId = orderId.trim();
  const normalizedEmail = customerEmail.trim().toLowerCase();

  // Find the payment by external ID
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.externalId, trimmedId))
    .limit(1);

  // Return the same 404 whether the order doesn't exist OR the email doesn't
  // match — this prevents confirming that a given order ID exists.
  if (!payment || payment.customerEmail.toLowerCase() !== normalizedEmail) {
    res.status(404).json({ error: "Pesanan tidak ditemukan. Pastikan ID pesanan dan email pembelian benar." });
    return;
  }

  // If already assigned to this user, treat as success (idempotent)
  if (payment.userId === uid) {
    res.status(200).json({ ok: true, creditsGranted: 0, alreadyClaimed: true });
    return;
  }

  // Already claimed by another user
  if (payment.userId !== null) {
    res.status(409).json({ error: "Pesanan ini sudah dikaitkan ke akun lain. Hubungi dukungan jika ini adalah kesalahan." });
    return;
  }

  if (!CLAIM_PAID_STATUSES.has(payment.status.toLowerCase())) {
    res.status(400).json({ error: "Pembayaran belum dikonfirmasi. Coba beberapa menit lagi." });
    return;
  }

  // Atomic transaction: assign payment ownership + grant credits in one shot.
  // The WHERE isNull(payments.userId) inside the transaction is the final guard
  // against concurrent claims slipping through after the check above.
  let creditsGranted: number;
  try {
    creditsGranted = await db.transaction(async (tx) => {
      const updated = await tx
        .update(payments)
        .set({ userId: uid })
        .where(and(eq(payments.externalId, trimmedId), isNull(payments.userId)))
        .returning({ creditsGranted: payments.creditsGranted });

      if (updated.length === 0) {
        // Concurrent claim won the race — roll back
        tx.rollback();
        return -1; // unreachable; rollback throws
      }

      const credits = updated[0].creditsGranted;
      await tx
        .update(users)
        .set({ exumCredits: sql`${users.exumCredits} + ${credits}` })
        .where(eq(users.id, uid));

      return credits;
    });
  } catch {
    // rollback() throws to abort — treat as a concurrent claim
    res.status(409).json({ error: "Pesanan ini baru saja diklaim. Refresh halaman untuk melihat saldo terbaru." });
    return;
  }

  req.log.info({ uid, orderId: trimmedId, creditsGranted }, "Manual payment claim succeeded");

  // Non-blocking confirmation email to the claimant.
  // Fetch the post-transaction balance from the DB so the receipt is always
  // accurate even if concurrent credit grants happened in the same window.
  const userEmail = req.dbUser!.email;
  if (userEmail) {
    db.select({ exumCredits: users.exumCredits })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1)
      .then(([row]) => {
        sendCreditClaimEmail({
          to: userEmail,
          orderId: trimmedId,
          creditsGranted,
          newBalance: row?.exumCredits ?? 0,
        });
      })
      .catch((err) =>
        req.log.warn({ err, uid, orderId: trimmedId }, "Failed to fetch post-claim balance for email")
      );
  }

  // Non-blocking push notification to the claimant's device
  const pushToken = req.dbUser!.expoPushToken;
  if (pushToken) {
    fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Encoding": "gzip, deflate" },
      body: JSON.stringify({
        to: pushToken,
        title: "Klaim kredit berhasil! 🎉",
        body: `${creditsGranted} kredit Exum telah ditambahkan ke akun Anda.`,
        channelId: "payments",
      }),
    }).catch((err) => req.log.warn({ err, orderId: trimmedId }, "Failed to send claim push notification"));
  }

  res.json({ ok: true, creditsGranted });
});

router.patch("/users/me/role", requireAuth, async (req, res) => {
  const { role } = req.body as { role: string };
  const allowed = ["user", "instruktur", "lembaga_diklat"];
  if (!allowed.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const [updated] = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, req.dbUser!.id))
    .returning();
  res.json(updated);
});

// Save the Expo push token for this device so the server can send notifications.
router.post("/users/me/push-token", requireAuth, async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token required" });
    return;
  }
  await db.update(users).set({ expoPushToken: token }).where(eq(users.id, req.dbUser!.id));
  res.json({ ok: true });
});

router.get("/users", requireAuth, requireRole("admin"), async (_req, res) => {
  const all = await db.select().from(users).orderBy(users.createdAt);
  res.json(all);
});

router.patch("/users/:id/role", requireAuth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body as { role: string };
  const allowed = ["user", "instruktur", "lembaga_diklat", "askom", "admin"];
  if (!allowed.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const [updated] = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(updated);
});

export default router;
