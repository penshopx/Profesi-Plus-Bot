/**
 * Tes keamanan endpoint admin marketplace (/api/marketplace/admin/courses).
 *
 * Menggunakan router marketplace ASLI (bukan salinan inline) dengan:
 *  - @clerk/express di-mock agar status login bisa dikontrol per-test
 *  - @workspace/db di-mock dengan store in-memory + interpreter eq/and/asc sederhana
 *
 * Yang diverifikasi:
 *  - Pengguna anonim (tanpa login) → 401 di semua endpoint admin (GET/POST/PATCH/DELETE)
 *  - Pengguna role="user" → 403 di semua endpoint admin
 *  - Admin valid → bisa list, create (201), update, dan delete kursus
 *  - Aksi non-admin tidak mengubah data (tidak ada kursus tercipta/berubah/terhapus)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Controlled auth state ─────────────────────────────────────────────────────

let currentClerkId: string | null = null;

vi.mock("@clerk/express", () => ({
  getAuth: () => (currentClerkId ? { userId: currentClerkId } : { userId: null }),
}));

// ── Mock rate limiter (pass-through) ─────────────────────────────────────────

vi.mock("../middlewares/rateLimiter", () => ({
  catalogRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

// ── In-memory DB mock ─────────────────────────────────────────────────────────
// Tables are sentinel objects whose column props are { tid, name }; the mocked
// drizzle-orm eq/and/isNotNull build row-predicates against those columns.

const hoisted = vi.hoisted(() => {
function makeTable(tid: string, cols: string[]) {
  const t: Record<string, any> = { __tid: tid };
  for (const c of cols) t[c] = { tid, name: c };
  return t;
}

const usersT = makeTable("users", ["id", "clerkId", "role", "name", "email"]);

const coursesT = makeTable("marketplace_courses", ["id", "title", "provider", "url", "sortOrder", "updatedAt"]);
const aiReviewsT = makeTable("marketplace_ai_reviews", ["id", "courseId"]);
const askomReviewsT = makeTable("marketplace_askom_reviews", ["id", "courseId"]);
const watchedT = makeTable("marketplace_watched", ["userId", "courseId"]);
const pkbT = makeTable("pkb_activities", ["userId", "marketplaceId"]);

const stores = new Map<string, Record<string, any>[]>();
function rowsOf(table: any): Record<string, any>[] {
  if (!stores.has(table.__tid)) stores.set(table.__tid, []);
  return stores.get(table.__tid)!;
}

let autoId = 1;

const mockDb = {
  select: (_fields?: any) => ({
    from: (table: any) => {
      const exec = (pred?: (r: any) => boolean) => {
        let out = rowsOf(table).filter((r) => (pred ? pred(r) : true));
        return out.map((r) => ({ ...r }));
      };
      const chain = (pred?: (r: any) => boolean): any => ({
        where: (p: any) => chain(p),
        orderBy: (..._o: any[]) => Promise.resolve(exec(pred)),
        limit: (n: number) => Promise.resolve(exec(pred).slice(0, n)),
        then: (res: any, rej: any) => Promise.resolve(exec(pred)).then(res, rej),
      });
      return chain();
    },
  }),
  insert: (table: any) => ({
    values: (v: Record<string, any>) => {
      const row = { id: v.id ?? autoId++, ...v };
      const doInsert = () => {
        rowsOf(table).push(row);
        return row;
      };
      return {
        returning: async () => [doInsert()],
        onConflictDoNothing: async () => {
          doInsert();
        },
      };
    },
  }),
  update: (table: any) => ({
    set: (patch: Record<string, any>) => ({
      where: (pred: (r: any) => boolean) => ({
        returning: async () => {
          const updated: any[] = [];
          for (const r of rowsOf(table)) {
            if (pred(r)) {
              Object.assign(r, patch);
              updated.push({ ...r });
            }
          }
          return updated;
        },
      }),
    }),
  }),
  delete: (table: any) => ({
    where: async (pred: (r: any) => boolean) => {
      const rows = rowsOf(table);
      stores.set(table.__tid, rows.filter((r) => !pred(r)));
    },
  }),
};

return { usersT, coursesT, aiReviewsT, askomReviewsT, watchedT, pkbT, stores, rowsOf, mockDb };
});

const { usersT, coursesT, stores, rowsOf } = hoisted;

vi.mock("@workspace/db", () => ({ db: hoisted.mockDb, users: hoisted.usersT }));
vi.mock("@workspace/db/schema", () => ({
  marketplaceCourses: hoisted.coursesT,
  marketplaceAiReviews: hoisted.aiReviewsT,
  marketplaceAskomReviews: hoisted.askomReviewsT,
  marketplaceWatched: hoisted.watchedT,
  pkbActivities: hoisted.pkbT,
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: any) => (row: any) => row[col.name] === val,
  and: (...preds: any[]) => (row: any) => preds.every((p) => p(row)),
  asc: (col: any) => col,
  isNotNull: (col: any) => (row: any) => row[col.name] != null,
}));

// ── App under test: the REAL router ──────────────────────────────────────────

import express from "express";
import request from "supertest";
import marketplaceRouter from "./marketplace";

const app = express();
app.use(express.json());
app.use("/api", marketplaceRouter);

// Seed users: admin + regular user
function seedUsers() {
  stores.set("users", [
    { id: 1, clerkId: "clerk_admin", role: "admin", name: "Admin", email: "a@x.id" },
    { id: 2, clerkId: "clerk_user", role: "user", name: "User", email: "u@x.id" },
  ]);
}

const asAdmin = () => (currentClerkId = "clerk_admin");
const asUser = () => (currentClerkId = "clerk_user");
const asAnon = () => (currentClerkId = null);

const VALID_COURSE = {
  id: "kursus-k3-dasar",
  title: "K3 Konstruksi Dasar",
  provider: "Balai Jasa Konstruksi",
  url: "https://example.com/k3",
};

beforeEach(() => {
  stores.clear();
  seedUsers();
  asAnon();
});

// ─── Anonim → 401 ─────────────────────────────────────────────────────────────

describe("endpoint admin — pengguna tidak login → 401", () => {
  it("GET /api/marketplace/admin/courses", async () => {
    const r = await request(app).get("/api/marketplace/admin/courses");
    expect(r.status).toBe(401);
  });

  it("POST /api/marketplace/admin/courses", async () => {
    const r = await request(app).post("/api/marketplace/admin/courses").send(VALID_COURSE);
    expect(r.status).toBe(401);
    expect(rowsOf(coursesT)).toHaveLength(0);
  });

  it("PATCH /api/marketplace/admin/courses/:id", async () => {
    rowsOf(coursesT).push({ ...VALID_COURSE });
    const r = await request(app)
      .patch(`/api/marketplace/admin/courses/${VALID_COURSE.id}`)
      .send({ title: "HACKED" });
    expect(r.status).toBe(401);
    expect(rowsOf(coursesT)[0].title).toBe(VALID_COURSE.title);
  });

  it("DELETE /api/marketplace/admin/courses/:id", async () => {
    rowsOf(coursesT).push({ ...VALID_COURSE });
    const r = await request(app).delete(`/api/marketplace/admin/courses/${VALID_COURSE.id}`);
    expect(r.status).toBe(401);
    expect(rowsOf(coursesT)).toHaveLength(1);
  });
});

// ─── Role user → 403 ──────────────────────────────────────────────────────────

describe("endpoint admin — role='user' → 403", () => {
  beforeEach(() => asUser());

  it("GET /api/marketplace/admin/courses", async () => {
    const r = await request(app).get("/api/marketplace/admin/courses");
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/admin/i);
  });

  it("POST /api/marketplace/admin/courses tidak membuat kursus", async () => {
    const r = await request(app).post("/api/marketplace/admin/courses").send(VALID_COURSE);
    expect(r.status).toBe(403);
    expect(rowsOf(coursesT)).toHaveLength(0);
  });

  it("PATCH /api/marketplace/admin/courses/:id tidak mengubah kursus", async () => {
    rowsOf(coursesT).push({ ...VALID_COURSE });
    const r = await request(app)
      .patch(`/api/marketplace/admin/courses/${VALID_COURSE.id}`)
      .send({ title: "HACKED" });
    expect(r.status).toBe(403);
    expect(rowsOf(coursesT)[0].title).toBe(VALID_COURSE.title);
  });

  it("DELETE /api/marketplace/admin/courses/:id tidak menghapus kursus", async () => {
    rowsOf(coursesT).push({ ...VALID_COURSE });
    const r = await request(app).delete(`/api/marketplace/admin/courses/${VALID_COURSE.id}`);
    expect(r.status).toBe(403);
    expect(rowsOf(coursesT)).toHaveLength(1);
  });

  it("juga memblokir endpoint review admin (ai & askom)", async () => {
    const rAi = await request(app)
      .post(`/api/marketplace/admin/courses/${VALID_COURSE.id}/ai-reviews`)
      .send({ platform: "x", platformIcon: "x", rating: 4, relevanceScore: 80, comment: "x", reviewedAt: "2026" });
    const rAskom = await request(app)
      .delete(`/api/marketplace/admin/courses/${VALID_COURSE.id}/askom-reviews/1`);
    expect(rAi.status).toBe(403);
    expect(rAskom.status).toBe(403);
  });
});

// ─── Admin valid → CRUD berhasil ─────────────────────────────────────────────

describe("endpoint admin — admin valid bisa CRUD", () => {
  beforeEach(() => asAdmin());

  it("POST membuat kursus baru (201)", async () => {
    const r = await request(app).post("/api/marketplace/admin/courses").send(VALID_COURSE);
    expect(r.status).toBe(201);
    expect(r.body.course).toMatchObject({ id: VALID_COURSE.id, title: VALID_COURSE.title });
    expect(rowsOf(coursesT)).toHaveLength(1);
  });

  it("POST menolak body tanpa field wajib (400)", async () => {
    const { url: _url, ...incomplete } = VALID_COURSE;
    const r = await request(app).post("/api/marketplace/admin/courses").send(incomplete);
    expect(r.status).toBe(400);
    expect(rowsOf(coursesT)).toHaveLength(0);
  });

  it("GET mengembalikan daftar kursus", async () => {
    await request(app).post("/api/marketplace/admin/courses").send(VALID_COURSE);
    const r = await request(app).get("/api/marketplace/admin/courses");
    expect(r.status).toBe(200);
    expect(r.body.courses).toHaveLength(1);
    expect(r.body.courses[0].id).toBe(VALID_COURSE.id);
  });

  it("PATCH memperbarui kursus yang ada", async () => {
    await request(app).post("/api/marketplace/admin/courses").send(VALID_COURSE);
    const r = await request(app)
      .patch(`/api/marketplace/admin/courses/${VALID_COURSE.id}`)
      .send({ title: "Judul Baru", isFeatured: true });
    expect(r.status).toBe(200);
    expect(r.body.course.title).toBe("Judul Baru");
    expect(r.body.course.isFeatured).toBe(true);
  });

  it("PATCH kursus tidak dikenal → 404", async () => {
    const r = await request(app)
      .patch("/api/marketplace/admin/courses/tidak-ada")
      .send({ title: "x" });
    expect(r.status).toBe(404);
  });

  it("DELETE menghapus kursus", async () => {
    await request(app).post("/api/marketplace/admin/courses").send(VALID_COURSE);
    const r = await request(app).delete(`/api/marketplace/admin/courses/${VALID_COURSE.id}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(rowsOf(coursesT)).toHaveLength(0);
  });
});
