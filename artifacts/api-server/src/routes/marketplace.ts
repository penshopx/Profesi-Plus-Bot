/**
 * /api/marketplace — Katalog kursus + status "Sudah Ditonton"
 *
 * GET  /api/marketplace/courses              — seluruh catalog + reviews (public, no auth)
 * GET  /api/marketplace/watched             — daftar modul yang sudah ditandai user
 * POST /api/marketplace/:courseId/watch    — auto-mark saat membuka kursus (idempotent)
 * POST /api/marketplace/watched             — explicit mark dengan metadata lengkap
 * DELETE /api/marketplace/watched/:courseId — hapus tanda (unwatch)
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { db } from "@workspace/db";
import {
  marketplaceWatched,
  marketplaceCourses,
  marketplaceAiReviews,
  marketplaceAskomReviews,
} from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

// ─── GET /api/marketplace/courses ─────────────────────────────────────────────
// Public endpoint — no auth needed to browse the catalog.
// Returns all courses ordered by sort_order, with their AI + ASKOM reviews.

router.get("/marketplace/courses", async (_req, res) => {
  const [courses, aiReviews, askomReviews] = await Promise.all([
    db.select().from(marketplaceCourses).orderBy(asc(marketplaceCourses.sortOrder)),
    db.select().from(marketplaceAiReviews).orderBy(asc(marketplaceAiReviews.id)),
    db.select().from(marketplaceAskomReviews),
  ]);

  // Group reviews by courseId
  const aiMap = new Map<string, typeof aiReviews>();
  for (const r of aiReviews) {
    if (!aiMap.has(r.courseId)) aiMap.set(r.courseId, []);
    aiMap.get(r.courseId)!.push(r);
  }
  const askomMap = new Map<string, (typeof askomReviews)[number]>();
  for (const r of askomReviews) {
    askomMap.set(r.courseId, r);
  }

  const result = courses.map((c) => ({
    ...c,
    reviews: {
      aiReviews: (aiMap.get(c.id) ?? []).map((r) => ({
        platform: r.platform,
        platformIcon: r.platformIcon,
        rating: r.rating,
        relevanceScore: r.relevanceScore,
        comment: r.comment,
        reviewedAt: r.reviewedAt,
      })),
      askomReview: askomMap.has(c.id)
        ? (() => {
            const a = askomMap.get(c.id)!;
            return {
              reviewerName: a.reviewerName,
              credential: a.credential,
              institution: a.institution,
              credentialNumber: a.credentialNumber ?? undefined,
              rating: a.rating,
              relevanceScore: a.relevanceScore,
              recommendation: a.recommendation,
              comment: a.comment,
              strengths: a.strengths,
              notes: a.notes ?? undefined,
              reviewedAt: a.reviewedAt,
            };
          })()
        : undefined,
    },
  }));

  res.json({ courses: result });
});

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
