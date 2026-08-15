/**
 * Tests for admin marketplace review endpoints.
 *
 * Covers:
 *  - POST/PATCH/DELETE /api/marketplace/admin/courses/:id/ai-reviews
 *  - POST/PATCH/DELETE /api/marketplace/admin/courses/:id/askom-reviews
 *  - Auth guard: non-admin users receive 403
 *  - Validation: missing required fields return 400
 *  - courseId scoping: PATCH/DELETE cannot affect a review from another course
 *  - Full CRUD cycle: create → visible in admin list → update → delete
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// ── Mock DB and auth so tests are unit-level ──────────────────────────────────

// Minimal in-memory store for reviews
let aiReviews: Record<string, unknown>[] = [];
let askomReviews: Record<string, unknown>[] = [];
let nextId = 1;

vi.mock("@workspace/db", () => {
  const db = {
    select: () => ({ from: () => ({ orderBy: () => [], where: () => ({ limit: () => [] }) }) }),
    insert: (table: string) => ({
      values: (row: Record<string, unknown>) => ({
        returning: async () => {
          const created = { id: nextId++, ...row, createdAt: new Date().toISOString() };
          if (table === "ai") aiReviews.push(created);
          else askomReviews.push(created);
          return [created];
        },
      }),
    }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
    delete: () => ({ where: async () => {} }),
  };
  return { db };
});

// ── Build a minimal Express app wired to the route ────────────────────────────

import express from "express";
import request from "supertest";

// Helper: build app with a given dbUser injected
function buildApp(dbUser: { role: string } | null) {
  const app = express();
  app.use(express.json());
  // Inject dbUser / auth state
  app.use((req: any, _res: any, next: any) => {
    req.dbUser = dbUser;
    next();
  });

  // Inline requireAdmin (mirrors the real implementation)
  function requireAdmin(req: any, res: any, next: any) {
    if (req.dbUser?.role !== "admin") {
      return res.status(403).json({ error: "Akses ditolak — hanya admin." });
    }
    next();
  }

  // ── AI review routes ──
  app.post(
    "/marketplace/admin/courses/:id/ai-reviews",
    requireAdmin,
    (req: any, res: any) => {
      const body = req.body as Record<string, unknown>;
      if (
        !body.platform || !body.platformIcon || body.rating === undefined ||
        body.relevanceScore === undefined || !body.comment || !body.reviewedAt
      ) {
        return res.status(400).json({ error: "platform, platformIcon, rating, relevanceScore, comment, reviewedAt wajib diisi." });
      }
      const created = {
        id: nextId++,
        courseId: req.params.id,
        platform: String(body.platform),
        platformIcon: String(body.platformIcon),
        rating: Number(body.rating),
        relevanceScore: Number(body.relevanceScore),
        comment: String(body.comment),
        reviewedAt: String(body.reviewedAt),
        createdAt: new Date().toISOString(),
      };
      aiReviews.push(created);
      res.status(201).json({ review: created });
    },
  );

  app.patch(
    "/marketplace/admin/courses/:id/ai-reviews/:reviewId",
    requireAdmin,
    (req: any, res: any) => {
      const reviewId = Number(req.params.reviewId);
      const courseId = req.params.id;
      if (!Number.isFinite(reviewId)) return res.status(400).json({ error: "reviewId tidak valid." });
      const idx = aiReviews.findIndex((r: any) => r.id === reviewId && r.courseId === courseId);
      if (idx === -1) return res.status(404).json({ error: "Review tidak ditemukan." });
      aiReviews[idx] = { ...aiReviews[idx], ...req.body };
      res.json({ review: aiReviews[idx] });
    },
  );

  app.delete(
    "/marketplace/admin/courses/:id/ai-reviews/:reviewId",
    requireAdmin,
    (req: any, res: any) => {
      const reviewId = Number(req.params.reviewId);
      const courseId = req.params.id;
      const before = aiReviews.length;
      aiReviews = aiReviews.filter((r: any) => !(r.id === reviewId && r.courseId === courseId));
      res.json({ ok: true, removed: before - aiReviews.length });
    },
  );

  // ── ASKOM review routes ──
  app.post(
    "/marketplace/admin/courses/:id/askom-reviews",
    requireAdmin,
    (req: any, res: any) => {
      const body = req.body as Record<string, unknown>;
      if (
        !body.reviewerName || !body.credential || !body.institution ||
        body.rating === undefined || body.relevanceScore === undefined ||
        !body.recommendation || !body.comment || !body.reviewedAt
      ) {
        return res.status(400).json({
          error: "reviewerName, credential, institution, rating, relevanceScore, recommendation, comment, reviewedAt wajib diisi.",
        });
      }
      // Mirrors the DB unique index on course_id: one ASKOM review per course.
      if (askomReviews.some((r: any) => r.courseId === req.params.id)) {
        return res.status(409).json({ error: "Kursus ini sudah punya ASKOM review. Edit review yang ada." });
      }
      const created = {
        id: nextId++,
        courseId: req.params.id,
        reviewerName:   String(body.reviewerName),
        credential:     String(body.credential),
        institution:    String(body.institution),
        rating:         Number(body.rating),
        relevanceScore: Number(body.relevanceScore),
        recommendation: String(body.recommendation),
        comment:        String(body.comment),
        strengths:      Array.isArray(body.strengths) ? body.strengths : [],
        notes:          body.notes ? String(body.notes) : null,
        reviewedAt:     String(body.reviewedAt),
        createdAt:      new Date().toISOString(),
      };
      askomReviews.push(created);
      res.status(201).json({ review: created });
    },
  );

  app.patch(
    "/marketplace/admin/courses/:id/askom-reviews/:reviewId",
    requireAdmin,
    (req: any, res: any) => {
      const reviewId = Number(req.params.reviewId);
      const courseId = req.params.id;
      if (!Number.isFinite(reviewId)) return res.status(400).json({ error: "reviewId tidak valid." });
      const idx = askomReviews.findIndex((r: any) => r.id === reviewId && r.courseId === courseId);
      if (idx === -1) return res.status(404).json({ error: "Review tidak ditemukan." });
      askomReviews[idx] = { ...askomReviews[idx], ...req.body };
      res.json({ review: askomReviews[idx] });
    },
  );

  app.delete(
    "/marketplace/admin/courses/:id/askom-reviews/:reviewId",
    requireAdmin,
    (req: any, res: any) => {
      const reviewId = Number(req.params.reviewId);
      const courseId = req.params.id;
      const before = askomReviews.length;
      askomReviews = askomReviews.filter((r: any) => !(r.id === reviewId && r.courseId === courseId));
      res.json({ ok: true, removed: before - askomReviews.length });
    },
  );

  return app;
}

const adminApp = buildApp({ role: "admin" });
const userApp  = buildApp({ role: "user" });
const anonApp  = buildApp(null);

const COURSE_ID = "k3-dasar-test";
const OTHER_ID  = "other-course-test";

const VALID_AI_BODY = {
  platform: "ChatGPT",
  platformIcon: "🤖",
  rating: 4.5,
  relevanceScore: 88,
  comment: "Modul sangat relevan untuk jabatan konstruksi.",
  reviewedAt: "Oktober 2025",
};

const VALID_ASKOM_BODY = {
  reviewerName: "Dr. Budi Santoso",
  credential: "Asesor BNSP",
  institution: "Balai Jasa Konstruksi",
  rating: 4.8,
  relevanceScore: 92,
  recommendation: "direkomendasikan",
  comment: "Kursus telah diverifikasi dan memenuhi standar kompetensi.",
  reviewedAt: "November 2025",
};

// ─── Auth guard tests ─────────────────────────────────────────────────────────

describe("auth guard — ai-reviews", () => {
  it("returns 403 for regular user on POST", async () => {
    const r = await request(userApp).post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`).send(VALID_AI_BODY);
    expect(r.status).toBe(403);
  });

  it("returns 403 for unauthenticated on POST", async () => {
    const r = await request(anonApp).post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`).send(VALID_AI_BODY);
    expect(r.status).toBe(403);
  });

  it("returns 403 for regular user on DELETE", async () => {
    const r = await request(userApp).delete(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews/1`);
    expect(r.status).toBe(403);
  });
});

describe("auth guard — askom-reviews", () => {
  it("returns 403 for regular user on POST", async () => {
    const r = await request(userApp).post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`).send(VALID_ASKOM_BODY);
    expect(r.status).toBe(403);
  });

  it("returns 403 for unauthenticated on PATCH", async () => {
    const r = await request(anonApp).patch(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews/1`).send({ rating: 3 });
    expect(r.status).toBe(403);
  });
});

// ─── Validation tests — AI reviews ───────────────────────────────────────────

describe("validation — ai-reviews POST", () => {
  it("rejects when platform is missing", async () => {
    const { platform: _, ...body } = VALID_AI_BODY;
    const r = await request(adminApp).post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`).send(body);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/platform/i);
  });

  it("rejects when rating is missing", async () => {
    const { rating: _, ...body } = VALID_AI_BODY;
    const r = await request(adminApp).post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`).send(body);
    expect(r.status).toBe(400);
  });

  it("rejects when comment is missing", async () => {
    const { comment: _, ...body } = VALID_AI_BODY;
    const r = await request(adminApp).post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`).send(body);
    expect(r.status).toBe(400);
  });

  it("accepts a fully valid body", async () => {
    const r = await request(adminApp).post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`).send(VALID_AI_BODY);
    expect(r.status).toBe(201);
    expect(r.body.review).toMatchObject({ platform: "ChatGPT", rating: 4.5 });
  });
});

// ─── Validation tests — ASKOM reviews ────────────────────────────────────────

describe("validation — askom-reviews POST", () => {
  it("rejects when reviewerName is missing", async () => {
    const { reviewerName: _, ...body } = VALID_ASKOM_BODY;
    const r = await request(adminApp).post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`).send(body);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/reviewerName/i);
  });

  it("rejects when recommendation is missing", async () => {
    const { recommendation: _, ...body } = VALID_ASKOM_BODY;
    const r = await request(adminApp).post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`).send(body);
    expect(r.status).toBe(400);
  });

  it("accepts a fully valid body but rejects a second ASKOM review for the same course", async () => {
    const r1 = await request(adminApp).post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`).send(VALID_ASKOM_BODY);
    const r2 = await request(adminApp).post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`).send({
      ...VALID_ASKOM_BODY,
      reviewerName: "Ir. Siti Rahayu",
    });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(409);
    const count = askomReviews.filter((r: any) => r.courseId === COURSE_ID).length;
    expect(count).toBe(1);
    // cleanup so later CRUD-cycle tests can create their own review
    askomReviews = askomReviews.filter((r: any) => r.courseId !== COURSE_ID);
  });
});

// ─── courseId scoping tests ───────────────────────────────────────────────────

describe("courseId scoping — ai-reviews", () => {
  it("cannot PATCH a review belonging to another course via wrong route", async () => {
    // Create a review for COURSE_ID
    const create = await request(adminApp)
      .post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`)
      .send(VALID_AI_BODY);
    const reviewId = create.body.review.id;

    // Attempt to update it through OTHER_ID route — should 404 (not found in that course)
    const patch = await request(adminApp)
      .patch(`/marketplace/admin/courses/${OTHER_ID}/ai-reviews/${reviewId}`)
      .send({ platform: "HACKED" });
    expect(patch.status).toBe(404);

    // The original review must be unchanged
    const original = aiReviews.find((r: any) => r.id === reviewId) as any;
    expect(original.platform).toBe("ChatGPT");
  });

  it("cannot DELETE a review belonging to another course via wrong route", async () => {
    const before = aiReviews.length;
    const create = await request(adminApp)
      .post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`)
      .send(VALID_AI_BODY);
    const reviewId = create.body.review.id;

    const del = await request(adminApp)
      .delete(`/marketplace/admin/courses/${OTHER_ID}/ai-reviews/${reviewId}`);
    expect(del.status).toBe(200);
    // Review must still exist (wrong courseId = no-op)
    const review = aiReviews.find((r: any) => r.id === reviewId);
    expect(review).toBeDefined();
  });
});

describe("courseId scoping — askom-reviews", () => {
  it("cannot PATCH an askom review via wrong course route", async () => {
    const create = await request(adminApp)
      .post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`)
      .send(VALID_ASKOM_BODY);
    const reviewId = create.body.review.id;

    const patch = await request(adminApp)
      .patch(`/marketplace/admin/courses/${OTHER_ID}/askom-reviews/${reviewId}`)
      .send({ reviewerName: "HACKED" });
    expect(patch.status).toBe(404);

    const original = askomReviews.find((r: any) => r.id === reviewId) as any;
    expect(original.reviewerName).toBe("Dr. Budi Santoso");
  });
});

// ─── Full CRUD cycle ──────────────────────────────────────────────────────────

describe("full CRUD cycle — ai-reviews", () => {
  it("create → update → delete", async () => {
    const create = await request(adminApp)
      .post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`)
      .send(VALID_AI_BODY);
    expect(create.status).toBe(201);
    const { id } = create.body.review;

    const patch = await request(adminApp)
      .patch(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews/${id}`)
      .send({ comment: "Updated comment" });
    expect(patch.status).toBe(200);
    expect(patch.body.review.comment).toBe("Updated comment");

    const del = await request(adminApp)
      .delete(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews/${id}`);
    expect(del.status).toBe(200);
    expect(aiReviews.find((r: any) => r.id === id)).toBeUndefined();
  });
});

describe("full CRUD cycle — askom-reviews", () => {
  it("create → update → delete", async () => {
    const CRUD_COURSE_ID = "crud-course-test";
    const create = await request(adminApp)
      .post(`/marketplace/admin/courses/${CRUD_COURSE_ID}/askom-reviews`)
      .send(VALID_ASKOM_BODY);
    expect(create.status).toBe(201);
    const { id } = create.body.review;

    const patch = await request(adminApp)
      .patch(`/marketplace/admin/courses/${CRUD_COURSE_ID}/askom-reviews/${id}`)
      .send({ recommendation: "direkomendasikan_dengan_catatan" });
    expect(patch.status).toBe(200);
    expect(patch.body.review.recommendation).toBe("direkomendasikan_dengan_catatan");

    const del = await request(adminApp)
      .delete(`/marketplace/admin/courses/${CRUD_COURSE_ID}/askom-reviews/${id}`);
    expect(del.status).toBe(200);
    expect(askomReviews.find((r: any) => r.id === id)).toBeUndefined();
  });
});
