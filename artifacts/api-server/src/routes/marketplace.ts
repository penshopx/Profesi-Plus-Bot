import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { db } from "@workspace/db";
import { marketplaceWatches } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

/**
 * GET /marketplace/watched
 * Returns the list of course IDs the authenticated user has opened.
 */
router.get("/marketplace/watched", requireAuth, async (req, res) => {
  const uid = req.dbUser!.id;
  const rows = await db
    .select({ courseId: marketplaceWatches.courseId })
    .from(marketplaceWatches)
    .where(eq(marketplaceWatches.userId, uid));
  res.json({ watchedIds: rows.map((r) => r.courseId) });
});

/**
 * POST /marketplace/:courseId/watch
 * Marks a course as watched for the authenticated user (upsert — idempotent).
 */
router.post("/marketplace/:courseId/watch", requireAuth, async (req, res) => {
  const uid = req.dbUser!.id;
  const { courseId } = req.params;
  if (!courseId || courseId.length > 120) {
    res.status(400).json({ error: "courseId tidak valid" });
    return;
  }
  await db
    .insert(marketplaceWatches)
    .values({ userId: uid, courseId })
    .onConflictDoNothing();
  res.json({ ok: true });
});

export default router;
