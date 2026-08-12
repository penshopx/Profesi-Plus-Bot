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
 * Accepts optional metadata (title, provider, jabkerList, skkTagsList) so the AI
 * context builder can reference course details without a server-side catalog copy.
 */
router.post("/marketplace/:courseId/watch", requireAuth, async (req, res) => {
  const uid = req.dbUser!.id;
  const { courseId } = req.params;
  if (!courseId || courseId.length > 120) {
    res.status(400).json({ error: "courseId tidak valid" });
    return;
  }
  const {
    title,
    provider,
    jabkerList,
    skkTagsList,
  }: {
    title?: string;
    provider?: string;
    jabkerList?: string[];
    skkTagsList?: string[];
  } = req.body ?? {};

  await db
    .insert(marketplaceWatches)
    .values({
      userId: uid,
      courseId,
      courseTitle:    title    ?? null,
      courseProvider: provider ?? null,
      jabkerList:     Array.isArray(jabkerList)  ? jabkerList  : [],
      skkTagsList:    Array.isArray(skkTagsList) ? skkTagsList : [],
    })
    .onConflictDoNothing();
  res.json({ ok: true });
});

export default router;
