import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { db, users, payments } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { DEFAULT_CREDITS_PER_ORDER } from "../../lib/plans";
import { sendCreditClaimEmail } from "../../lib/email.js";
import { sendPushNotification } from "../../lib/push";

const router: IRouter = Router();

/** Order statuses that mean money was actually received. */
const PAID_STATUSES = new Set([
  "paid",
  "settlement",
  "settled",
  "success",
  "successful",
  "completed",
  "complete",
  "capture",
  "lunas",
]);

/**
 * Verify the webhook is genuinely from Scalev using an HMAC-SHA512 signature over
 * the raw request bytes. Uses a constant-time comparison to avoid timing attacks.
 */
function verifySignature(rawBody: Buffer | undefined, signature: string | undefined, secret: string): boolean {
  if (!rawBody || !signature) return false;
  const computed = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(computed);
  const b = Buffer.from(signature.trim().toLowerCase());
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Best-effort extraction of fields from a Scalev order payload (shape is tolerant). */
function extractOrder(payload: Record<string, unknown>): {
  orderId: string;
  status: string;
  email: string;
  amount: number;
  quantity: number;
} {
  const data = (payload.data as Record<string, unknown>) ?? payload;
  const order = (data.order as Record<string, unknown>) ?? data;
  const customer = (order.customer as Record<string, unknown>) ?? (data.customer as Record<string, unknown>) ?? {};

  const pick = (...vals: unknown[]): string => {
    for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
    for (const v of vals) if (typeof v === "number") return String(v);
    return "";
  };

  const orderId = pick(order.order_id, order.id, data.order_id, data.id, payload.order_id, payload.id);
  const status = pick(order.status, order.payment_status, order.order_status, data.status, payload.status).toLowerCase();
  const email = pick(customer.email, order.customer_email, order.email, data.email, payload.email).toLowerCase();
  const amountStr = pick(order.amount, order.gross_amount, order.total, order.grand_total, data.amount, payload.amount);
  const amount = Math.round(Number(amountStr) || 0);

  // How many Exum credits this order grants. Defaults to 1 (bayar putus per Exum);
  // honored if the product/order carries an explicit quantity.
  const qtyStr = pick(order.quantity, order.qty, order.credits, data.quantity, data.qty, payload.quantity);
  const quantity = Math.max(1, Math.round(Number(qtyStr) || DEFAULT_CREDITS_PER_ORDER));

  return { orderId, status, email, amount, quantity };
}

/**
 * Scalev payment webhook. Public (no Clerk auth) but authenticated by HMAC
 * signature. Idempotent via the unique payments.externalId. On a paid order it
 * matches the buyer to a user by email and grants Exum credits (pay-per-Exum).
 */
router.post("/webhooks/scalev", async (req, res): Promise<void> => {
  const secret = process.env.SCALEV_WEBHOOK_SECRET;
  if (!secret) {
    req.log.error("SCALEV_WEBHOOK_SECRET is not configured; rejecting webhook");
    res.status(503).json({ error: "Webhook not configured" });
    return;
  }

  const signature = (req.headers["x-scalev-signature"] ||
    req.headers["x-signature"] ||
    req.headers["signature"]) as string | undefined;
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;

  if (!verifySignature(rawBody, signature, secret)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const payload = (req.body ?? {}) as Record<string, unknown>;
  const { orderId, status, email, amount, quantity } = extractOrder(payload);

  if (!orderId) {
    req.log.warn("Scalev webhook missing order id");
    res.status(200).json({ received: true, ignored: "no_order_id" });
    return;
  }

  if (!PAID_STATUSES.has(status)) {
    res.status(200).json({ received: true, ignored: "status_not_paid", status });
    return;
  }

  // Resolve the buyer by email. Order deterministically so that, in the unlikely
  // event of duplicate emails, the same account is always chosen.
  let userId: number | null = null;
  let userPushToken: string | null = null;
  if (email) {
    const [matched] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .orderBy(asc(users.id))
      .limit(1);
    if (matched) {
      userId = matched.id;
      userPushToken = matched.expoPushToken ?? null;
    } else {
      req.log.warn({ email }, "Scalev paid order has no matching user by email");
    }
  }

  // Idempotency + atomicity: the payment insert and the credit grant are wrapped
  // in a single transaction. A crash between the two would have previously left
  // the payment row committed (preventing any future retry from re-inserting via
  // the unique externalId constraint) while credits were never granted. Wrapping
  // both operations in one transaction ensures they either both commit or both
  // roll back — Scalev can then retry a 500 safely, and the next delivery will
  // win the INSERT again and grant credits correctly.
  let isDuplicate = false;
  let credited = false;
  try {
    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(payments)
        .values({
          userId,
          provider: "scalev",
          externalId: orderId,
          customerEmail: email,
          status,
          amount,
          creditsGranted: quantity,
          raw: JSON.stringify(payload).slice(0, 8000),
        })
        .onConflictDoNothing({ target: payments.externalId })
        .returning({ id: payments.id });

      if (inserted.length === 0) {
        // Duplicate delivery — the row already exists; commit this no-op.
        isDuplicate = true;
        return;
      }

      if (userId !== null) {
        await tx
          .update(users)
          .set({ exumCredits: sql`${users.exumCredits} + ${quantity}` })
          .where(eq(users.id, userId));
        credited = true;
      }
    });
  } catch (err) {
    req.log.error({ err, orderId }, "Scalev webhook transaction failed");
    // Return 500 so Scalev retries. The transaction was rolled back, so the
    // externalId row does not exist — the next delivery will attempt the full
    // insert + credit grant without any double-granting risk.
    res.status(500).json({ error: "Internal error processing payment" });
    return;
  }

  if (isDuplicate) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  if (!credited) {
    req.log.warn({ orderId, email }, "Scalev paid order has no matching user by email — payment stored for manual claim");
  }

  // Non-blocking push notification + receipt email — fire after the response
  // is committed so slow external APIs never delay Scalev's acknowledgement.
  if (credited && userId !== null) {
    // Push notification — sendPushNotification handles DeviceNotRegistered cleanup.
    if (userPushToken) {
      sendPushNotification(userId, userPushToken, {
        title: "Kredit Exum masuk! 🎉",
        body: `${quantity} kredit Exum telah ditambahkan ke akun Anda. Siap membuat Exum berikutnya?`,
        channelId: "payments",
      }, req.log).catch(() => {/* already logged inside helper */});
    }

    // Receipt email — fetch the buyer's current balance then send non-blockingly.
    // Only fires when we have a verified buyer email (extracted from the payload).
    if (email) {
      db.select({ exumCredits: users.exumCredits })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .then(([row]) => {
          sendCreditClaimEmail({
            to: email,
            orderId,
            creditsGranted: quantity,
            newBalance: row?.exumCredits ?? quantity,
          });
        })
        .catch((err) => req.log.warn({ err, orderId }, "Failed to fetch balance for receipt email"));
    }
  }

  res.status(200).json({ received: true, credited, quantity });
});

export default router;
