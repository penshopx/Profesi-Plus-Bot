/**
 * GET /marketplace/watched — pkbLoggedIds field
 *
 * Covers:
 * - Returns empty pkbLoggedIds when the user has no linked PKB activities
 * - Includes the courseId when the user has a linked PKB activity
 * - Deduplication: multiple activities on the same course yield one entry
 * - Null safety: null marketplaceId values are filtered out
 * - Per-user isolation: eq() is invoked with pkbActivities.userId and the
 *   requesting user's ID, proved by inspecting the real Drizzle column reference
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock ───────────────────────────────────────────────────────────────────

let selectResponses: unknown[][] = [];
let selectCallCount = 0;

vi.mock("@workspace/db", () => {
  function chain(resolveWith: unknown) {
    const c: Record<string, unknown> = {};
    c["then"] = (res: (v: unknown) => void, rej?: (e: unknown) => void) =>
      Promise.resolve(resolveWith).then(res, rej);
    for (const m of [
      "from", "where", "limit", "orderBy", "set", "returning",
      "values", "innerJoin", "onConflictDoNothing",
    ]) {
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
    insert: vi.fn().mockImplementation(() => chain([])),
    update: vi.fn().mockImplementation(() => chain([])),
    delete: vi.fn().mockReturnValue(chain([])),
  };

  return { db: dbMock };
});

// ── drizzle-orm: spread real module; replace predicate helpers with spies ─────
//
// eq is a spy so we can inspect exactly which (column, value) pairs it was
// called with. We import pkbActivities from the real schema (not mocked) so
// pkbActivities.userId is the same object reference that the route passes as
// eq's first argument — enabling precise column-level assertions.

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq:        vi.fn().mockReturnValue({}),
    and:       vi.fn().mockReturnValue({}),
    asc:       vi.fn().mockReturnValue({}),
    isNotNull: vi.fn().mockReturnValue({}),
  };
});

import { eq } from "drizzle-orm";
// Real schema — not mocked — so pkbActivities.userId is the same column
// object the route passes to eq().
import { pkbActivities } from "@workspace/db/schema";

// ── Rate-limiter: bypass ──────────────────────────────────────────────────────

vi.mock("../../middlewares/rateLimiter", () => ({
  catalogRateLimiter: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => next(),
}));

// ── Auth middleware ───────────────────────────────────────────────────────────

let currentUserId = 10;

vi.mock("../../middlewares/auth", () => ({
  requireAuth: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    (req as unknown as { dbUser: { id: number; role: string } }).dbUser = {
      id: currentUserId,
      role: "user",
    };
    next();
  },
}));

import marketplaceRouter from "../marketplace";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(marketplaceRouter);
  return app;
}

// GET /marketplace/watched fires two parallel selects via Promise.all:
//   selectCallCount 0 → marketplaceWatched rows
//   selectCallCount 1 → pkbActivities rows (the source of pkbLoggedIds)

beforeEach(() => {
  selectResponses = [];
  selectCallCount = 0;
  currentUserId = 10;
  vi.mocked(eq).mockClear();
});

describe("GET /marketplace/watched — pkbLoggedIds", () => {
  // ── Basic correctness ────────────────────────────────────────────────────

  it("returns empty pkbLoggedIds when the user has no linked PKB activities", async () => {
    selectResponses = [[], []];

    const res = await request(makeApp()).get("/marketplace/watched");

    expect(res.status).toBe(200);
    expect(res.body.pkbLoggedIds).toEqual([]);
  });

  it("includes the courseId when the user has one linked PKB activity", async () => {
    selectResponses = [
      [{ courseId: "course-A", userId: 10, courseTitle: "A", provider: "P" }],
      [{ marketplaceId: "course-A" }],
    ];

    const res = await request(makeApp()).get("/marketplace/watched");

    expect(res.status).toBe(200);
    expect(res.body.pkbLoggedIds).toContain("course-A");
    expect(res.body.pkbLoggedIds).toHaveLength(1);
  });

  // ── Deduplication ────────────────────────────────────────────────────────

  it("deduplicates when the user has multiple PKB activities on the same course", async () => {
    selectResponses = [
      [],
      [
        { marketplaceId: "course-A" },
        { marketplaceId: "course-A" },
        { marketplaceId: "course-A" },
      ],
    ];

    const res = await request(makeApp()).get("/marketplace/watched");

    expect(res.status).toBe(200);
    expect(res.body.pkbLoggedIds).toEqual(["course-A"]);
  });

  it("deduplicates across multiple distinct courses", async () => {
    selectResponses = [
      [],
      [
        { marketplaceId: "course-A" },
        { marketplaceId: "course-B" },
        { marketplaceId: "course-A" },
      ],
    ];

    const res = await request(makeApp()).get("/marketplace/watched");

    expect(res.status).toBe(200);
    const ids: string[] = res.body.pkbLoggedIds;
    expect(ids).toHaveLength(2);
    expect(ids).toContain("course-A");
    expect(ids).toContain("course-B");
  });

  // ── Null safety ───────────────────────────────────────────────────────────

  it("filters out null marketplaceId values as a safety net beyond isNotNull", async () => {
    selectResponses = [
      [],
      [
        { marketplaceId: "course-A" },
        { marketplaceId: null },
        { marketplaceId: "course-A" },
      ],
    ];

    const res = await request(makeApp()).get("/marketplace/watched");

    expect(res.status).toBe(200);
    expect(res.body.pkbLoggedIds).toEqual(["course-A"]);
    expect(res.body.pkbLoggedIds).not.toContain(null);
  });

  // ── Per-user isolation ────────────────────────────────────────────────────
  //
  // We assert that eq() was invoked with pkbActivities.userId (the real Drizzle
  // column object from @workspace/db/schema) and the authenticated user's numeric
  // ID. Removing or altering the eq(pkbActivities.userId, uid) predicate in the
  // route would break this assertion, proving the query is scoped to the
  // requesting user and not returning another user's data.

  it("scopes the pkbActivities query to the authenticated user's numeric ID", async () => {
    currentUserId = 42;
    selectResponses = [[], [{ marketplaceId: "course-X" }]];

    await request(makeApp()).get("/marketplace/watched");

    // Find eq() calls where the first arg is exactly pkbActivities.userId.
    // This is the real column reference — not just any userId-shaped value.
    const eqCalls = vi.mocked(eq).mock.calls;
    const pkbUserIdCalls = eqCalls.filter(([col]) => col === pkbActivities.userId);

    expect(pkbUserIdCalls.length).toBeGreaterThan(0);
    expect(pkbUserIdCalls.some(([, val]) => val === 42)).toBe(true);
  });

  it("uses a different userId predicate for each authenticated user", async () => {
    // User A (id=10): has an activity → pkbLoggedIds is populated.
    currentUserId = 10;
    selectResponses = [[], [{ marketplaceId: "course-X" }]];
    await request(makeApp()).get("/marketplace/watched");

    const callsA = vi.mocked(eq).mock.calls
      .filter(([col]) => col === pkbActivities.userId)
      .map(([, val]) => val);
    expect(callsA).toContain(10);
    expect(callsA).not.toContain(20);

    // User B (id=20): no activities → pkbLoggedIds is empty.
    vi.mocked(eq).mockClear();
    selectCallCount = 0;
    currentUserId = 20;
    selectResponses = [[], []];
    const resB = await request(makeApp()).get("/marketplace/watched");

    expect(resB.body.pkbLoggedIds).toEqual([]);
    expect(resB.body.pkbLoggedIds).not.toContain("course-X");

    const callsB = vi.mocked(eq).mock.calls
      .filter(([col]) => col === pkbActivities.userId)
      .map(([, val]) => val);
    expect(callsB).toContain(20);
    expect(callsB).not.toContain(10);
  });
});
