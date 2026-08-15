/**
 * Tests the REAL marketplace router's one-ASKOM-review-per-course invariant.
 *
 * The route relies on the DB unique index `marketplace_askom_reviews_course_uidx`
 * plus an atomic `onConflictDoNothing().returning()` insert. Here the @workspace/db
 * mock reproduces that unique-index semantics atomically (synchronous check+insert
 * inside `returning()`), so we can prove:
 *   - a second sequential POST yields 409
 *   - two SIMULTANEOUS POSTs yield exactly one 201 + one 409 and one stored row
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory table with unique(courseId) semantics
let rows: any[] = [];
let nextId = 1;

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.dbUser = { id: 1, role: "admin" };
    next();
  },
}));

vi.mock("../middlewares/rateLimiter", () => ({
  catalogRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("@workspace/db", () => {
  const db = {
    select: () => ({
      from: () => ({
        orderBy: async () => [],
        where: () => ({ limit: async () => [] }),
      }),
    }),
    insert: (_table: any) => ({
      values: (row: any) => ({
        // The check + insert happen synchronously in one tick, mirroring the
        // atomicity the Postgres unique index provides.
        onConflictDoNothing: (_opts: any) => ({
          returning: async () => {
            if (rows.some((r) => r.courseId === row.courseId)) return [];
            const created = { id: nextId++, ...row };
            rows.push(created);
            return [created];
          },
        }),
        returning: async () => {
          const created = { id: nextId++, ...row };
          rows.push(created);
          return [created];
        },
      }),
    }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
    delete: () => ({ where: async () => {} }),
  };
  return { db };
});

vi.mock("@workspace/db/schema", () => ({
  marketplaceWatched: {},
  marketplaceCourses: {},
  marketplaceAiReviews: { id: "id", courseId: "courseId" },
  marketplaceAskomReviews: { id: "id", courseId: "courseId" },
  pkbActivities: {},
}));

import express from "express";
import request from "supertest";
import marketplaceRouter from "../routes/marketplace";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(marketplaceRouter);
  return app;
}

const VALID_BODY = {
  reviewerName: "Dr. Budi Santoso",
  credential: "Asesor BNSP",
  institution: "Balai Jasa Konstruksi",
  rating: 4.8,
  relevanceScore: 92,
  recommendation: "direkomendasikan",
  comment: "Memenuhi standar kompetensi.",
  reviewedAt: "November 2025",
};

beforeEach(() => {
  rows = [];
  nextId = 1;
});

describe("one ASKOM review per course (real router)", () => {
  it("second sequential POST returns 409 and does not store a duplicate", async () => {
    const app = buildApp();
    const r1 = await request(app).post("/marketplace/admin/courses/c1/askom-reviews").send(VALID_BODY);
    const r2 = await request(app).post("/marketplace/admin/courses/c1/askom-reviews").send(VALID_BODY);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(409);
    expect(rows.filter((r) => r.courseId === "c1")).toHaveLength(1);
  });

  it("simultaneous POSTs yield exactly one 201, one 409, one stored row", async () => {
    const app = buildApp();
    const [a, b] = await Promise.all([
      request(app).post("/marketplace/admin/courses/c1/askom-reviews").send(VALID_BODY),
      request(app).post("/marketplace/admin/courses/c1/askom-reviews").send({ ...VALID_BODY, reviewerName: "Ir. Siti Rahayu" }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(rows.filter((r) => r.courseId === "c1")).toHaveLength(1);
  });

  it("different courses can each have their own ASKOM review", async () => {
    const app = buildApp();
    const r1 = await request(app).post("/marketplace/admin/courses/c1/askom-reviews").send(VALID_BODY);
    const r2 = await request(app).post("/marketplace/admin/courses/c2/askom-reviews").send(VALID_BODY);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(rows).toHaveLength(2);
  });
});
