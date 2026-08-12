/**
 * /api/marketplace — Katalog kursus + status "Sudah Ditonton"
 *
 * GET  /api/marketplace/courses              — seluruh catalog + reviews (public, no auth)
 * GET  /api/marketplace/watched             — daftar modul yang sudah ditandai user
 * POST /api/marketplace/:courseId/watch    — auto-mark saat membuka kursus (idempotent)
 * POST /api/marketplace/watched             — explicit mark dengan metadata lengkap
 * DELETE /api/marketplace/watched/:courseId — hapus tanda (unwatch)
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middlewares/auth";
import { catalogRateLimiter } from "../middlewares/rateLimiter";
import { db } from "@workspace/db";
import {
  marketplaceWatched,
  marketplaceCourses,
  marketplaceAiReviews,
  marketplaceAskomReviews,
} from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";

/** Middleware: only allow users with role='admin'. */
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if ((req as any).dbUser?.role !== "admin") {
    res.status(403).json({ error: "Akses ditolak — hanya admin." });
    return;
  }
  next();
}

const router = Router();

// ─── GET /api/marketplace/courses ─────────────────────────────────────────────
// Public endpoint — no auth needed to browse the catalog.
// Rate-limited at 120 req/hour per IP to prevent scraping.
// Returns all courses ordered by sort_order, with their AI + ASKOM reviews.

router.get("/marketplace/courses", catalogRateLimiter, async (_req, res) => {
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

// ─── ADMIN CRUD ───────────────────────────────────────────────────────────────
// These endpoints require role='admin'. They allow admins to manage the catalog
// without touching code or re-deploying.

/** GET /api/marketplace/admin/courses — list all courses (with full fields) */
router.get("/marketplace/admin/courses", requireAuth, requireAdmin, async (_req, res) => {
  const courses = await db.select().from(marketplaceCourses).orderBy(asc(marketplaceCourses.sortOrder));
  res.json({ courses });
});

/** POST /api/marketplace/admin/courses — create a new course */
router.post("/marketplace/admin/courses", requireAuth, requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  if (!body.id || !body.title || !body.provider || !body.url) {
    res.status(400).json({ error: "id, title, provider, dan url wajib diisi." });
    return;
  }
  const [created] = await db.insert(marketplaceCourses).values({
    id:               String(body.id),
    title:            String(body.title),
    provider:         String(body.provider),
    providerLogo:     body.providerLogo ? String(body.providerLogo) : null,
    thumbnail:        body.thumbnail ? String(body.thumbnail) : "from-blue-500 to-indigo-500",
    type:             body.type ? String(body.type) : "video",
    price:            body.price ? String(body.price) : "gratis",
    priceIdr:         body.priceIdr ? Number(body.priceIdr) : null,
    priceOriginalIdr: body.priceOriginalIdr ? Number(body.priceOriginalIdr) : null,
    rating:           body.rating ? Number(body.rating) : 4.5,
    ratingCount:      body.ratingCount ? Number(body.ratingCount) : 0,
    durationMinutes:  body.durationMinutes ? Number(body.durationMinutes) : 0,
    videoCount:       body.videoCount ? Number(body.videoCount) : 0,
    quizCount:        body.quizCount ? Number(body.quizCount) : 0,
    hasCertificate:   Boolean(body.hasCertificate),
    jabker:           Array.isArray(body.jabker) ? body.jabker.map(String) : [],
    skkTags:          Array.isArray(body.skkTags) ? body.skkTags : [],
    description:      body.description ? String(body.description) : "",
    highlights:       Array.isArray(body.highlights) ? body.highlights.map(String) : [],
    curriculum:       Array.isArray(body.curriculum) ? body.curriculum : [],
    url:              String(body.url),
    isBestSeller:     Boolean(body.isBestSeller),
    isFeatured:       Boolean(body.isFeatured),
    isNew:            Boolean(body.isNew),
    sortOrder:        body.sortOrder ? Number(body.sortOrder) : 0,
  }).returning();
  res.status(201).json({ course: created });
});

/** PATCH /api/marketplace/admin/courses/:id — update a course */
router.patch("/marketplace/admin/courses/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;

  const existing = await db.select().from(marketplaceCourses).where(eq(marketplaceCourses.id, id)).limit(1);
  if (!existing.length) { res.status(404).json({ error: "Kursus tidak ditemukan." }); return; }

  const patch: Partial<typeof marketplaceCourses.$inferInsert> = {};
  if (body.title            !== undefined) patch.title            = String(body.title);
  if (body.provider         !== undefined) patch.provider         = String(body.provider);
  if (body.providerLogo     !== undefined) patch.providerLogo     = body.providerLogo ? String(body.providerLogo) : null;
  if (body.thumbnail        !== undefined) patch.thumbnail        = String(body.thumbnail);
  if (body.type             !== undefined) patch.type             = String(body.type);
  if (body.price            !== undefined) patch.price            = String(body.price);
  if (body.priceIdr         !== undefined) patch.priceIdr         = body.priceIdr ? Number(body.priceIdr) : null;
  if (body.priceOriginalIdr !== undefined) patch.priceOriginalIdr = body.priceOriginalIdr ? Number(body.priceOriginalIdr) : null;
  if (body.rating           !== undefined) patch.rating           = Number(body.rating);
  if (body.ratingCount      !== undefined) patch.ratingCount      = Number(body.ratingCount);
  if (body.durationMinutes  !== undefined) patch.durationMinutes  = Number(body.durationMinutes);
  if (body.videoCount       !== undefined) patch.videoCount       = Number(body.videoCount);
  if (body.quizCount        !== undefined) patch.quizCount        = Number(body.quizCount);
  if (body.hasCertificate   !== undefined) patch.hasCertificate   = Boolean(body.hasCertificate);
  if (Array.isArray(body.jabker))          patch.jabker           = body.jabker.map(String);
  if (Array.isArray(body.skkTags))         patch.skkTags          = body.skkTags;
  if (body.description      !== undefined) patch.description      = String(body.description);
  if (Array.isArray(body.highlights))      patch.highlights       = body.highlights.map(String);
  if (Array.isArray(body.curriculum))      patch.curriculum       = body.curriculum;
  if (body.url              !== undefined) patch.url              = String(body.url);
  if (body.isBestSeller     !== undefined) patch.isBestSeller     = Boolean(body.isBestSeller);
  if (body.isFeatured       !== undefined) patch.isFeatured       = Boolean(body.isFeatured);
  if (body.isNew            !== undefined) patch.isNew            = Boolean(body.isNew);
  if (body.sortOrder        !== undefined) patch.sortOrder        = Number(body.sortOrder);
  patch.updatedAt = new Date();

  const [updated] = await db.update(marketplaceCourses).set(patch).where(eq(marketplaceCourses.id, id)).returning();
  res.json({ course: updated });
});

/** DELETE /api/marketplace/admin/courses/:id — delete a course (cascades to reviews) */
router.delete("/marketplace/admin/courses/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.delete(marketplaceCourses).where(eq(marketplaceCourses.id, id));
  res.json({ ok: true });
});

export default router;
