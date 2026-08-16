/**
 * PUT /kegiatan/:id/skk — clearing all SKK retriggers automatic mapping.
 *
 * The retrigger is a fire-and-forget `void autoMapSkk(...)`, which makes it
 * easy to regress silently. These tests exercise the REAL kegiatan router
 * against an in-memory DB mock and assert:
 *   (a) PUT with an empty array triggers autoMapSkk (LLM called, suggestions
 *       repopulated in pkb_activity_skk)
 *   (b) PUT with a non-empty array does NOT trigger autoMapSkk
 *   (c) rows inserted via PUT carry autoMapped=false, while rows inserted by
 *       autoMapSkk carry autoMapped=true
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Auth mock ────────────────────────────────────────────────────────────────

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.auth = { userId: "clerk_1" };
    next();
  },
}));

// ── Side-effect module mocks (imported at top of the router) ─────────────────

vi.mock("../lib/uploadTokenStore", () => ({
  consumeUploadToken: vi.fn().mockReturnValue(true),
  issueUploadToken: vi.fn(),
}));
vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {
    async deleteObjectEntity() {}
  },
}));
vi.mock("../lib/push", () => ({
  sendPushNotification: vi.fn(),
}));

// ── LLM + SKK data mocks (dynamically imported inside autoMapSkk) ────────────

const llmCreate = vi.fn(async () => ({
  choices: [
    {
      message: {
        content: JSON.stringify({
          suggestions: [
            { skkCode: "SKK-001", skkName: "Unit Satu", jabkerName: "Ahli Muda" },
            { skkCode: "SKK-002", skkName: "Unit Dua", jabkerName: "Ahli Madya" },
          ],
        }),
      },
    },
  ],
}));

vi.mock("../lib/llm", () => ({
  DEFAULT_MODEL: "test-model",
  getClientForModel: () => ({
    client: { chat: { completions: { create: llmCreate } } },
    model: "test-model",
  }),
}));

vi.mock("../lib/skk-data", () => ({
  SKK_DATA: [
    {
      name: "Jabker Uji",
      klasifikasi: "Sipil",
      units: [
        { code: "SKK-001", name: "Unit Satu" },
        { code: "SKK-002", name: "Unit Dua" },
      ],
    },
  ],
}));

// ── Schema mock: distinct identities per table ───────────────────────────────

vi.mock("@workspace/db/schema", () => ({
  users: { __t: "users" },
  pkbActivities: { __t: "pkbActivities" },
  pkbActivitySkk: { __t: "pkbActivitySkk" },
  pkbActivityDocs: { __t: "pkbActivityDocs" },
  pkbActivityJourney: { __t: "pkbActivityJourney" },
  pkbActivityChecklist: { __t: "pkbActivityChecklist" },
  marketplaceWatches: { __t: "marketplaceWatches" },
  marketplaceWatched: { __t: "marketplaceWatched" },
  marketplaceCourses: { __t: "marketplaceCourses" },
  KEGIATAN_STATUS: ["draft", "lengkap", "diajukan", "diverifikasi", "ditolak"],
}));

// ── In-memory DB mock keyed on table identity ────────────────────────────────
// The suite uses a single user (id 1) and a single activity (id 1), so `where`
// clauses can safely resolve to "all rows of the table".

const store = new Map<any, any[]>();
function rowsOf(table: any): any[] {
  if (!store.has(table)) store.set(table, []);
  return store.get(table)!;
}

vi.mock("@workspace/db", () => {
  function thenable(get: () => any) {
    return {
      then: (res: (v: any) => void, rej?: (e: any) => void) =>
        Promise.resolve().then(get).then(res, rej),
    };
  }
  function selectChain(table: () => any) {
    const all = () => [...rowsOf(table())];
    const chain: any = {
      ...thenable(all),
      where: () => ({
        ...thenable(all),
        limit: async () => all().slice(0, 1),
        orderBy: async () => all(),
      }),
      orderBy: async () => all(),
      limit: async () => all().slice(0, 1),
    };
    return chain;
  }
  let ref: any = null;
  const db = {
    select: (_cols?: any) => ({
      from: (t: any) => selectChain(() => t),
    }),
    insert: (t: any) => ({
      values: (v: any) => {
        const items = Array.isArray(v) ? v : [v];
        const created = items.map((row, i) => ({ id: rowsOf(t).length + i + 1, ...row }));
        rowsOf(t).push(...created);
        return {
          ...thenable(() => created),
          returning: async () => created,
          onConflictDoNothing: () => thenable(() => created),
        };
      },
    }),
    update: (t: any) => ({
      set: (u: any) => ({
        where: () => {
          for (const row of rowsOf(t)) Object.assign(row, u);
          return thenable(() => []);
        },
      }),
    }),
    delete: (t: any) => ({
      where: () => {
        rowsOf(t).length = 0;
        return thenable(() => []);
      },
    }),
  };
  void ref;
  return { db };
});

import kegiatanRouter from "../routes/kegiatan";
import * as schema from "@workspace/db/schema";

const { users, pkbActivities, pkbActivitySkk } = schema as any;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(kegiatanRouter);
  return app;
}

const MANUAL_SKK = [
  { skkCode: "SKK-001", skkName: "Unit Satu", jabkerName: "Ahli Muda" },
];

beforeEach(() => {
  store.clear();
  llmCreate.mockClear();
  rowsOf(users).push({ id: 1, clerkId: "clerk_1" });
  rowsOf(pkbActivities).push({
    id: 1,
    userId: 1,
    namaKegiatan: "Pelatihan Beton",
    tanggalMulai: "2026-08-01",
    tempatKegiatan: "Jakarta",
    namaMateri: "Beton Prategang",
    uraianSingkat: "Pelatihan teknis beton prategang",
    penyelenggara: "LPJK",
    jenisPkb: "pelatihan",
    linkRekaman: null,
    marketplaceId: null,
    status: "draft",
  });
});

async function flushBackground() {
  // autoMapSkk is fire-and-forget; give its promise chain time to settle.
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
}

describe("PUT /kegiatan/:id/skk — auto-remap on clear", () => {
  it("empty-array PUT retriggers autoMapSkk and repopulates suggestions with autoMapped=true", async () => {
    // Start with an existing manual entry to prove clearing works end-to-end.
    rowsOf(pkbActivitySkk).push({ id: 99, activityId: 1, skkCode: "SKK-002", skkName: "Unit Dua", autoMapped: false });

    const res = await request(buildApp()).put("/kegiatan/1/skk").send({ skk: [] });
    expect(res.status).toBe(200);
    expect(res.body.skk).toEqual([]);

    await vi.waitFor(() => expect(llmCreate).toHaveBeenCalledTimes(1));
    await flushBackground();

    const skkRows = rowsOf(pkbActivitySkk);
    expect(skkRows.length).toBe(2);
    expect(skkRows.map((r) => r.skkCode).sort()).toEqual(["SKK-001", "SKK-002"]);
    // (c) autoMapSkk inserts carry autoMapped=true
    for (const row of skkRows) expect(row.autoMapped).toBe(true);
  });

  it("non-empty PUT does NOT trigger autoMapSkk and inserts autoMapped=false", async () => {
    const res = await request(buildApp()).put("/kegiatan/1/skk").send({ skk: MANUAL_SKK });
    expect(res.status).toBe(200);

    await flushBackground();

    expect(llmCreate).not.toHaveBeenCalled();
    const skkRows = rowsOf(pkbActivitySkk);
    expect(skkRows.length).toBe(1);
    // (c) entries inserted via PUT are manual edits
    expect(skkRows[0].autoMapped).toBe(false);
    expect(skkRows[0].skkCode).toBe("SKK-001");
  });

  it("clearing then background remap leaves activity status consistent (lengkap once SKK exists)", async () => {
    await request(buildApp()).put("/kegiatan/1/skk").send({ skk: [] });
    await vi.waitFor(() => expect(llmCreate).toHaveBeenCalledTimes(1));
    await flushBackground();

    // recomputeStatus ran after remap: required fields + SKK present → lengkap
    expect(rowsOf(pkbActivities)[0].status).toBe("lengkap");
  });
});
