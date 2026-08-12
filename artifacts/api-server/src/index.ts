import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

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

backfillCreditsGranted().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
