import type { User } from "@workspace/db";

/** Free-tier allowance: number of Executive Summary generations per calendar month. */
export const FREE_EXUM_PER_MONTH = 1;

/** Days of Pro access granted per paid order (monthly subscription model). */
export const PRO_PERIOD_DAYS = 30;

/** True when the user currently holds active Pro access (not expired). */
export function isPro(user: Pick<User, "plan" | "planExpiresAt">): boolean {
  if (user.plan !== "pro") return false;
  if (user.planExpiresAt && new Date(user.planExpiresAt).getTime() < Date.now()) {
    return false;
  }
  return true;
}

/** Start of the current calendar month (UTC) — the window for free-tier quotas. */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Expiry timestamp for a freshly granted Pro period. */
export function proExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + PRO_PERIOD_DAYS * 24 * 60 * 60 * 1000);
}
