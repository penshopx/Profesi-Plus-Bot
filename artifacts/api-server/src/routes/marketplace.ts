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
  const askomListMap = new Map<string, typeof askomReviews>();
  for (const r of askomReviews) {
    if (!askomListMap.has(r.courseId)) askomListMap.set(r.courseId, []);
    askomListMap.get(r.courseId)!.push(r);
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
      askomReviews: (askomListMap.get(c.id) ?? []).map((a) => ({
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
      })),
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

/** GET /api/marketplace/admin/courses — list all courses with their reviews */
router.get("/marketplace/admin/courses", requireAuth, requireAdmin, async (_req, res) => {
  const [courses, aiReviews, askomReviews] = await Promise.all([
    db.select().from(marketplaceCourses).orderBy(asc(marketplaceCourses.sortOrder)),
    db.select().from(marketplaceAiReviews).orderBy(asc(marketplaceAiReviews.id)),
    db.select().from(marketplaceAskomReviews).orderBy(asc(marketplaceAskomReviews.id)),
  ]);
  const aiMap = new Map<string, typeof aiReviews>();
  for (const r of aiReviews) {
    if (!aiMap.has(r.courseId)) aiMap.set(r.courseId, []);
    aiMap.get(r.courseId)!.push(r);
  }
  const askomMap = new Map<string, typeof askomReviews>();
  for (const r of askomReviews) {
    if (!askomMap.has(r.courseId)) askomMap.set(r.courseId, []);
    askomMap.get(r.courseId)!.push(r);
  }
  const result = courses.map((c) => ({
    ...c,
    aiReviews: aiMap.get(c.id) ?? [],
    askomReviews: askomMap.get(c.id) ?? [],
  }));
  res.json({ courses: result });
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

// ─── ADMIN: AI Reviews ────────────────────────────────────────────────────────

/** POST /api/marketplace/admin/courses/:id/ai-reviews — add an AI review */
router.post("/marketplace/admin/courses/:id/ai-reviews", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  if (!body.platform || !body.platformIcon || body.rating === undefined ||
      body.relevanceScore === undefined || !body.comment || !body.reviewedAt) {
    res.status(400).json({ error: "platform, platformIcon, rating, relevanceScore, comment, reviewedAt wajib diisi." });
    return;
  }
  const [created] = await db.insert(marketplaceAiReviews).values({
    courseId: id,
    platform: String(body.platform),
    platformIcon: String(body.platformIcon),
    rating: Number(body.rating),
    relevanceScore: Number(body.relevanceScore),
    comment: String(body.comment),
    reviewedAt: String(body.reviewedAt),
  }).returning();
  res.status(201).json({ review: created });
});

/** PATCH /api/marketplace/admin/courses/:id/ai-reviews/:reviewId */
router.patch("/marketplace/admin/courses/:id/ai-reviews/:reviewId", requireAuth, requireAdmin, async (req, res) => {
  const { id: courseId } = req.params;
  const reviewId = Number(req.params.reviewId);
  if (!Number.isFinite(reviewId)) { res.status(400).json({ error: "reviewId tidak valid." }); return; }
  const body = req.body as Record<string, unknown>;
  const patch: Partial<typeof marketplaceAiReviews.$inferInsert> = {};
  if (body.platform !== undefined)       patch.platform       = String(body.platform);
  if (body.platformIcon !== undefined)   patch.platformIcon   = String(body.platformIcon);
  if (body.rating !== undefined)         patch.rating         = Number(body.rating);
  if (body.relevanceScore !== undefined) patch.relevanceScore = Number(body.relevanceScore);
  if (body.comment !== undefined)        patch.comment        = String(body.comment);
  if (body.reviewedAt !== undefined)     patch.reviewedAt     = String(body.reviewedAt);
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "Tidak ada field yang diperbarui." }); return; }
  const [updated] = await db.update(marketplaceAiReviews).set(patch)
    .where(and(eq(marketplaceAiReviews.id, reviewId), eq(marketplaceAiReviews.courseId, courseId))).returning();
  if (!updated) { res.status(404).json({ error: "Review tidak ditemukan." }); return; }
  res.json({ review: updated });
});

