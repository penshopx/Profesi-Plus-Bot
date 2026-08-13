/**
 * Tests for the Project Brain no-cache guarantee (task: new entries must be
 * picked up by the AI context immediately, without re-login).
 *
 * `getUserProjectBrain` / `buildProjectBrainContext` must query the database
 * on EVERY call — no memoization, no module-level cache. These tests prove:
 *   1. Each call issues a fresh db.select().
 *   2. An entry "created" between two calls appears in the second call's
 *      context string immediately.
 *   3. An entry removed between two calls disappears immediately.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── db mock (queue-based chainable stub, same pattern as historical-pkb) ─────
const dbState = vi.hoisted(() => ({
  queue: [] as unknown[],
  push(...items: unknown[]) {
    this.queue.push(...items);
  },
  shift(): unknown {
    return this.queue.shift() ?? [];
  },
}));

vi.mock("@workspace/db", () => {
  function makeChain() {
    const obj: Record<string, unknown> = {};
    obj["then"] = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(dbState.shift()).then(resolve, reject);
    for (const method of ["select", "from", "where", "orderBy", "limit"]) {
      obj[method] = vi.fn().mockReturnValue(obj);
    }
    return obj;
  }
  const chain = makeChain();
  return {
    db: {
      select: vi.fn().mockReturnValue(chain),
    },
    projectBrain: {
      userId: "userId",
      isActive: "isActive",
      isPinned: "isPinned",
      updatedAt: "updatedAt",
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockReturnValue({}),
  and: vi.fn().mockReturnValue({}),
  desc: vi.fn().mockReturnValue({}),
}));

import { db, projectBrain } from "@workspace/db";
import { desc } from "drizzle-orm";
import { getUserProjectBrain, buildProjectBrainContext } from "../lib/project-brain.js";

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    userId: 7,
    kind: "project",
    title: "Gedung RS Harapan",
    role: "Pelaksana Struktur",
    organization: "PT Wijaya Karya",
    period: "2023–2024",
    location: "Bandung",
    description: "Pelaksanaan struktur beton bertulang 8 lantai.",
    highlights: "Zero accident 400 hari",
    skkUnitCodes: "F.410140.001.01",
    isPinned: false,
    isActive: true,
    updatedAt: new Date("2026-08-01"),
    ...overrides,
  };
}

beforeEach(() => {
  dbState.queue.length = 0;
  vi.mocked(db.select).mockClear();
  vi.mocked(desc).mockClear();
});

describe("project brain no-cache guarantee", () => {
  it("queries the database on every getUserProjectBrain call (no memoization)", async () => {
    dbState.push([entry()], [entry()]);
    await getUserProjectBrain(7);
    await getUserProjectBrain(7);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it("orders by pinned-first, then most recently updated", async () => {
    dbState.push([entry()]);
    await getUserProjectBrain(7);
    // desc() must be called with real columns — pinned first, then updatedAt.
    expect(vi.mocked(desc).mock.calls.map((c) => c[0])).toEqual([
      projectBrain.isPinned,
      projectBrain.updatedAt,
    ]);
    expect(projectBrain.isPinned).toBeDefined();
  });

  it("includes a newly created entry in the very next context build", async () => {
    // First request: user has no entries yet.
    dbState.push([]);
    const before = await buildProjectBrainContext(7);
    expect(before).toBe("");

    // User creates an entry (simulated: the next db read returns it).
    dbState.push([entry({ title: "Jembatan Cisadane" })]);
    const after = await buildProjectBrainContext(7);

    expect(after).toContain("OTAK PROYEK");
    expect(after).toContain("Jembatan Cisadane");
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it("drops a deleted/deactivated entry from the very next context build", async () => {
    dbState.push([entry({ title: "Tol Cipali Seksi 2" })]);
    const before = await buildProjectBrainContext(7);
    expect(before).toContain("Tol Cipali Seksi 2");

    // Entry deleted — active-only query now returns nothing.
    dbState.push([]);
    const after = await buildProjectBrainContext(7);
    expect(after).toBe("");
  });

  it("renders entry metadata, highlights, and SKK codes in the context block", async () => {
    dbState.push([entry()]);
    const ctx = await buildProjectBrainContext(7);
    expect(ctx).toContain("[Proyek] Gedung RS Harapan");
    expect(ctx).toContain("Pelaksana Struktur · PT Wijaya Karya · 2023–2024 · Bandung");
    expect(ctx).toContain("Capaian kunci: Zero accident 400 hari");
    expect(ctx).toContain("SKK terkait: F.410140.001.01");
  });

  it("truncates long descriptions and respects the total budget", async () => {
    const long = "x".repeat(500);
    const rows = Array.from({ length: 12 }, (_, i) =>
      entry({ id: i + 1, title: `Proyek ${i + 1}`, description: long }),
    );
    dbState.push(rows);
    const ctx = await buildProjectBrainContext(7);
    // Per-entry cap: 320 chars + ellipsis.
    expect(ctx).toContain(`${"x".repeat(320)}…`);
    expect(ctx).not.toContain("x".repeat(321));
    // Total budget stops adding blocks well before all 12 render.
    expect(ctx).not.toContain("Proyek 12");
  });
});
