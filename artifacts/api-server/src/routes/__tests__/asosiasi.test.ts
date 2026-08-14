/**
 * POST /asosiasi/submissions/:id/checklist
 *
 * Covers:
 * - Happy path: all 4 items checked → status "diverifikasi" + journey entry inserted
 * - Rejection path: 1 item unchecked → status "ditolak", catatan required (400 without it)
 * - 400 when the activity has not been submitted yet (status "draft")
 * - Atomicity: all three writes run inside db.transaction; a failure mid-way
 *   surfaces as an error (rollback) instead of leaving a partial state
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Push fetch mock ───────────────────────────────────────────────────────────

global.fetch = vi.fn(async () => ({
  ok: true,
  json: async () => ({ data: [{ status: "ok" }] }),
}) as Response);

// ── DB mock ───────────────────────────────────────────────────────────────────

const txUpdate = vi.fn();
const txInsert = vi.fn();
const outerUpdate = vi.fn();
const outerInsert = vi.fn();
let transactionCalls = 0;
let txShouldFailOnInsert = false;

let selectCallCount = 0;
const selectResponses: unknown[][] = [];
let txSelectResponse: unknown[] = [];

vi.mock("@workspace/db", () => {
  function chain(resolveWith: unknown, onResolve?: () => void) {
    const c: Record<string, unknown> = {};
    c["then"] = (res: (v: unknown) => void, rej?: (e: unknown) => void) => {
      if (onResolve) {
        try { onResolve(); } catch (e) { return Promise.reject(e).then(res, rej); }
      }
      return Promise.resolve(resolveWith).then(res, rej);
    };
    for (const m of ["from", "where", "limit", "orderBy", "set", "returning", "values", "innerJoin"]) {
      c[m] = vi.fn().mockReturnValue(c);
    }
    return c;
  }

  const txMock = {
    select: vi.fn().mockImplementation(() => chain(txSelectResponse)),
    update: vi.fn().mockImplementation(() => chain([], () => txUpdate())),
    insert: vi.fn().mockImplementation(() => chain([], () => {
      if (txShouldFailOnInsert) throw new Error("boom: journey insert failed");
      txInsert();
    })),
  };

  const dbMock = {
    select: vi.fn().mockImplementation(() => {
      const idx = selectCallCount++;
      return chain(selectResponses[idx] ?? []);
    }),
    insert: vi.fn().mockImplementation(() => chain([], () => outerInsert())),
    update: vi.fn().mockImplementation(() => chain([], () => outerUpdate())),
    delete: vi.fn().mockReturnValue(chain([])),
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      transactionCalls++;
      return fn(txMock);
    }),
  };

  return {
    db: dbMock,
    users:                { id: "id", role: "role", name: "name", email: "email", expoPushToken: "expoPushToken" },
    pkbActivities:        { id: "id", userId: "userId", namaKegiatan: "namaKegiatan", status: "status", updatedAt: "updatedAt" },
    pkbActivitySkk:       { activityId: "activityId" },
    pkbActivityDocs:      { activityId: "activityId", id: "id" },
    pkbActivityJourney:   { activityId: "activityId", createdAt: "createdAt" },
    pkbActivityChecklist: { id: "id", activityId: "activityId" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq:      vi.fn().mockReturnValue({}),
  and:     vi.fn().mockReturnValue({}),
  desc:    vi.fn().mockReturnValue({}),
  inArray: vi.fn().mockReturnValue({}),
}));

// ── Auth middleware factory ────────────────────────────────────────────────────

function makeAuthMock(role: string) {
  return vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).auth   = { userId: "clerk_test" };
    (req as any).dbUser = { id: 7, role };
    (req as any).log    = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    next();
  });
}

async function buildApp(role = "asosiasi") {
  vi.resetModules();
  vi.doMock("../../middlewares/auth.js", () => ({
    requireAuth: makeAuthMock(role),
    requireRole: vi.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  }));

  const app = express();
  app.use(express.json());
  const { default: asosiasiRouter } = await import("../asosiasi.js");
  app.use("/api", asosiasiRouter);
  // surface tx failures as 500 instead of hanging
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

/**
 * Prime select sequence for POST checklist:
 *  1st outer select: activity lookup
 *  (tx select: existing checklist — via txSelectResponse)
 *  2nd outer select: owner lookup for push
 */
function prime(status: string, opts: { existingChecklist?: boolean; pushToken?: string | null } = {}) {
  selectCallCount = 0;
  selectResponses.length = 0;
  selectResponses.push([{ id: 10, status, userId: 42 }]);
  selectResponses.push([{ id: 42, expoPushToken: opts.pushToken ?? null }]);
  txSelectResponse = opts.existingChecklist ? [{ id: 1 }] : [];
}

