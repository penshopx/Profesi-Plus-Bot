/**
 * /api/marketplace — Status "Sudah Ditonton" untuk modul marketplace PKB
 *
 * GET  /api/marketplace/watched             — daftar modul yang sudah ditandai user
 * POST /api/marketplace/:courseId/watch    — auto-mark saat membuka kursus (idempotent)
 * POST /api/marketplace/watched             — explicit mark dengan metadata lengkap
 * DELETE /api/marketplace/watched/:courseId — hapus tanda (unwatch)
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { db } from "@workspace/db";
import { marketplaceWatched } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// ─── GET /api/marketplace/watched ─────────────────────────────────────────────
// Returns full objects and courseId-only array for compatibility.

router.get("/marketplace/watched", requireAuth, async (req, res) => {
  const uid = req.dbUser!.id;
  const rows = await db
    .select()
    .from(marketplaceWatched)
    .where(eq(marketplaceWatched.userId, uid));
  res.json({
    watched: rows,
    watchedIds: rows.map((r) => r.courseId),
  });
});

// ─── POST /api/marketplace/:courseId/watch ────────────────────────────────────
// Auto-watch: triggered when user opens a course. Idempotent upsert.
// courseTitle and provider are optional in the body — falls back to courseId when absent.

router.post("/marketplace/:courseId/watch", requireAuth, async (req, res) => {
  const uid = req.dbUser!.id;
  const { courseId } = req.params;
  if (!courseId || courseId.length > 120) {
    res.status(400).json({ error: "courseId tidak valid" });
    return;
  }
  const { courseTitle = courseId, provider = "" } =
    (req.body as { courseTitle?: string; provider?: string }) ?? {};
  await db
    .insert(marketplaceWatched)
    .values({ userId: uid, courseId, courseTitle, provider })
    .onConflictDoNothing();
  res.json({ ok: true });
});

// ─── POST /api/marketplace/watched ────────────────────────────────────────────
// Explicit watch with full metadata (courseTitle + provider required).

router.post("/marketplace/watched", requireAuth, async (req, res) => {
  const uid = req.dbUser!.id;
  const { courseId, courseTitle, provider } = req.body as {
    courseId?: string;
    courseTitle?: string;
    provider?: string;
  };
  if (!courseId || !courseTitle || !provider) {
    return res.status(400).json({ error: "courseId, courseTitle, and provider are required" });
  }
  await db
    .insert(marketplaceWatched)
    .values({ userId: uid, courseId, courseTitle, provider })
    .onConflictDoNothing();
  return res.json({ ok: true });
});

// ─── DELETE /api/marketplace/watched/:courseId ────────────────────────────────
// Unwatch: allows user to un-mark a module.

router.delete("/marketplace/watched/:courseId", requireAuth, async (req, res) => {
  const uid = req.dbUser!.id;
  const { courseId } = req.params;
  await db
    .delete(marketplaceWatched)
    .where(and(
      eq(marketplaceWatched.userId, uid),
      eq(marketplaceWatched.courseId, courseId),
    ));
  return res.json({ ok: true });
});

export default router;
