/**
 * Rate limiters for LLM-backed endpoints.
 *
 * Both limiters key on the authenticated user ID so the limit is per-account,
 * not per-IP (users on shared IPs or VPNs get their own independent bucket).
 * Falls back to IP when no DB user is attached (should not happen on auth-gated
 * routes, but is safe either way).
 *
 * Limits are intentionally generous — the goal is preventing runaway cost from
 * bugs or abuse, not throttling normal usage:
 *
 *   Chat messages : 60 per hour per user  (~1/minute sustained — covers intense sessions)
 *   Exum generate : 10 per day  per user  (each Exum costs real LLM tokens)
 */

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

/** Resolve rate-limit key: authenticated user ID takes priority over IP. */
function userKey(req: Request): string {
  const uid = (req as unknown as { dbUser?: { id: number } }).dbUser?.id;
  return uid !== undefined ? `user:${uid}` : ipKeyGenerator(req);
}

/** 60 chat messages per hour per user. */
export const chatMessageRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 60,
  keyGenerator: userKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Terlalu banyak pesan dalam satu jam. Tunggu sebentar sebelum melanjutkan.",
    code: "rate_limit_chat",
  },
  skip: () => process.env.NODE_ENV === "test",
});

/** 10 Exum generations per day per user. */
export const exumRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  limit: 10,
  keyGenerator: userKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Batas generate Exum hari ini sudah tercapai. Coba lagi besok.",
    code: "rate_limit_exum",
  },
  skip: () => process.env.NODE_ENV === "test",
});
