/**
 * Task: confirm deleted Project Brain entries are NEVER sent to the AI after
 * deletion.
 *
 * Unlike project-brain-context.test.ts (which uses a queue of canned db
 * results), these tests use a stateful in-memory fake db whose where()
 * predicates are actually evaluated. This proves end-to-end that:
 *   1. DELETE /project-brain/:id removes the row AND the very next
 *      buildProjectBrainContext call no longer contains its content.
 *   2. PATCH /project-brain/:id { isActive: false } (soft-disable) also hides
 *      the entry from the AI context — the isActive=true filter is real, not
 *      just a mocked return value.
 *   3. A future refactor that caches the query result would fail these tests,
 *      because the context is rebuilt from live table state on every call.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Stateful in-memory table ──────────────────────────────────────────────────

type Row = Record<string, unknown>;
const store = vi.hoisted(() => ({ rows: [] as Row[], nextId: 1 }));

// ── drizzle-orm mock: operators return evaluatable predicate descriptors ─────

vi.mock("drizzle-orm", () => ({
  eq: (col: string, val: unknown) => (row: Row) => row[col] === val,
  and:
    (...conds: Array<(row: Row) => boolean>) =>
    (row: Row) =>
      conds.every((c) => c(row)),
  desc: (col: string) => ({ col, dir: "desc" as const }),
  inArray: (col: string, vals: unknown[]) => (row: Row) => vals.includes(row[col]),
}));

// ── @workspace/db mock: chains that really filter/mutate the store ───────────

vi.mock("@workspace/db", () => {
  type Pred = (row: Row) => boolean;

  function selectChain() {
    let result: Row[] = [];
    const chain = {
      from: vi.fn(() => {
        result = [...store.rows];
        return chain;
      }),
      where: vi.fn((pred: Pred) => {
        result = result.filter(pred);
        return chain;
      }),
      orderBy: vi.fn((...orders: Array<{ col: string }>) => {
        result = [...result].sort((a, b) => {
          for (const { col } of orders) {
            const av = a[col] as number | boolean | Date;
            const bv = b[col] as number | boolean | Date;
            if (av !== bv) return av < bv ? 1 : -1; // desc
          }
          return 0;
        });
        return chain;
      }),
      limit: vi.fn((n: number) => {
        result = result.slice(0, n);
        return chain;
      }),
      then: (res: (v: Row[]) => void, rej: (e: unknown) => void) =>
        Promise.resolve(result).then(res, rej),
    };
    return chain;
  }

  const db = {
    select: vi.fn(() => selectChain()),
    insert: vi.fn(() => ({
      values: vi.fn((v: Row) => ({
        returning: vi.fn(async () => {
          const row: Row = {
            id: store.nextId++,
            isPinned: false,
            lastUsedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            organization: null,
            role: null,
            period: null,
            location: null,
            skkUnitCodes: null,
            jenjang: null,
            highlights: null,
            ...v,
          };
          store.rows.push(row);
          return [row];
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((patch: Row) => ({
        where: vi.fn((pred: Pred) => {
          const matched = store.rows.filter(pred);
          for (const row of matched) Object.assign(row, patch);
          const p = Promise.resolve(matched);
          return Object.assign(p, { returning: vi.fn(async () => matched) });
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async (pred: Pred) => {
        store.rows = store.rows.filter((r) => !pred(r));
        return [];
      }),
    })),
  };

  return {
    db,
    projectBrain: {
      id: "id",
      userId: "userId",
      isActive: "isActive",
      isPinned: "isPinned",
      updatedAt: "updatedAt",
    },
    PROJECT_BRAIN_KINDS: ["project", "role", "achievement", "skill", "profile"],
  };
});

// ── Auth mock: every request is user 7 ────────────────────────────────────────

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).dbUser = { id: 7, role: "user" };
    next();
  },
}));

import projectBrainRouter from "../routes/project-brain.js";
import { buildProjectBrainContext, getUserProjectBrain } from "../lib/project-brain.js";

const app = express();
app.use(express.json());
app.use("/api", projectBrainRouter);

beforeEach(() => {
  store.rows = [];
  store.nextId = 1;
});

async function createEntry(title: string, description: string) {
  const res = await request(app)
    .post("/api/project-brain")
    .send({ title, kind: "project", description });
  expect(res.status).toBe(201);
  return res.body as { id: number };
}

describe("deleted project-brain entries never reach the AI context", () => {
  it("hard delete: entry content is absent from the very next context build", async () => {
    const { id } = await createEntry(
      "Bendungan Way Sekampung",
      "Supervisi grouting pondasi bendungan utama.",
    );

    // Sanity: entry is in the AI context before deletion.
    const before = await buildProjectBrainContext(7);
    expect(before).toContain("Bendungan Way Sekampung");
    expect(before).toContain("Supervisi grouting pondasi bendungan utama.");

    const del = await request(app).delete(`/api/project-brain/${id}`);
    expect(del.status).toBe(200);

    const after = await buildProjectBrainContext(7);
    expect(after).not.toContain("Bendungan Way Sekampung");
    expect(after).not.toContain("Supervisi grouting");
    expect(after).toBe(""); // no other entries → empty context
    expect(await getUserProjectBrain(7)).toEqual([]);
  });

  it("soft-disable via PATCH isActive=false: entry is hidden from the context", async () => {
    const { id } = await createEntry(
      "Gedung Diklat PUPR",
      "Manajer lapangan struktur baja 6 lantai.",
    );

    expect(await buildProjectBrainContext(7)).toContain("Gedung Diklat PUPR");

    const patch = await request(app).patch(`/api/project-brain/${id}`).send({ isActive: false });
    expect(patch.status).toBe(200);
    expect(patch.body.isActive).toBe(false);

    const after = await buildProjectBrainContext(7);
    expect(after).not.toContain("Gedung Diklat PUPR");
    expect(after).not.toContain("Manajer lapangan");
    expect(after).toBe("");

    // Row still exists (soft-disable, not deletion) but is excluded from the AI query.
    expect(store.rows).toHaveLength(1);
    expect(await getUserProjectBrain(7)).toEqual([]);
  });

  it("re-enabling via PATCH isActive=true restores the entry in the context", async () => {
    const { id } = await createEntry("Jalan Tol Serpong", "Pengawasan perkerasan kaku.");
    await request(app).patch(`/api/project-brain/${id}`).send({ isActive: false });
    expect(await buildProjectBrainContext(7)).toBe("");

    await request(app).patch(`/api/project-brain/${id}`).send({ isActive: true });
    expect(await buildProjectBrainContext(7)).toContain("Jalan Tol Serpong");
  });

  it("deleting one entry leaves the user's other entries in the context", async () => {
    const a = await createEntry("Proyek Alpha", "Deskripsi alpha.");
    await createEntry("Proyek Beta", "Deskripsi beta.");

    await request(app).delete(`/api/project-brain/${a.id}`);

    const ctx = await buildProjectBrainContext(7);
    expect(ctx).not.toContain("Proyek Alpha");
    expect(ctx).toContain("Proyek Beta");
  });

  it("another user's delete cannot remove the entry (owner scoping) and context is unaffected", async () => {
    const { id } = await createEntry("Proyek Milik User 7", "Deskripsi rahasia.");
    // Simulate a different owner on the stored row: user 7's delete of a
    // foreign row must 404 and leave the row (and its owner's context) intact.
    const foreign = store.rows[0]!;
    foreign["userId"] = 99;

    const del = await request(app).delete(`/api/project-brain/${id}`);
    expect(del.status).toBe(404);
    expect(store.rows).toHaveLength(1);
    expect(await buildProjectBrainContext(99)).toContain("Proyek Milik User 7");
  });
});
