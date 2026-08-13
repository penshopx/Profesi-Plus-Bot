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
