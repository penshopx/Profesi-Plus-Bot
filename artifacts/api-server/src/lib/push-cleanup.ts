/**
 * Proactive stale push-token cleanup.
 *
 * Expo tokens can become permanently invalid when a user uninstalls the app
 * and never reinstalls it.  The reactive path (DeviceNotRegistered on the next
 * push) is fine for active users, but idle users can leave a stale token in the
 * DB indefinitely.  This function nullifies tokens that have not been refreshed
 * in more than STALE_TOKEN_DAYS days.
 *
 * The `expoPushTokenSetAt` column is stamped on every POST/PATCH
 * /users/me/push-token call (including when Expo returns the same token), so a
 * healthy active device always resets the clock on each sign-in or foreground
 * event.  Tokens with a NULL `expoPushTokenSetAt` are treated as implicitly
 * stale because they predate the column and their age is unknown.
 *
 * Safe to call on every startup and/or on a recurring interval — it is a no-op
 * when no stale tokens exist.
 */

import { sql, and } from "drizzle-orm";
import { db, users } from "@workspace/db";
import type { Logger } from "pino";

export const STALE_TOKEN_DAYS = 90;
export const PUSH_TOKEN_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Schedule the stale push-token cleanup to run every `intervalMs` (24h by
 * default).  Each run is defensively wrapped so that a synchronous throw or a
 * rejected promise from a single run is logged and NEVER cancels the interval —
 * the next scheduled run always still happens.
 *
 * Returns the timer so callers can clearInterval() it on shutdown.  The timer
 * is unref'd so it does not keep the process alive on its own.
 */
export function schedulePushTokenCleanup(
  log: Logger,
  intervalMs: number = PUSH_TOKEN_CLEANUP_INTERVAL_MS,
  runCleanup: (log: Logger) => Promise<void> = clearStalePushTokens,
): NodeJS.Timeout {
  const timer = setInterval(() => {
    // Promise.resolve().then(...) converts synchronous throws into rejections
    // so a single .catch handles both failure modes without killing the timer.
    Promise.resolve()
      .then(() => runCleanup(log))
      .catch((err) => {
        log.warn(
          { err },
          "Scheduled push-token cleanup run failed (non-fatal); next run remains scheduled",
        );
      });
  }, intervalMs);
  timer.unref?.();
  return timer;
}

export async function clearStalePushTokens(log: Logger): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - STALE_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    // Clear tokens that are older than the cutoff.  Also clear tokens that were
    // stored before the expoPushTokenSetAt column was added (NULL set-at with a
    // non-null token) — those are implicitly stale because we cannot know their age.
    const result = await db
      .update(users)
      .set({ expoPushToken: null, expoPushTokenSetAt: null })
      .where(
        and(
          sql`${users.expoPushToken} IS NOT NULL`,
          sql`(${users.expoPushTokenSetAt} IS NULL OR ${users.expoPushTokenSetAt} < ${cutoff})`,
        ),
      );
    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    if (count > 0) {
      log.info({ count, staleDays: STALE_TOKEN_DAYS }, "Cleared stale Expo push tokens");
    }
  } catch (err) {
    log.warn({ err }, "Stale push-token cleanup failed (non-fatal)");
  }
}
