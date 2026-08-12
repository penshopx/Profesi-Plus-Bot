/**
 * Route test: GET /profiles/me/quiz-coverage
 *
 * Proves that:
 *  1. Unauthenticated requests receive 401.
 *  2. A user with no claims receives an empty gaps array.
 *  3. A unit that has a passing quiz attempt is NOT flagged as a gap.
 *  4. A unit with a claim but no passing attempt IS flagged as a gap.
 *  5. quizId/quizTitle are null when no active quiz covers the claimed unit.
 *  6. Only uncovered units appear in gaps when some units are covered and others are not.
 */

import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock requireAuth directly — keeps tests free of Clerk + DB lookup ────────

// Minimal fixture that satisfies the users.$inferSelect contract.
// Uses `any` cast to avoid importing the full schema type in the test environment.
const FAKE_USER = {
  id:           42,
  clerkId:      "clerk_abc",
  role:         "user",
  name:         "Budi",
  email:        "budi@test.id",
  plan:         "free",
  planExpiresAt: null,
  exumCredits:  0,
  freeExumUsed: false,
  expoPushToken: null,
  createdAt:    new Date(),
};

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers.authorization) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).dbUser = FAKE_USER;
    next();
  },
  requireRole: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  optionalAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// ─── DB queue — each awaited DB call pops the next result ────────────────────

const dbQueue = vi.hoisted(() => ({
  q: [] as unknown[],
  push(...rows: unknown[]) { this.q.push(...rows); },
  shift(): unknown    { return this.q.shift() ?? []; },
}));

