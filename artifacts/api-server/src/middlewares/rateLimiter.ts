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
import { pool } from "@workspace/db";
import { PgRateLimitStore } from "../lib/pgRateLimitStore.js";

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

// ── Shared stores (exported so /users/me/usage reads the exact same counters) ──
//
// Backed by PostgreSQL so counters survive server restarts.  Each limiter gets
// its own prefixed store so they share one table without key collisions:
//
//   chatRateLimitStore      → keys like "user:5"            (no prefix, legacy)
//   exumRateLimitStore      → keys like "exum:user:5"
//   competencyRateLimitStore → keys like "competency:user:5"
//
// Tests that pass `overrides.store` bypass these singletons cleanly by
// injecting their own MemoryStore.
export const chatRateLimitStore        = new PgRateLimitStore(pool);
export const exumRateLimitStore        = new PgRateLimitStore(pool, { prefix: "exum" });
export const competencyRateLimitStore  = new PgRateLimitStore(pool, { prefix: "competency" });

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
    // Always use the shared singleton unless tests inject their own store.
    store: overrides.store ?? exumRateLimitStore,
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
    // Always use the shared singleton unless tests inject their own store.
    store: overrides.store ?? competencyRateLimitStore,
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

/** Parse a positive-integer env var, falling back to a default when unset or invalid. */
function envPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(`[rateLimiter] Ignoring invalid ${name}="${raw}"; using default ${fallback}`);
    return fallback;
  }
  return parsed;
}

/**
 * Public catalog endpoint rate limiter (IP-based — no auth required).
 * Defaults to 120 requests/hour per IP, which prevents scraping while allowing
 * normal browsing. Configurable per environment via:
 *
 *   CATALOG_RATE_LIMIT_MAX        — max requests per window (default 120)
 *   CATALOG_RATE_LIMIT_WINDOW_MS  — window length in ms (default 3600000 = 1h)
 *
 * Useful for staging/load testing where a relaxed limit is needed without a
 * code change.
 */
export function createCatalogRateLimiter(overrides: LimiterOverrides = {}) {
  return rateLimit({
    windowMs: envPositiveInt("CATALOG_RATE_LIMIT_WINDOW_MS", 60 * 60 * 1000), // 1 hour default
    limit: envPositiveInt("CATALOG_RATE_LIMIT_MAX", 120),
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
