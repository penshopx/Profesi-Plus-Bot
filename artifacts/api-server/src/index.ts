import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { clearStalePushTokens, schedulePushTokenCleanup } from "./lib/push-cleanup";
import { pool } from "@workspace/db";
import { pruneExpiredRateLimitCounters } from "./lib/pgRateLimitStore";
import { cleanupOrphanedUploads, UPLOAD_CLEANUP_INTERVAL_MS } from "./lib/upload-cleanup";

/**
 * One-time migration: revoke legacy "askom" role from any users still carrying
 * it in the database. The ASKOM role has been removed from the platform; those
 * users are downgraded to "user". Runs on every startup but is a no-op once all
 * rows are cleared.
 */
/** Run orphaned-upload cleanup once at startup, then every 24 hours. */
let uploadCleanupInterval: NodeJS.Timeout | undefined;

function scheduleUploadCleanup(): void {
  uploadCleanupInterval = setInterval(() => {
    void cleanupOrphanedUploads(logger);
  }, UPLOAD_CLEANUP_INTERVAL_MS);
  // Don't let the timer keep the process alive on its own.
  uploadCleanupInterval.unref?.();
}

async function migrateAskomRoleToUser(): Promise<void> {
  try {
    const result = await db.execute(sql`UPDATE users SET role = 'user' WHERE role = 'askom'`);
    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    if (count > 0) {
      logger.info({ count }, "Migrated legacy 'askom' role to 'user'");
    }
  } catch (err) {
    logger.warn({ err }, "askom role migration failed (non-fatal)");
  }
}

/**
 * One-time backfill: payment rows created before the credits_granted column was
 * added to the schema all have credits_granted = 0 (the column default). Every
 * Scalev order corresponds to exactly 1 Exum credit, so we can safely backfill
 * any paid row that has 0 with 1. This runs on every startup but is a no-op
 * once all rows are fixed.
 */
async function backfillCreditsGranted(): Promise<void> {
  try {
    const PAID_STATUSES = ["paid", "settlement", "settled", "success", "successful", "completed", "complete", "capture", "lunas"];
    const placeholders = PAID_STATUSES.map((_, i) => `$${i + 1}`).join(", ");
    const result = await db.execute(
      sql`UPDATE payments SET credits_granted = 1 WHERE credits_granted = 0 AND status IN (${sql.raw(PAID_STATUSES.map(s => `'${s}'`).join(", "))})`
    );
    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    if (count > 0) {
      logger.info({ count }, "Backfilled credits_granted=1 for historical paid payments");
    }
  } catch (err) {
    // Non-fatal — log and continue. The frontend guard handles any remaining zeros.
    logger.warn({ err }, "credits_granted backfill failed (non-fatal)");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/** Emit a WARN on startup when email config is missing so misconfigurations are never silent. */
function validateEmailConfig(): void {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM;

  if (!apiKey) {
    logger.warn(
      "RESEND_API_KEY is not set — transactional emails (credit receipts, claim confirmations) will be skipped. " +
      "Set the secret via Replit Secrets to enable email delivery."
    );
  } else if (!from) {
    logger.warn(
      "RESEND_FROM is not set — transactional emails are configured but will be skipped. " +
      "Set RESEND_FROM to a verified Resend sender address, e.g. 'Gustafta <no-reply@yourdomain.com>'."
    );
  } else {
    logger.info({ from }, "Email config OK — transactional emails enabled via Resend");
  }
}

validateEmailConfig();

/**
 * Delete expired rate-limit counter rows so the table doesn't grow forever.
 * Idempotent and non-fatal: a failure just means the rows get cleaned up on
 * the next run.
 */
async function cleanupExpiredRateLimits(): Promise<void> {
  try {
    const count = await pruneExpiredRateLimitCounters(pool);
    if (count > 0) {
      logger.info({ count }, "Pruned expired rate-limit counter rows");
    }
  } catch (err) {
    logger.warn({ err }, "rate-limit counter cleanup failed (non-fatal)");
  }
}

/** Run stale push-token cleanup once, then every 24 hours (see lib/push-cleanup). */
let pushTokenCleanupInterval: NodeJS.Timeout | undefined;

/** Run expired rate-limit row cleanup every hour (also runs once at startup). */
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let rateLimitCleanupInterval: NodeJS.Timeout | undefined;

function scheduleRateLimitCleanup(): void {
  rateLimitCleanupInterval = setInterval(() => {
    void cleanupExpiredRateLimits();
  }, RATE_LIMIT_CLEANUP_INTERVAL_MS);
  // Don't let the timer keep the process alive on its own.
  rateLimitCleanupInterval.unref?.();
}

migrateAskomRoleToUser()
  .then(() => backfillCreditsGranted())
  .then(() => clearStalePushTokens(logger))
  .then(() => cleanupExpiredRateLimits())
  .then(() => {
    // Fire-and-forget: startup shouldn't block on a full GCS listing.
    void cleanupOrphanedUploads(logger);
    pushTokenCleanupInterval = schedulePushTokenCleanup(logger);
    scheduleRateLimitCleanup();
    scheduleUploadCleanup();
    const server = app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });

    process.on("SIGTERM", () => {
      if (pushTokenCleanupInterval) {
        clearInterval(pushTokenCleanupInterval);
      }
      if (rateLimitCleanupInterval) {
        clearInterval(rateLimitCleanupInterval);
      }
      if (uploadCleanupInterval) {
        clearInterval(uploadCleanupInterval);
      }
      // Close the HTTP server so the process exits cleanly, with a bounded
      // fallback in case connections don't drain in time.
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 10_000).unref();
    });
  });
