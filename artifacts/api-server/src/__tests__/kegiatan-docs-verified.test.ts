/**
 * Verified-activity document immutability
 *
 * Ensures that POST /kegiatan/:id/docs and DELETE /kegiatan/:id/docs/:docId
 * return HTTP 403 when the activity status is "diverifikasi", and that no
 * database mutation actually occurs.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock ────────────────────────────────────────────────────────────────────

const mockInsert = vi.fn();
const mockDelete = vi.fn();

// Track what the mock select returns per call
let selectCallCount = 0;
const selectResponses: unknown[][] = [];

vi.mock("@workspace/db", () => {
  function chainFor(resolveWith: unknown) {
    const c: Record<string, unknown> = {};
    c["then"] = (res: (v: unknown) => void) => Promise.resolve(resolveWith).then(res);
    for (const m of ["from", "where", "limit", "orderBy", "set", "returning", "values"]) {
      c[m] = vi.fn().mockReturnValue(c);
    }
    return c;
  }

  const dbMock = {
    select: vi.fn().mockImplementation(() => {
      const idx = selectCallCount++;
      const row = selectResponses[idx] ?? [];
      return chainFor(row);
    }),
    insert: vi.fn().mockImplementation(() => {
      mockInsert();
      return chainFor([]);
    }),
    delete: vi.fn().mockImplementation(() => {
      mockDelete();
      return chainFor([]);
    }),
    update: vi.fn().mockReturnValue(chainFor([])),
  };

  return {
    db: dbMock,
    pkbActivities:     { id: "id", userId: "userId", status: "status" },
    pkbActivitySkk:    { activityId: "activityId" },
    pkbActivityDocs:   { activityId: "activityId", id: "id" },
    pkbActivityJourney:{ activityId: "activityId", createdAt: "createdAt" },
    marketplaceWatches:{},
    KEGIATAN_STATUS: ["draft","lengkap","diajukan","diverifikasi","ditolak"],
  };
});

vi.mock("drizzle-orm", () => ({
  eq:      vi.fn().mockReturnValue({}),
  and:     vi.fn().mockReturnValue({}),
  desc:    vi.fn().mockReturnValue({}),
  inArray: vi.fn().mockReturnValue({}),
  sql:     vi.fn().mockReturnValue({}),
}));

// ── Upload token store — always valid ─────────────────────────────────────────

vi.mock("../lib/uploadTokenStore.js", () => ({
  consumeUploadToken: vi.fn().mockReturnValue(true),
  issueUploadToken:   vi.fn(),
}));

// ── Auth middleware ────────────────────────────────────────────────────────────

vi.mock("../middlewares/auth.js", () => ({
  requireAuth: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).auth = { userId: "clerk_user_1" };
    (req as any).log  = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    next();
  }),
  requireRole: vi.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
}));

// ── App setup ─────────────────────────────────────────────────────────────────

async function buildApp() {
  const app = express();
  app.use(express.json());
  const { default: kegiatanRouter } = await import("../routes/kegiatan.js");
  app.use("/api", kegiatanRouter);
  return app;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** The db.select mock returns rows in call order; prime two calls:
 *  1st: getUserId → returns a user row
 *  2nd: fetch the activity → returns an activity row with given status
 */
function primeSelects(activityStatus: string) {
  selectCallCount = 0;
  selectResponses.length = 0;
  // getUserId call
  selectResponses.push([{ id: 42 }]);
  // activity ownership + status check
  selectResponses.push([{ id: 99, status: activityStatus }]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/kegiatan/:id/docs — verified activity", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("returns 403 and does not insert when status is diverifikasi", async () => {
    primeSelects("diverifikasi");

    const res = await request(app)
      .post("/api/kegiatan/99/docs")
      .send({
        docType:    "surat_undangan",
        filename:   "undangan.pdf",
        objectPath: "/pkb/user42/undangan.pdf",
        mimeType:   "application/pdf",
        sizeBytes:  12345,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/diverifikasi/i);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 201 and inserts when status is lengkap", async () => {
    primeSelects("lengkap");

    const res = await request(app)
      .post("/api/kegiatan/99/docs")
      .send({
        docType:    "foto",
        filename:   "foto.jpg",
        objectPath: "/pkb/user42/foto.jpg",
        mimeType:   "image/jpeg",
        sizeBytes:  8000,
      });

    // 201 expected (insert ran); db.insert chain resolves to [] so no actual doc
    // but the route reached the insert path
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalled();
  });
});

describe("DELETE /api/kegiatan/:id/docs/:docId — verified activity", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("returns 403 and does not delete when status is diverifikasi", async () => {
    primeSelects("diverifikasi");

    const res = await request(app)
      .delete("/api/kegiatan/99/docs/7");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/diverifikasi/i);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns 200 and deletes when status is draft", async () => {
    primeSelects("draft");

    const res = await request(app)
      .delete("/api/kegiatan/99/docs/7");

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
  });
});
