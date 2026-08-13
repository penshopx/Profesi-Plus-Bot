/**
 * Shared Expo push-notification helper.
 *
 * Sends a single push message to a device token, parses the Expo ticket, and
 * clears `users.expoPushToken` when Expo reports DeviceNotRegistered.  Using
 * this helper ensures every push call site gets the same stale-token cleanup
 * without duplicating the fetch + parse + clear logic.
 *
 * All failures are non-fatal: the caller's response has already been committed
 * before this is invoked, so we never throw — we only log warnings.
 */

import { eq, and } from "drizzle-orm";
import { db, users } from "@workspace/db";
import type { Logger } from "pino";

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
}

/**
 * Send a push notification via the Expo push API.
 *
 * @param userId   - DB user ID owning the token (used for the WHERE on clear).
 * @param token    - The `expoPushToken` value captured before the async work.
 * @param payload  - Notification content.
 * @param log      - A pino logger instance (usually `req.log`).
 *
 * If Expo returns a DeviceNotRegistered ticket the token is cleared from the DB,
 * but only when it still matches the token we sent to (guards a race where the
 * device re-registered between capture and error handling).
 */
export async function sendPushNotification(
  userId: number,
  token: string,
  payload: PushPayload,
  log: Logger,
): Promise<void> {
  try {
    const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({ to: token, ...payload }),
    });

    if (!pushRes.ok) {
      log.warn({ status: pushRes.status }, "Expo push HTTP error");
      return;
    }

    // Expo wraps tickets in a `data` array, one entry per recipient.
    const pushBody = await pushRes.json() as {
      data?: Array<{ status?: string; details?: { error?: string } }>;
    };
    const tickets = pushBody?.data ?? [];
    const isDeviceNotRegistered = tickets.some(
      (t) => t.status === "error" && t.details?.error === "DeviceNotRegistered",
    );

    if (isDeviceNotRegistered) {
      // Log only a non-reversible suffix so the bearer token never reaches logs.
      const tokenSuffix = token.slice(-8);
      log.warn({ userId, pushTokenSuffix: tokenSuffix }, "Expo token DeviceNotRegistered — clearing from DB");
      // Only clear when the stored token still matches the one we sent to, so we
      // don't wipe a replacement token the device may have registered in the interim.
      await db
        .update(users)
        .set({ expoPushToken: null })
        .where(and(eq(users.id, userId), eq(users.expoPushToken, token)));
    }
  } catch (err) {
    // Do not log `token` here — the error object itself must not carry the bearer credential.
    log.warn({ err, userId }, "Failed to send Expo push notification");
  }
}
