import { Router } from "express";
import { db, users, usageEvents, messages, conversations, payments } from "@workspace/db";
import { eq, and, count, gte, desc, isNull, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { claimPaymentRateLimiter, isPro } from "../middlewares/rateLimiter";
import { FREE_EXUM_LIFETIME } from "../lib/plans";
import { sendCreditClaimEmail } from "../lib/email.js";
import { sendPushNotification } from "../lib/push";

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
 * Returns quota usage for:
 *  - chat messages (hourly, Free=30 Pro=120)
 *  - Exum generation (daily, Free=5 Pro=20)
 *  - competency analysis (daily, Free=5 Pro=20)
 *
 * Every sub-object includes used / limit / remaining / resetAt so clients can
 * show accurate indicators.  The top-level fields (used, limit, remaining,
 * resetAt) are the chat-message counters retained for backwards compatibility.
 *
 * serverNow is included once at the top level so clients can compute accurate
 * countdowns without relying on the device clock (#92 pattern).
 */
router.get("/users/me/usage", requireAuth, async (req, res) => {
  const { chatRateLimitStore, exumRateLimitStore, competencyRateLimitStore, userKey } =
    await import("../middlewares/rateLimiter");

  const userIsPro = isPro(req);

  const chatLimit       = userIsPro ? 120 : 30;
  const dailyLimit      = userIsPro ? 20  : 5;   // shared by exum & competency

  const key = userKey(req);

  // Read all three stores in parallel to keep latency low.
  const [chatInfo, exumInfo, competencyInfo] = await Promise.all([
    chatRateLimitStore.get(key).catch(() => null),
    exumRateLimitStore.get(key).catch(() => null),
    competencyRateLimitStore.get(key).catch(() => null),
  ]);

  const chatUsed      = chatInfo?.totalHits ?? 0;
  const exumUsed      = exumInfo?.totalHits ?? 0;
  const competencyUsed = competencyInfo?.totalHits ?? 0;

  const serverNow = new Date().toISOString();

  res.json({
    // ── Top-level chat fields (backwards-compatible) ──────────────────────────
    used:      chatUsed,
    limit:     chatLimit,
    remaining: Math.max(0, chatLimit - chatUsed),
    resetAt:   chatInfo?.resetTime?.toISOString() ?? null,
    serverNow,

    // ── Per-limiter sub-objects ───────────────────────────────────────────────
    chat: {
      used:      chatUsed,
      limit:     chatLimit,
      remaining: Math.max(0, chatLimit - chatUsed),
      resetAt:   chatInfo?.resetTime?.toISOString() ?? null,
    },
    exum: {
      used:      exumUsed,
      limit:     dailyLimit,
      remaining: Math.max(0, dailyLimit - exumUsed),
      resetAt:   exumInfo?.resetTime?.toISOString() ?? null,
    },
    competency: {
      used:      competencyUsed,
      limit:     dailyLimit,
      remaining: Math.max(0, dailyLimit - competencyUsed),
      resetAt:   competencyInfo?.resetTime?.toISOString() ?? null,
    },
  });
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

  // Non-blocking push notification to the claimant's device.
  // sendPushNotification handles DeviceNotRegistered cleanup via the shared helper.
  const pushToken = req.dbUser!.expoPushToken;
  if (pushToken) {
    sendPushNotification(req.dbUser!.id, pushToken, {
      title: "Klaim kredit berhasil! 🎉",
      body: `${creditsGranted} kredit Exum telah ditambahkan ke akun Anda.`,
      channelId: "payments",
    }, req.log).catch(() => {/* already logged inside helper */});
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

// Save (or refresh) the Expo push token for this device.
// Idempotent: if the stored token is already identical, no DB write is performed.
// Both POST (legacy clients) and PATCH (updated clients) are accepted.
async function handlePushToken(
  req: import("express").Request,
  res: import("express").Response,
): Promise<void> {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token required" });
    return;
  }
  // Always update the token AND the timestamp, even when Expo returns the same
  // token string as before.  Stable devices (same ExponentPushToken across
  // sign-ins) only reset the clock this way, otherwise the startup cleanup
  // would incorrectly wipe a perfectly valid 90-day-old token.
  await db.update(users)
    .set({ expoPushToken: token, expoPushTokenSetAt: new Date() })
    .where(eq(users.id, req.dbUser!.id));
  res.json({ ok: true });
}

router.post("/users/me/push-token", requireAuth, handlePushToken);
router.patch("/users/me/push-token", requireAuth, handlePushToken);

router.get("/users", requireAuth, requireRole("admin"), async (_req, res) => {
  const all = await db.select().from(users).orderBy(users.createdAt);
  res.json(all);
});

router.patch("/users/:id/role", requireAuth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body as { role: string };
  // "askom" role intentionally omitted — it was removed from the platform.
  // Existing askom accounts are migrated to "user" at startup.
  const allowed = ["user", "instruktur", "lembaga_diklat", "asosiasi", "admin"];
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
