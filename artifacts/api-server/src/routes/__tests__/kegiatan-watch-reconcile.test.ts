/**
 * PATCH /kegiatan/:id — watch reconciliation when marketplaceId changes
 *
 * Covers:
 * - Changing marketplaceId A→B removes A's rows from both watch tables
 *   (when no other activity of the user references A) and auto-watches B
 * - A is kept when another PKB activity of the same user still references it
 * - Clearing marketplaceId (A→null) removes A's rows and adds nothing
 * - PATCH without marketplaceId in body does not delete anything
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock ───────────────────────────────────────────────────────────────────

// Sequenced responses for db.select() calls, in call order.
let selectResponses: unknown[][] = [];
let selectCallCount = 0;

const deleteCalls: string[] = [];   // table names deleted from
const insertCalls: string[] = [];   // table names inserted into

vi.mock("@workspace/db", () => {
  function chain(resolveWith: unknown, onResolve?: () => void) {
    const c: Record<string, unknown> = {};
    c["then"] = (res: (v: unknown) => void, rej?: (e: unknown) => void) => {
      if (onResolve) onResolve();
      return Promise.resolve(resolveWith).then(res, rej);
    };
    for (const m of ["from", "where", "limit", "orderBy", "set", "returning", "values", "innerJoin", "onConflictDoNothing"]) {
      c[m] = vi.fn().mockReturnValue(c);
    }
    return c;
  }

  const dbMock = {
    select: vi.fn().mockImplementation(() => {
      const resp = selectResponses[selectCallCount] ?? [];
      selectCallCount++;
      return chain(resp);
    }),
    update: vi.fn().mockImplementation(() => chain([])),
    insert: vi.fn().mockImplementation((table: { tableName?: string } & Record<string, unknown>) => {
      insertCalls.push(tableName(table));
      return chain([{ id: 1 }]);
    }),
    delete: vi.fn().mockImplementation((table: Record<string, unknown>) => {
      deleteCalls.push(tableName(table));
      return chain([]);
    }),
  };

  function tableName(table: Record<string, unknown>): string {
    // drizzle tables expose their name via a symbol; fall back to scanning
    const syms = Object.getOwnPropertySymbols(table);
    for (const s of syms) {
      if (s.description?.includes("Name") && typeof (table as never)[s] === "string") {
        return (table as never)[s] as string;
      }
    }
    return "unknown";
  }

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

// Select call order inside PATCH:
// 0: getUserId
// 1: existing activity
// 2 (optional): stillReferenced check — only when marketplaceId changes from non-null
// then autoWatch (catalog lookup) if effective id set, then recomputeStatus selects.

const baseActivity = {
  id: 5, userId: 10, status: "draft", marketplaceId: "course-A",
  namaKegiatan: "K", tanggalMulai: "2026-01-01", linkRekaman: null,
};

beforeEach(() => {
  selectResponses = [];
  selectCallCount = 0;
  deleteCalls.length = 0;
  insertCalls.length = 0;
});

describe("PATCH /kegiatan/:id watch reconciliation", () => {
  it("removes old course watches and adds the new one on A→B change", async () => {
    selectResponses = [
      [{ id: 10 }],            // getUserId
      [baseActivity],          // existing
      [],                      // stillReferenced → none
      [],                      // autoWatch catalog lookup
      [{ ...baseActivity, marketplaceId: "course-B" }], // recomputeStatus act
      [], [],                  // recomputeStatus skk/docs
    ];
    const res = await request(makeApp()).patch("/kegiatan/5").send({ marketplaceId: "course-B" });
    expect(res.status).toBe(200);
    expect(deleteCalls).toContain("marketplace_watches");
    expect(deleteCalls).toContain("marketplace_watched");
    expect(insertCalls).toContain("marketplace_watches");
    expect(insertCalls).toContain("marketplace_watched");
  });

  it("keeps old course watches when another activity still references it", async () => {
    selectResponses = [
      [{ id: 10 }],            // getUserId
      [baseActivity],          // existing
      [{ id: 99 }],            // stillReferenced → yes
      [],                      // autoWatch catalog lookup
      [{ ...baseActivity, marketplaceId: "course-B" }],
      [], [],
    ];
    const res = await request(makeApp()).patch("/kegiatan/5").send({ marketplaceId: "course-B" });
    expect(res.status).toBe(200);
    expect(deleteCalls).toHaveLength(0);
    expect(insertCalls).toContain("marketplace_watched");
  });

  it("removes old watches and adds nothing when marketplaceId is cleared", async () => {
    selectResponses = [
      [{ id: 10 }],            // getUserId
      [baseActivity],          // existing
      [],                      // stillReferenced → none
      [{ ...baseActivity, marketplaceId: null }],
      [], [],
    ];
    const res = await request(makeApp()).patch("/kegiatan/5").send({ marketplaceId: null });
    expect(res.status).toBe(200);
    expect(deleteCalls).toContain("marketplace_watches");
    expect(deleteCalls).toContain("marketplace_watched");
    expect(insertCalls.filter((t) => t.startsWith("marketplace_"))).toHaveLength(0);
  });

  it("does not touch watch tables when marketplaceId is absent from the body", async () => {
    selectResponses = [
      [{ id: 10 }],            // getUserId
      [baseActivity],          // existing
      [],                      // autoWatch catalog lookup (existing id kept)
      [baseActivity],
      [], [],
    ];
    const res = await request(makeApp()).patch("/kegiatan/5").send({ namaKegiatan: "Baru" });
    expect(res.status).toBe(200);
    expect(deleteCalls).toHaveLength(0);
    // existing marketplaceId still auto-watched (idempotent upsert)
    expect(insertCalls).toContain("marketplace_watched");
  });
});