beforeEach(() => {
  vi.clearAllMocks();
  transactionCalls = 0;
  txShouldFailOnInsert = false;
});

const fullChecklist = { suratUndangan: true, daftarHadir: true, foto: true, penyelenggaraValid: true };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/asosiasi/submissions/:id/checklist — happy path", () => {
  it("all 4 items checked → status diverifikasi + journey entry inserted, inside one transaction", async () => {
    prime("diajukan");
    const app = await buildApp();
    const res = await request(app)
      .post("/api/asosiasi/submissions/10/checklist")
      .send(fullChecklist);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: "diverifikasi" });
    expect(transactionCalls).toBe(1);
    // checklist insert (new record) + journey insert
    expect(txInsert).toHaveBeenCalledTimes(2);
    // activity status update
    expect(txUpdate).toHaveBeenCalledTimes(1);
    // no writes outside the transaction
    expect(outerInsert).not.toHaveBeenCalled();
    expect(outerUpdate).not.toHaveBeenCalled();
  });

  it("updates the existing checklist row on re-verification", async () => {
    prime("ditolak", { existingChecklist: true });
    const app = await buildApp();
    const res = await request(app)
      .post("/api/asosiasi/submissions/10/checklist")
      .send(fullChecklist);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("diverifikasi");
    // checklist update + activity update
    expect(txUpdate).toHaveBeenCalledTimes(2);
    // journey insert only
    expect(txInsert).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/asosiasi/submissions/:id/checklist — rejection path", () => {
  it("1 item unchecked + catatan → status ditolak + journey entry", async () => {
    prime("diajukan");
    const app = await buildApp();
    const res = await request(app)
      .post("/api/asosiasi/submissions/10/checklist")
      .send({ ...fullChecklist, foto: false, catatan: "Foto dokumentasi belum diunggah" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: "ditolak" });
    expect(transactionCalls).toBe(1);
    expect(txInsert).toHaveBeenCalledTimes(2); // checklist + journey
    expect(txUpdate).toHaveBeenCalledTimes(1); // activity status
  });

  it("1 item unchecked WITHOUT catatan → 400 and no writes at all", async () => {
    prime("diajukan");
    const app = await buildApp();
    const res = await request(app)
      .post("/api/asosiasi/submissions/10/checklist")
      .send({ ...fullChecklist, foto: false });

    expect(res.status).toBe(400);
    expect(transactionCalls).toBe(0);
    expect(txInsert).not.toHaveBeenCalled();
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it("blank/whitespace catatan is also rejected", async () => {
    prime("diajukan");
    const app = await buildApp();
    const res = await request(app)
      .post("/api/asosiasi/submissions/10/checklist")
      .send({ ...fullChecklist, foto: false, catatan: "   " });

    expect(res.status).toBe(400);
    expect(transactionCalls).toBe(0);
  });
});

describe("POST /api/asosiasi/submissions/:id/checklist — guards", () => {
  it("returns 400 for an activity not yet submitted (status draft)", async () => {
    prime("draft");
    const app = await buildApp();
    const res = await request(app)
      .post("/api/asosiasi/submissions/10/checklist")
      .send(fullChecklist);

    expect(res.status).toBe(400);
    expect(transactionCalls).toBe(0);
  });

  it("returns 404 for a missing activity", async () => {
    selectCallCount = 0;
    selectResponses.length = 0;
    selectResponses.push([]); // no activity
    const app = await buildApp();
    const res = await request(app)
      .post("/api/asosiasi/submissions/999/checklist")
      .send(fullChecklist);

    expect(res.status).toBe(404);
  });

  it("returns 403 for non-asosiasi/non-admin roles", async () => {
    prime("diajukan");
    const app = await buildApp("user");
    const res = await request(app)
      .post("/api/asosiasi/submissions/10/checklist")
      .send(fullChecklist);

    expect(res.status).toBe(403);
    expect(transactionCalls).toBe(0);
  });
});

describe("POST /api/asosiasi/submissions/:id/checklist — atomicity", () => {
  it("a failure on the journey insert propagates (transaction rollback) and no success response is sent", async () => {
    prime("diajukan");
    txShouldFailOnInsert = true;
    const app = await buildApp();
    const res = await request(app)
      .post("/api/asosiasi/submissions/10/checklist")
      .send(fullChecklist);

    expect(res.status).toBe(500);
    expect(transactionCalls).toBe(1);
  });
});