vi.mock("@workspace/db", () => {
  // Every chain method returns the same obj so any .from().where().innerJoin()
  // sequence works. The thenable resolves with the next queued result on await.
  function makeChain() {
    const obj: Record<string, unknown> = {};
    obj.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(dbQueue.shift()).then(resolve);
    obj.catch = (_reject: (e: unknown) => unknown) => Promise.resolve([]);
    for (const m of [
      "select", "from", "where", "innerJoin", "limit",
      "update", "set", "returning", "insert", "values",
    ]) {
      obj[m] = vi.fn().mockReturnValue(obj);
    }
    return obj;
  }

  const chain = makeChain();
  return {
    db: {
      select:      vi.fn().mockReturnValue(chain),
      insert:      vi.fn().mockReturnValue(chain),
      update:      vi.fn().mockReturnValue(chain),
      delete:      vi.fn().mockReturnValue(chain),
      transaction: vi.fn(),
    },
    profiles:         { userId: "user_id" },
    competencyClaims: { userId: "user_id", id: "id" },
    quizzes: {
      id:          "id",
      title:       "title",
      skkUnitCode: "skk_unit_code",
      isActive:    "is_active",
    },
    quizAttempts: {
      userId: "user_id",
      quizId: "quiz_id",
      passed:  "passed",
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq:        vi.fn().mockReturnValue({}),
  and:       vi.fn().mockReturnValue({}),
  isNotNull: vi.fn().mockReturnValue({}),
  isNull:    vi.fn().mockReturnValue({}),
  desc:      vi.fn().mockReturnValue({}),
  sql:       vi.fn().mockReturnValue({}),
  gte:       vi.fn().mockReturnValue({}),
  count:     vi.fn().mockReturnValue({}),
}));

// ─── App setup ────────────────────────────────────────────────────────────────

import profilesRouter from "../routes/profiles";

const app = express();
app.use(express.json());
app.use(profilesRouter);

/** Helper: build Authorization header for authed requests */
const AUTH = { Authorization: "Bearer test-token" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /profiles/me/quiz-coverage", () => {

  beforeEach(() => {
    dbQueue.q = [];
    vi.clearAllMocks();
  });

  // ── 1. Auth guard ──────────────────────────────────────────────────────────

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/profiles/me/quiz-coverage");
    // No Authorization header → requireAuth mock returns 401
    expect(res.status).toBe(401);
  });

  // ── 2. No claims → empty gaps ─────────────────────────────────────────────

  it("returns empty gaps when user has no competency claims", async () => {
    dbQueue.push([]); // competencyClaims → none

    const res = await request(app)
      .get("/profiles/me/quiz-coverage")
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ gaps: [] });
  });

  // ── 3. Passing attempt exists → unit not flagged ──────────────────────────

  it("does not flag a unit that has a passing quiz attempt", async () => {
    const claim = { skkUnitCode: "K3.01", skkUnitName: "Keselamatan Kerja", userId: 42 };
    const quiz  = { id: 7, title: "Kuis K3 Dasar", skkUnitCode: "K3.01" };

    dbQueue.push([claim]);                     // 1: competencyClaims
    dbQueue.push([quiz]);                      // 2: active unit quizzes
    dbQueue.push([{ skkUnitCode: "K3.01" }]); // 3: passing attempts — K3.01 covered

    const res = await request(app)
      .get("/profiles/me/quiz-coverage")
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.gaps).toHaveLength(0);
  });

  // ── 4. No passing attempt → unit flagged ─────────────────────────────────

  it("flags a unit with a claim but no passing attempt", async () => {
    const claim = { skkUnitCode: "K3.02", skkUnitName: "Penanganan Darurat", userId: 42 };
    const quiz  = { id: 9, title: "Kuis Darurat K3", skkUnitCode: "K3.02" };

    dbQueue.push([claim]); // 1: competencyClaims
    dbQueue.push([quiz]);  // 2: active unit quizzes
    dbQueue.push([]);      // 3: no passing attempts

    const res = await request(app)
      .get("/profiles/me/quiz-coverage")
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.gaps).toHaveLength(1);
    expect(res.body.gaps[0]).toMatchObject({
      skkUnitCode: "K3.02",
      skkUnitName: "Penanganan Darurat",
      quizId:      9,
      quizTitle:   "Kuis Darurat K3",
    });
  });

  // ── 5. No quiz for claimed unit → quizId/quizTitle null ──────────────────

  it("sets quizId and quizTitle to null when no quiz covers the claimed unit", async () => {
    const claim = { skkUnitCode: "K3.99", skkUnitName: "Unit Tanpa Kuis", userId: 42 };

    dbQueue.push([claim]); // 1: competencyClaims
    dbQueue.push([]);      // 2: no quizzes target K3.99
    dbQueue.push([]);      // 3: no passing attempts

    const res = await request(app)
      .get("/profiles/me/quiz-coverage")
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.gaps).toHaveLength(1);
    expect(res.body.gaps[0]).toMatchObject({
      skkUnitCode: "K3.99",
      skkUnitName: "Unit Tanpa Kuis",
      quizId:      null,
      quizTitle:   null,
    });
  });

  // ── 6. Mixed — only uncovered units in the response ───────────────────────

  it("only flags units without passes, not all claimed units", async () => {
    const claims = [
      { skkUnitCode: "K3.01", skkUnitName: "Keselamatan",  userId: 42 }, // has a pass
      { skkUnitCode: "K3.02", skkUnitName: "Darurat",       userId: 42 }, // no pass
    ];
    const quizList = [
      { id: 7, title: "Kuis K3.01", skkUnitCode: "K3.01" },
      { id: 8, title: "Kuis K3.02", skkUnitCode: "K3.02" },
    ];

    dbQueue.push(claims);                      // 1: competencyClaims
    dbQueue.push(quizList);                    // 2: active unit quizzes
    dbQueue.push([{ skkUnitCode: "K3.01" }]); // 3: passing attempt for K3.01 only

    const res = await request(app)
      .get("/profiles/me/quiz-coverage")
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.gaps).toHaveLength(1);
    expect(res.body.gaps[0].skkUnitCode).toBe("K3.02");
    expect(res.body.gaps[0].quizId).toBe(8);
  });
});
