/**
 * POST /kegiatan/:id/ajukan — fresh checklist on resubmission (Task #215)
 *
 * Covers:
 * - Resubmission after "ditolak": the pkb_activity_checklist row is fully reset
 *   (all booleans false, catatan/checkedBy/checkedAt cleared) and the journey
 *   entry "Dokumentasi diajukan ulang setelah koreksi" carries
 *   { resubmitted: true, checklistReset: true }
 * - First-time submit (status "lengkap"): checklist table is neither updated
 *   nor inserted into; journey label is "Dokumentasi diajukan untuk verifikasi"
 *   with no metadata
 * - Guards: draft/diajukan/diverifikasi statuses are rejected with 400 and
 *   never touch the checklist
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock ───────────────────────────────────────────────────────────────────

let selectResponses: unknown[][] = [];
let selectCallCount = 0;

// { table, values } for every update / insert
const updateCalls: { table: string; set: Record<string, unknown> }[] = [];
const insertCalls: { table: string; values: Record<string, unknown> }[] = [];

vi.mock("@workspace/db", () => {
  function tableName(table: Record<string, unknown>): string {
    const syms = Object.getOwnPropertySymbols(table);
    for (const s of syms) {
      if (s.description?.includes("Name") && typeof (table as never)[s] === "string") {
        return (table as never)[s] as string;
      }
    }
    return "unknown";
  }

  function chain(resolveWith: unknown, hooks?: {
    onSet?: (v: Record<string, unknown>) => void;
    onValues?: (v: Record<string, unknown>) => void;
  }) {
    const c: Record<string, unknown> = {};
    c["then"] = (res: (v: unknown) => void, rej?: (e: unknown) => void) =>
      Promise.resolve(resolveWith).then(res, rej);
    for (const m of ["from", "where", "limit", "orderBy", "returning", "innerJoin", "onConflictDoNothing"]) {
      c[m] = vi.fn().mockReturnValue(c);
    }
    c["set"] = vi.fn().mockImplementation((v: Record<string, unknown>) => {
      hooks?.onSet?.(v);
      return c;
    });
    c["values"] = vi.fn().mockImplementation((v: Record<string, unknown>) => {
      hooks?.onValues?.(v);
      return c;
    });
    return c;
  }

  const dbMock = {
    select: vi.fn().mockImplementation(() => {
      const resp = selectResponses[selectCallCount] ?? [];
      selectCallCount++;
      return chain(resp);
    }),
    update: vi.fn().mockImplementation((table: Record<string, unknown>) =>
      chain([], { onSet: (v) => updateCalls.push({ table: tableName(table), set: v }) })),
    insert: vi.fn().mockImplementation((table: Record<string, unknown>) =>
      chain([{ id: 1 }], { onValues: (v) => insertCalls.push({ table: tableName(table), values: v }) })),
    delete: vi.fn().mockImplementation(() => chain([])),
  };

  return { db: dbMock };
});

vi.mock("../../middlewares/auth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as unknown as { auth: { userId: string } }).auth = { userId: "clerk_1" };
    next();
  },
}));

import kegiatanRouter from "../kegiatan";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as unknown as { log: unknown }).log = { warn: vi.fn(), error: vi.fn() }; next(); });
  app.use(kegiatanRouter);
  return app;
}

// Select order inside POST /kegiatan/:id/ajukan:
// 0: getUserId
// 1: activity lookup
// 2: owner lookup for push (after response; token null → no push)

function prime(status: string) {
  selectResponses = [
    [{ id: 10 }],                                                // getUserId
    [{ id: 5, userId: 10, status, namaKegiatan: "Pelatihan K3" }], // activity
    [{ id: 10, expoPushToken: null }],                           // owner (no push)
  ];
}

beforeEach(() => {
  selectCallCount = 0;
  updateCalls.length = 0;
  insertCalls.length = 0;
});

describe("POST /kegiatan/:id/ajukan — resubmission after ditolak", () => {
  it("fully resets the checklist row and logs a resubmission journey entry", async () => {
    prime("ditolak");
    const res = await request(makeApp()).post("/kegiatan/5/ajukan");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    // Activity transitions to diajukan with askom fields cleared
    const actUpdate = updateCalls.find((u) => u.table === "pkb_activities");
    expect(actUpdate).toBeDefined();
    expect(actUpdate!.set).toMatchObject({
      status: "diajukan",
      askomNote: null,
      askomVerifiedAt: null,
      askomVerifiedBy: null,
    });

    // Checklist row fully reset: booleans false, catatan/checkedBy/checkedAt cleared
    const checklistUpdate = updateCalls.find((u) => u.table === "pkb_activity_checklist");
    expect(checklistUpdate).toBeDefined();
    expect(checklistUpdate!.set).toMatchObject({
      suratUndangan: false,
      daftarHadir: false,
      foto: false,
      penyelenggaraValid: false,
      catatan: null,
      checkedBy: null,
      checkedAt: null,
    });
    expect(checklistUpdate!.set.updatedAt).toBeInstanceOf(Date);

    // Journey entry marks the resubmission + checklist reset
    const journey = insertCalls.find((i) => i.table === "pkb_activity_journey");
    expect(journey).toBeDefined();
    expect(journey!.values).toMatchObject({
      activityId: 5,
      event: "diajukan",
      label: "Dokumentasi diajukan ulang setelah koreksi",
      metadata: { resubmitted: true, checklistReset: true },
    });
  });
});

describe("POST /kegiatan/:id/ajukan — first-time submit", () => {
  it("does not touch or create checklist rows and logs the normal journey label", async () => {
    prime("lengkap");
    const res = await request(makeApp()).post("/kegiatan/5/ajukan");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    // No checklist writes of any kind
    expect(updateCalls.filter((u) => u.table === "pkb_activity_checklist")).toHaveLength(0);
    expect(insertCalls.filter((i) => i.table === "pkb_activity_checklist")).toHaveLength(0);

    // Only the activity status update
    expect(updateCalls.map((u) => u.table)).toEqual(["pkb_activities"]);

    // Normal journey entry, no resubmission metadata
    const journey = insertCalls.find((i) => i.table === "pkb_activity_journey");
    expect(journey).toBeDefined();
    expect(journey!.values).toMatchObject({
      event: "diajukan",
      label: "Dokumentasi diajukan untuk verifikasi",
    });
    expect(journey!.values.metadata ?? null).toBeNull();
  });
});

describe("POST /kegiatan/:id/ajukan — guards never touch the checklist", () => {
  it.each([
    ["draft", "Lengkapi semua field wajib sebelum mengajukan"],
    ["diajukan", "Dokumentasi sudah dalam antrian verifikasi"],
    ["diverifikasi", "Dokumentasi sudah diverifikasi"],
  ])("status %s → 400 and no writes", async (status, error) => {
    prime(status);
    const res = await request(makeApp()).post("/kegiatan/5/ajukan");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
    expect(updateCalls).toHaveLength(0);
    expect(insertCalls).toHaveLength(0);
  });
});
