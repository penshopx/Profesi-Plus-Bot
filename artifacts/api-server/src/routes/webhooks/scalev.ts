import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { db, users, payments } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { DEFAULT_CREDITS_PER_ORDER } from "../../lib/plans";

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
  if (email) {
    const [matched] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .orderBy(asc(users.id))
      .limit(1);
    if (matched) {
      userId = matched.id;
    } else {
      req.log.warn({ email }, "Scalev paid order has no matching user by email");
    }
  }

  // Idempotency: insert the payment first. The unique externalId means a
  // retried/concurrent duplicate delivery loses the race (no row returned) and
  // must not grant again. Only the winning insert proceeds to add credits.
  const inserted = await db
    .insert(payments)
    .values({
      userId,
      provider: "scalev",
      externalId: orderId,
      customerEmail: email,
      status,
      amount,
      raw: JSON.stringify(payload).slice(0, 8000),
    })
    .onConflictDoNothing({ target: payments.externalId })
    .returning({ id: payments.id });

  if (inserted.length === 0) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  if (userId !== null) {
    await db
      .update(users)
      .set({ exumCredits: sql`${users.exumCredits} + ${quantity}` })
      .where(eq(users.id, userId));
  }

  res.status(200).json({ received: true, credited: userId !== null, quantity });
});

export default router;