/** DELETE /api/marketplace/admin/courses/:id/ai-reviews/:reviewId */
router.delete("/marketplace/admin/courses/:id/ai-reviews/:reviewId", requireAuth, requireAdmin, async (req, res) => {
  const { id: courseId } = req.params;
  const reviewId = Number(req.params.reviewId);
  if (!Number.isFinite(reviewId)) { res.status(400).json({ error: "reviewId tidak valid." }); return; }
  await db.delete(marketplaceAiReviews)
    .where(and(eq(marketplaceAiReviews.id, reviewId), eq(marketplaceAiReviews.courseId, courseId)));
  res.json({ ok: true });
});

// ─── ADMIN: ASKOM Reviews ─────────────────────────────────────────────────────

/** POST /api/marketplace/admin/courses/:id/askom-reviews — add an ASKOM endorsement */
router.post("/marketplace/admin/courses/:id/askom-reviews", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  if (!body.reviewerName || !body.credential || !body.institution ||
      body.rating === undefined || body.relevanceScore === undefined ||
      !body.recommendation || !body.comment || !body.reviewedAt) {
    res.status(400).json({ error: "reviewerName, credential, institution, rating, relevanceScore, recommendation, comment, reviewedAt wajib diisi." });
    return;
  }
  const [created] = await db.insert(marketplaceAskomReviews).values({
    courseId: id,
    reviewerName:     String(body.reviewerName),
    credential:       String(body.credential),
    institution:      String(body.institution),
    credentialNumber: body.credentialNumber ? String(body.credentialNumber) : null,
    rating:           Number(body.rating),
    relevanceScore:   Number(body.relevanceScore),
    recommendation:   String(body.recommendation),
    comment:          String(body.comment),
    strengths:        Array.isArray(body.strengths) ? body.strengths.map(String) : [],
    notes:            body.notes ? String(body.notes) : null,
    reviewedAt:       String(body.reviewedAt),
  }).returning();
  res.status(201).json({ review: created });
});

/** PATCH /api/marketplace/admin/courses/:id/askom-reviews/:reviewId */
router.patch("/marketplace/admin/courses/:id/askom-reviews/:reviewId", requireAuth, requireAdmin, async (req, res) => {
  const { id: courseId } = req.params;
  const reviewId = Number(req.params.reviewId);
  if (!Number.isFinite(reviewId)) { res.status(400).json({ error: "reviewId tidak valid." }); return; }
  const body = req.body as Record<string, unknown>;
  const patch: Partial<typeof marketplaceAskomReviews.$inferInsert> = {};
  if (body.reviewerName !== undefined)     patch.reviewerName     = String(body.reviewerName);
  if (body.credential !== undefined)       patch.credential       = String(body.credential);
  if (body.institution !== undefined)      patch.institution      = String(body.institution);
  if (body.credentialNumber !== undefined) patch.credentialNumber = body.credentialNumber ? String(body.credentialNumber) : null;
  if (body.rating !== undefined)           patch.rating           = Number(body.rating);
  if (body.relevanceScore !== undefined)   patch.relevanceScore   = Number(body.relevanceScore);
  if (body.recommendation !== undefined)   patch.recommendation   = String(body.recommendation);
  if (body.comment !== undefined)          patch.comment          = String(body.comment);
  if (Array.isArray(body.strengths))       patch.strengths        = body.strengths.map(String);
  if (body.notes !== undefined)            patch.notes            = body.notes ? String(body.notes) : null;
  if (body.reviewedAt !== undefined)       patch.reviewedAt       = String(body.reviewedAt);
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "Tidak ada field yang diperbarui." }); return; }
  const [updated] = await db.update(marketplaceAskomReviews).set(patch)
    .where(and(eq(marketplaceAskomReviews.id, reviewId), eq(marketplaceAskomReviews.courseId, courseId))).returning();
  if (!updated) { res.status(404).json({ error: "Review tidak ditemukan." }); return; }
  res.json({ review: updated });
});

/** DELETE /api/marketplace/admin/courses/:id/askom-reviews/:reviewId */
router.delete("/marketplace/admin/courses/:id/askom-reviews/:reviewId", requireAuth, requireAdmin, async (req, res) => {
  const { id: courseId } = req.params;
  const reviewId = Number(req.params.reviewId);
  if (!Number.isFinite(reviewId)) { res.status(400).json({ error: "reviewId tidak valid." }); return; }
  await db.delete(marketplaceAskomReviews)
    .where(and(eq(marketplaceAskomReviews.id, reviewId), eq(marketplaceAskomReviews.courseId, courseId)));
  res.json({ ok: true });
});

export default router;
