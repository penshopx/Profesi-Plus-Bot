/**
 * Tests for the REAL admin marketplace review endpoints (routes/marketplace.ts).
 *
 * Covers:
 *  - Auth guard: non-admin users get 403 on POST/PATCH/DELETE for both
 *    ai-reviews and askom-reviews; unauthenticated requests get 401.
 *  - Validation: missing required fields return 400.
 *  - Malformed ratings: non-numeric or out-of-range rating/relevanceScore → 400
 *    on both POST and PATCH.
 *  - courseId scoping: PATCH/DELETE cannot affect a review from another course.
 *  - Full CRUD cycle: create → visible in admin course list → update → delete.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted in-memory state shared with the mocks ─────────────────────────────

const state = vi.hoisted(() => ({
  stores: {
    courses: [] as any[],
    ai: [] as any[],
    askom: [] as any[],
    watched: [] as any[],
    pkb: [] as any[],
  } as Record<string, any[]>,
  nextId: 1,
  currentUser: null as { id: number; role: string } | null,
}));

// ── Auth / rate-limit mocks ───────────────────────────────────────────────────

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!state.currentUser) return res.status(401).json({ error: "Unauthenticated" });
    req.dbUser = state.currentUser;
    next();
  },
}));

vi.mock("../middlewares/rateLimiter", () => ({
  catalogRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

// ── Schema + drizzle-orm mocks (predicate descriptors) ────────────────────────

vi.mock("@workspace/db/schema", () => ({
  marketplaceWatched: { __t: "watched", userId: "userId", courseId: "courseId" },
  marketplaceCourses: { __t: "courses", id: "id", sortOrder: "sortOrder" },
  marketplaceAiReviews: { __t: "ai", id: "id", courseId: "courseId" },
  marketplaceAskomReviews: { __t: "askom", id: "id", courseId: "courseId" },
  pkbActivities: { __t: "pkb", userId: "userId", marketplaceId: "marketplaceId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (field: any, value: any) => ({ kind: "eq", field, value }),
  and: (...conds: any[]) => ({ kind: "and", conds }),
  asc: (f: any) => f,
  isNotNull: (field: any) => ({ kind: "notnull", field }),
}));

// ── DB mock backed by in-memory tables ────────────────────────────────────────

vi.mock("@workspace/db", () => {
  const matches = (row: any, cond: any): boolean => {
    if (!cond) return true;
    if (cond.kind === "and") return cond.conds.every((c: any) => matches(row, c));
    if (cond.kind === "eq") return row[cond.field] === cond.value;
    if (cond.kind === "notnull") return row[cond.field] != null;
    return true;
  };
  const tbl = (t: any) => state.stores[t.__t];

  const db = {
    select: (_fields?: any) => ({
      from: (t: any) => {
        const rows = tbl(t);
        const whereChain = (cond: any) => {
          const filtered = rows.filter((r) => matches(r, cond));
          return {
            then: (res: any, rej: any) => Promise.resolve([...filtered]).then(res, rej),
            limit: async (n: number) => filtered.slice(0, n),
          };
        };
        return {
          then: (res: any, rej: any) => Promise.resolve([...rows]).then(res, rej),
          orderBy: async () => [...rows],
          where: whereChain,
        };
      },
    }),
    insert: (t: any) => ({
      values: (row: any) => {
        const doInsert = () => {
          const created = { id: state.nextId++, ...row };
          tbl(t).push(created);
          return created;
        };
        return {
          returning: async () => [doInsert()],
          onConflictDoNothing: (_opts?: any) => ({
            returning: async () => {
              if (t.__t === "askom" && tbl(t).some((r) => r.courseId === row.courseId)) return [];
              return [doInsert()];
            },
            then: (res: any, rej: any) => {
              if (
                t.__t === "watched" &&
                tbl(t).some((r) => r.userId === row.userId && r.courseId === row.courseId)
              ) {
                return Promise.resolve().then(res, rej);
              }
              doInsert();
              return Promise.resolve().then(res, rej);
            },
          }),
        };
      },
    }),
    update: (t: any) => ({
      set: (patch: any) => ({
        where: (cond: any) => ({
          returning: async () => {
            const rows = tbl(t);
            const out: any[] = [];
            for (let i = 0; i < rows.length; i++) {
              if (matches(rows[i], cond)) {
                rows[i] = { ...rows[i], ...patch };
                out.push(rows[i]);
              }
            }
            return out;
          },
        }),
      }),
    }),
    delete: (t: any) => ({
      where: (cond: any) => {
        state.stores[t.__t] = tbl(t).filter((r) => !matches(r, cond));
        return Promise.resolve();
      },
    }),
  };
  return { db };
});

// ── App wired to the REAL router ──────────────────────────────────────────────

import express from "express";
import request from "supertest";
import marketplaceRouter from "../routes/marketplace";

const app = express();
app.use(express.json());
app.use(marketplaceRouter);

const ADMIN = { id: 1, role: "admin" };
const USER = { id: 2, role: "user" };

const COURSE_ID = "k3-dasar-test";
const OTHER_ID = "other-course-test";

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

beforeEach(() => {
  state.stores.courses = [
    { id: COURSE_ID, title: "K3 Dasar", provider: "Test", url: "https://x", sortOrder: 0 },
    { id: OTHER_ID, title: "Lainnya", provider: "Test", url: "https://y", sortOrder: 1 },
  ];
  state.stores.ai = [];
  state.stores.askom = [];
  state.stores.watched = [];
  state.stores.pkb = [];
  state.nextId = 1;
  state.currentUser = ADMIN;
});

// ─── Auth guard ───────────────────────────────────────────────────────────────

describe("auth guard — ai-reviews", () => {
  it("returns 403 for regular user on POST/PATCH/DELETE", async () => {
    state.currentUser = USER;
    const post = await request(app).post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`).send(VALID_AI_BODY);
    const patch = await request(app).patch(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews/1`).send({ rating: 3 });
    const del = await request(app).delete(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews/1`);
    expect(post.status).toBe(403);
    expect(patch.status).toBe(403);
    expect(del.status).toBe(403);
    expect(state.stores.ai).toHaveLength(0);
  });

  it("returns 401 for unauthenticated on POST", async () => {
    state.currentUser = null;
    const r = await request(app).post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`).send(VALID_AI_BODY);
    expect(r.status).toBe(401);
  });
});

describe("auth guard — askom-reviews", () => {
  it("returns 403 for regular user on POST/PATCH/DELETE", async () => {
    state.currentUser = USER;
    const post = await request(app).post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`).send(VALID_ASKOM_BODY);
    const patch = await request(app).patch(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews/1`).send({ rating: 3 });
    const del = await request(app).delete(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews/1`);
    expect(post.status).toBe(403);
    expect(patch.status).toBe(403);
    expect(del.status).toBe(403);
    expect(state.stores.askom).toHaveLength(0);
  });

  it("returns 401 for unauthenticated on PATCH", async () => {
    state.currentUser = null;
    const r = await request(app).patch(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews/1`).send({ rating: 3 });
    expect(r.status).toBe(401);
  });
});

// ─── Validation: required fields ──────────────────────────────────────────────

describe("validation — ai-reviews POST required fields", () => {
  for (const field of ["platform", "platformIcon", "rating", "relevanceScore", "comment", "reviewedAt"] as const) {
    it(`rejects when ${field} is missing`, async () => {
      const body: any = { ...VALID_AI_BODY };
      delete body[field];
      const r = await request(app).post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`).send(body);
      expect(r.status).toBe(400);
      expect(state.stores.ai).toHaveLength(0);
    });
  }
});

describe("validation — askom-reviews POST required fields", () => {
  for (const field of ["reviewerName", "credential", "institution", "rating", "relevanceScore", "recommendation", "comment", "reviewedAt"] as const) {
    it(`rejects when ${field} is missing`, async () => {
      const body: any = { ...VALID_ASKOM_BODY };
      delete body[field];
      const r = await request(app).post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`).send(body);
      expect(r.status).toBe(400);
      expect(state.stores.askom).toHaveLength(0);
    });
  }
});

// ─── Validation: malformed ratings ────────────────────────────────────────────

describe("malformed ratings", () => {
  it.each([
    ["non-numeric rating", { rating: "abc" }],
    ["rating below 0", { rating: -1 }],
    ["rating above 5", { rating: 5.1 }],
    ["non-numeric relevanceScore", { relevanceScore: "high" }],
    ["relevanceScore below 0", { relevanceScore: -5 }],
    ["relevanceScore above 100", { relevanceScore: 101 }],
  ])("ai-reviews POST rejects %s", async (_label, overrides) => {
    const r = await request(app)
      .post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`)
      .send({ ...VALID_AI_BODY, ...overrides });
    expect(r.status).toBe(400);
    expect(state.stores.ai).toHaveLength(0);
  });

  it.each([
    ["non-numeric rating", { rating: "abc" }],
    ["rating above 5", { rating: 99 }],
    ["relevanceScore above 100", { relevanceScore: 1000 }],
  ])("askom-reviews POST rejects %s", async (_label, overrides) => {
    const r = await request(app)
      .post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`)
      .send({ ...VALID_ASKOM_BODY, ...overrides });
    expect(r.status).toBe(400);
    expect(state.stores.askom).toHaveLength(0);
  });

  it("ai-reviews PATCH rejects out-of-range rating and leaves row unchanged", async () => {
    const create = await request(app).post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`).send(VALID_AI_BODY);
    const { id } = create.body.review;
    const r = await request(app).patch(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews/${id}`).send({ rating: 42 });
    expect(r.status).toBe(400);
    expect(state.stores.ai.find((x) => x.id === id)!.rating).toBe(4.5);
  });

  it("askom-reviews PATCH rejects non-numeric rating", async () => {
    const create = await request(app).post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`).send(VALID_ASKOM_BODY);
    const { id } = create.body.review;
    const r = await request(app).patch(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews/${id}`).send({ rating: "lima" });
    expect(r.status).toBe(400);
    expect(state.stores.askom.find((x) => x.id === id)!.rating).toBe(4.8);
  });

  it("accepts boundary values (rating 0 and 5, relevanceScore 0 and 100)", async () => {
    const r1 = await request(app)
      .post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`)
      .send({ ...VALID_AI_BODY, rating: 5, relevanceScore: 100 });
    const r2 = await request(app)
      .post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`)
      .send({ ...VALID_AI_BODY, rating: 0.5, relevanceScore: 1 });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });

  it("rejects invalid reviewId (NaN) with 400", async () => {
    const patch = await request(app).patch(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews/abc`).send({ rating: 4 });
    const del = await request(app).delete(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews/xyz`);
    expect(patch.status).toBe(400);
    expect(del.status).toBe(400);
  });
});

// ─── One ASKOM review per course ──────────────────────────────────────────────

describe("askom uniqueness", () => {
  it("second POST for the same course returns 409", async () => {
    const r1 = await request(app).post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`).send(VALID_ASKOM_BODY);
    const r2 = await request(app)
      .post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`)
      .send({ ...VALID_ASKOM_BODY, reviewerName: "Ir. Siti Rahayu" });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(409);
    expect(state.stores.askom.filter((r) => r.courseId === COURSE_ID)).toHaveLength(1);
  });
});

// ─── courseId scoping ─────────────────────────────────────────────────────────

describe("courseId scoping", () => {
  it("PATCH via wrong course route returns 404 and leaves the review unchanged", async () => {
    const create = await request(app).post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`).send(VALID_AI_BODY);
    const { id } = create.body.review;
    const patch = await request(app)
      .patch(`/marketplace/admin/courses/${OTHER_ID}/ai-reviews/${id}`)
      .send({ platform: "HACKED" });
    expect(patch.status).toBe(404);
    expect(state.stores.ai.find((r) => r.id === id)!.platform).toBe("ChatGPT");
  });

  it("DELETE via wrong course route is a no-op", async () => {
    const create = await request(app).post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`).send(VALID_ASKOM_BODY);
    const { id } = create.body.review;
    await request(app).delete(`/marketplace/admin/courses/${OTHER_ID}/askom-reviews/${id}`);
    expect(state.stores.askom.find((r) => r.id === id)).toBeDefined();
  });
});

// ─── Full CRUD cycle against the real router ─────────────────────────────────

describe("full CRUD cycle — ai-reviews", () => {
  it("create → appears in admin course list → update → delete", async () => {
    const create = await request(app).post(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews`).send(VALID_AI_BODY);
    expect(create.status).toBe(201);
    const { id } = create.body.review;

    const list = await request(app).get("/marketplace/admin/courses");
    expect(list.status).toBe(200);
    const course = list.body.courses.find((c: any) => c.id === COURSE_ID);
    expect(course.aiReviews).toHaveLength(1);
    expect(course.aiReviews[0]).toMatchObject({ id, platform: "ChatGPT", rating: 4.5 });

    const patch = await request(app)
      .patch(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews/${id}`)
      .send({ comment: "Updated comment", rating: 4 });
    expect(patch.status).toBe(200);
    expect(patch.body.review.comment).toBe("Updated comment");
    expect(patch.body.review.rating).toBe(4);

    const del = await request(app).delete(`/marketplace/admin/courses/${COURSE_ID}/ai-reviews/${id}`);
    expect(del.status).toBe(200);
    expect(state.stores.ai.find((r) => r.id === id)).toBeUndefined();
  });
});

describe("full CRUD cycle — askom-reviews", () => {
  it("create → appears in admin course list → update → delete", async () => {
    const create = await request(app).post(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews`).send(VALID_ASKOM_BODY);
    expect(create.status).toBe(201);
    const { id } = create.body.review;

    const list = await request(app).get("/marketplace/admin/courses");
    const course = list.body.courses.find((c: any) => c.id === COURSE_ID);
    expect(course.askomReviews).toHaveLength(1);
    expect(course.askomReviews[0]).toMatchObject({ id, reviewerName: "Dr. Budi Santoso" });

    const patch = await request(app)
      .patch(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews/${id}`)
      .send({ recommendation: "direkomendasikan_dengan_catatan" });
    expect(patch.status).toBe(200);
    expect(patch.body.review.recommendation).toBe("direkomendasikan_dengan_catatan");

    const del = await request(app).delete(`/marketplace/admin/courses/${COURSE_ID}/askom-reviews/${id}`);
    expect(del.status).toBe(200);
    expect(state.stores.askom.find((r) => r.id === id)).toBeUndefined();
  });
});
