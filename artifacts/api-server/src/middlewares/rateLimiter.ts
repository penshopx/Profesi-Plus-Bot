/**
 * Rate limiters for LLM-backed endpoints.
 *
 * All limiters key on the authenticated user ID so the limit is per-account,
 * not per-IP (users on shared IPs or VPNs get their own independent bucket).
 * Falls back to IP when no DB user is attached (should not happen on auth-gated
 * routes, but is safe either way).
 *
 * Free-tier users receive lower budgets than Pro users to keep costs predictable:
 *
 *   Chat messages  : Free=30/hour,  Pro=120/hour
 *   Exum generate  : Free=5/day,    Pro=20/day   (extra guard on top of credit gating)
 *   Competency AI  : Free=5/day,    Pro=20/day
 */

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

/** Resolve rate-limit key: authenticated user ID takes priority over IP. */
function userKey(req: Request): string {
  const uid = (req as unknown as { dbUser?: { id: number } }).dbUser?.id;
  return uid !== undefined ? `user:${uid}` : ipKeyGenerator(req.ip ?? "");
}

/** Returns true when the authenticated user has an active Pro plan. */
function isPro(req: Request): boolean {
  const user = (req as unknown as { dbUser?: { plan?: string; planExpiresAt?: Date | null } }).dbUser;
  if (!user) return false;
  if (user.plan !== "pro") return false;
  // If the plan has an expiry, check it hasn't passed.
  if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date()) return false;
  return true;
}

/**
 * Chat message rate limiter.
 * Free: 30 messages/hour | Pro: 120 messages/hour
 */
export const chatMessageRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: (req: Request) => (isPro(req) ? 120 : 30),
  keyGenerator: userKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error:
      "Terlalu banyak pesan dalam satu jam. Upgrade ke Pro untuk batas lebih tinggi, atau tunggu sebentar.",
    code: "rate_limit_chat",
  },
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Exum generation rate limiter (supplemental guard — credit gating is the primary gate).
 * Free: 5 Exum/day | Pro: 20 Exum/day
 */
export const exumRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  limit: (req: Request) => (isPro(req) ? 20 : 5),
  keyGenerator: userKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Batas generate Exum hari ini sudah tercapai. Coba lagi besok atau upgrade ke Pro.",
    code: "rate_limit_exum",
  },
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Competency analysis rate limiter.
 * Free: 5 analyses/day | Pro: 20 analyses/day
 */
export const competencyRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  limit: (req: Request) => (isPro(req) ? 20 : 5),
  keyGenerator: userKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error:
      "Batas analisis kompetensi hari ini sudah tercapai. Coba lagi besok atau upgrade ke Pro.",
    code: "rate_limit_competency",
  },
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Manual payment claim rate limiter.
 * Hard cap of 10 claim attempts per hour per account (regardless of plan) to
 * prevent brute-force probing of order IDs. Successful claims reduce the
 * remaining budget the same as failed ones.
 */
export const claimPaymentRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10,
  keyGenerator: userKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Terlalu banyak percobaan klaim. Coba lagi dalam beberapa saat.",
    code: "rate_limit_claim",
  },
  skip: () => process.env.NODE_ENV === "test",
});
