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
 *
 * Each public export is built from a factory function so tests can instantiate
 * the real production configuration with a custom store or without the
 * NODE_ENV=test skip guard.
 */

import rateLimit, { MemoryStore, ipKeyGenerator, type Options, type Store } from "express-rate-limit";
import type { Request } from "express";

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Resolve rate-limit key: authenticated user ID takes priority over IP. */
export function userKey(req: Request): string {
  const uid = (req as unknown as { dbUser?: { id: number } }).dbUser?.id;
  return uid !== undefined ? `user:${uid}` : ipKeyGenerator(req.ip ?? "");
}

/** Returns true when the authenticated user has an active Pro plan. */
export function isPro(req: Request): boolean {
  const user = (req as unknown as { dbUser?: { plan?: string; planExpiresAt?: Date | null } }).dbUser;
  if (!user) return false;
  if (user.plan !== "pro") return false;
  // If the plan has an expiry, check it hasn't passed.
  if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date()) return false;
  return true;
}

// ── Shared store (exported so /users/me/usage reads the exact same counter) ───
//
// express-rate-limit's default MemoryStore is an internal implementation detail;
// by exporting it here we ensure the display counter can never drift from the
// counter that actually controls enforcement.  Tests that pass `overrides.store`
// bypass this singleton cleanly.
export const chatRateLimitStore = new MemoryStore();

// ── Factory options type ──────────────────────────────────────────────────────

/** Optional overrides accepted by every factory (used by tests). */
export interface LimiterOverrides {
  /** Supply a fresh MemoryStore to isolate test state. */
  store?: Store;
  /**
   * Override the skip function.  Pass `undefined` explicitly (or omit) to keep
   * the production default (`() => NODE_ENV === "test"`).  Pass `() => false`
   * to disable the skip guard in integration tests.
   */
  skip?: Options["skip"];
}

// ── chatMessageRateLimiter ────────────────────────────────────────────────────

/**
 * Create a chat-message rate limiter.
 * Free: 30 messages/hour | Pro: 120 messages/hour
 *
 * @param overrides - Optional store and skip overrides (for testing).
 */
export function createChatMessageRateLimiter(overrides: LimiterOverrides = {}) {
  return rateLimit({
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
    skip: overrides.skip ?? (() => process.env.NODE_ENV === "test"),
    // Always use the shared singleton unless tests inject their own store.
    store: overrides.store ?? chatRateLimitStore,
  });
}

/** Production singleton. */
export const chatMessageRateLimiter = createChatMessageRateLimiter();

// ── exumRateLimiter ───────────────────────────────────────────────────────────

/**
 * Create an Exum-generation rate limiter (supplemental guard — credit gating is the primary gate).
 * Free: 5 Exum/day | Pro: 20 Exum/day
 */
export function createExumRateLimiter(overrides: LimiterOverrides = {}) {
  return rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    limit: (req: Request) => (isPro(req) ? 20 : 5),
    keyGenerator: userKey,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "Batas generate Exum hari ini sudah tercapai. Coba lagi besok atau upgrade ke Pro.",
      code: "rate_limit_exum",
    },
    skip: overrides.skip ?? (() => process.env.NODE_ENV === "test"),
    ...(overrides.store ? { store: overrides.store } : {}),
  });
}

/** Production singleton. */
export const exumRateLimiter = createExumRateLimiter();

// ── competencyRateLimiter ─────────────────────────────────────────────────────

/**
 * Create a competency-analysis rate limiter.
 * Free: 5 analyses/day | Pro: 20 analyses/day
 */
export function createCompetencyRateLimiter(overrides: LimiterOverrides = {}) {
  return rateLimit({
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
    skip: overrides.skip ?? (() => process.env.NODE_ENV === "test"),
    ...(overrides.store ? { store: overrides.store } : {}),
  });
}

/** Production singleton. */
export const competencyRateLimiter = createCompetencyRateLimiter();

// ── claimPaymentRateLimiter ───────────────────────────────────────────────────

/**
 * Create a manual-payment claim rate limiter.
 * Hard cap of 10 claim attempts per hour per account (regardless of plan) to
 * prevent brute-force probing of order IDs. Successful claims reduce the
 * remaining budget the same as failed ones.
 */
export function createClaimPaymentRateLimiter(overrides: LimiterOverrides = {}) {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 10,
    keyGenerator: userKey,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "Terlalu banyak percobaan klaim. Coba lagi dalam beberapa saat.",
      code: "rate_limit_claim",
    },
    skip: overrides.skip ?? (() => process.env.NODE_ENV === "test"),
    ...(overrides.store ? { store: overrides.store } : {}),
  });
}

/** Production singleton. */
export const claimPaymentRateLimiter = createClaimPaymentRateLimiter();

// ── catalogRateLimiter ────────────────────────────────────────────────────────

/**
 * Public catalog endpoint rate limiter (IP-based — no auth required).
 * 120 requests/hour per IP prevents scraping while allowing normal browsing.
 */
export function createCatalogRateLimiter(overrides: LimiterOverrides = {}) {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 120,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "Terlalu banyak permintaan. Coba lagi nanti.",
      code: "rate_limit_catalog",
    },
    skip: overrides.skip ?? (() => process.env.NODE_ENV === "test"),
    ...(overrides.store ? { store: overrides.store } : {}),
  });
}

/** Production singleton. */
export const catalogRateLimiter = createCatalogRateLimiter();
