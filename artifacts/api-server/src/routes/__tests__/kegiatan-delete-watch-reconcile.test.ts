/**
 * DELETE /kegiatan/:id — watch reconciliation when the deleted activity had a marketplaceId
 *
 * Covers:
 * - Deleting an activity linked to a course removes its watch rows from both
 *   tables when no other activity of the user references the same course.
 * - Watch rows are kept when another PKB activity still references the same course.
 * - Deleting an activity with no marketplaceId does not touch watch tables.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock ───────────────────────────────────────────────────────────────────

let selectResponses: unknown[][] = [];
let selectCallCount = 0;

const deleteCalls: string[] = [];

vi.mock("@workspace/db", () => {
  function chain(resolveWith: unknown) {
    const c: Record<string, unknown> = {};
    c["then"] = (res: (v: unknown) => void, rej?: (e: unknown) => void) =>
      Promise.resolve(resolveWith).then(res, rej);
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
    insert: vi.fn().mockImplementation(() => chain([{ id: 1 }])),
    delete: vi.fn().mockImplementation((table: Record<string, unknown>) => {
      deleteCalls.push(tableName(table));
      return chain([]);
    }),
  };

  function tableName(table: Record<string, unknown>): string {
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
  app.use((req, _res, next) => {
    (req as unknown as { log: unknown }).log = { warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(kegiatanRouter);
  return app;
}

// Select call order inside DELETE:
// 0: getUserId
// 1: existing activity (includes marketplaceId)
// 2 (when marketplaceId set): stillReferenced check — after the row is deleted

const baseActivity = {
  id: 7, userId: 10, status: "draft", marketplaceId: "course-A",
  namaKegiatan: "K", tanggalMulai: "2026-01-01",
};

beforeEach(() => {
  selectResponses = [];
  selectCallCount = 0;
  deleteCalls.length = 0;
});

describe("DELETE /kegiatan/:id watch reconciliation", () => {
  it("removes watch rows for the deleted activity's course when no other activity references it", async () => {
    selectResponses = [
      [{ id: 10 }],      // getUserId
      [baseActivity],    // existing activity
      [],                // stillReferenced → none (deleted row is gone)
    ];

    const res = await request(makeApp()).delete("/kegiatan/7");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    // pkb_activities deleted first, then both watch tables
    expect(deleteCalls).toContain("pkb_activities");
    expect(deleteCalls).toContain("marketplace_watches");
    expect(deleteCalls).toContain("marketplace_watched");
  });

  it("keeps watch rows when another activity by the same user still references the course", async () => {
    selectResponses = [
      [{ id: 10 }],        // getUserId
      [baseActivity],      // existing activity
      [{ id: 99 }],        // stillReferenced → yes (another activity references it)
    ];

    const res = await request(makeApp()).delete("/kegiatan/7");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(deleteCalls).toContain("pkb_activities");
    expect(deleteCalls).not.toContain("marketplace_watches");
    expect(deleteCalls).not.toContain("marketplace_watched");
  });

  it("does not touch watch tables when the deleted activity had no marketplaceId", async () => {
    const noMarketplace = { ...baseActivity, marketplaceId: null };
    selectResponses = [
      [{ id: 10 }],       // getUserId
      [noMarketplace],    // existing activity — no marketplaceId
    ];

    const res = await request(makeApp()).delete("/kegiatan/7");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(deleteCalls).toContain("pkb_activities");
    expect(deleteCalls).not.toContain("marketplace_watches");
    expect(deleteCalls).not.toContain("marketplace_watched");
  });

  it("returns 404 when the activity does not belong to the user", async () => {
    selectResponses = [
      [{ id: 10 }],  // getUserId
      [],            // existing → not found
    ];

    const res = await request(makeApp()).delete("/kegiatan/999");

    expect(res.status).toBe(404);
    expect(deleteCalls).toHaveLength(0);
  });
});
