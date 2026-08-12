/**
 * Route-level tests for quiz statistics endpoints.
 *
 * Covers:
 *  - GET /quizzes/admin/all-stats includes quizzes with zero attempts (not just attempted ones)
 *  - GET /quizzes/admin/stats/:id returns correct aggregates (totalAttempts, passRate, avgScore)
 *  - GET /quizzes/admin/stats/:id returns 404 for unknown quiz
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock ────────────────────────────────────────────────────────────────────
// Chainable query mock; each awaited call pops the next queued value.
const dbQueue = vi.hoisted(() => ({
  q: [] as unknown[],
  push(...items: unknown[]) { this.q.push(...items); },
  shift(): unknown { return this.q.shift() ?? []; },
}));

vi.mock("@workspace/db", () => {
  function makeChain() {
    const obj: Record<string, unknown> = {};
    obj["then"] = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(dbQueue.shift()).then(resolve, reject);
    obj["catch"] = (reject: (e: unknown) => void) =>
      Promise.resolve(dbQueue.shift()).catch(reject);
    for (const m of [
      "select", "from", "where", "leftJoin", "groupBy",
      "orderBy", "limit", "update", "set", "returning",
    ]) {
      obj[m] = vi.fn().mockReturnValue(obj);
    }
    return obj;
  }
  const chain = makeChain();
  const dbMock = {
    select:      vi.fn().mockReturnValue(chain),
    insert:      vi.fn().mockReturnValue(chain),
    update:      vi.fn().mockReturnValue(chain),
    delete:      vi.fn().mockReturnValue(chain),
    transaction: vi.fn(),
  };
  return {
    db: dbMock,
    quizzes:          { id: "id", title: "title", isActive: "is_active", passingScore: "passing_score", questions: "questions", updatedAt: "updated_at" },
    quizAttempts:     { id: "id", quizId: "quiz_id", passed: "passed", scorePercent: "score_percent", answers: "answers" },
    competencyClaims: {},
  };
});

vi.mock("drizzle-orm", () => ({
  eq:    vi.fn().mockReturnValue({}),
  and:   vi.fn().mockReturnValue({}),
  desc:  vi.fn().mockReturnValue({}),
  count: vi.fn().mockReturnValue("count_expr"),
  sql:   vi.fn().mockReturnValue("sql_expr"),
}));

// ── Middleware mocks ───────────────────────────────────────────────────────────
vi.mock("../middlewares/auth", () => ({
  requireAuth: (_req: any, _res: any, next: () => void) => next(),
  requireRole: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock("../lib/llm", () => ({
  getClientForModel: vi.fn(),
  DEFAULT_MODEL: "test-model",
}));

// ── App setup ─────────────────────────────────────────────────────────────────
async function buildApp() {
  const { default: quizzesRouter } = await import("../routes/quizzes");
  const app = express();
  app.use(express.json());
  app.use("/", quizzesRouter);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /quizzes/admin/all-stats", () => {
  beforeEach(() => { dbQueue.q.length = 0; });

  it("includes quizzes with zero attempts alongside attempted ones", async () => {
    // The LEFT JOIN aggregation returns one row per quiz; quizzes with no attempts
    // come back with totalAttempts=0 and avgScore=0 from COALESCE.
    dbQueue.push([
      { quizId: 1, totalAttempts: 5, avgScore: 72, passCount: 4 },
      { quizId: 2, totalAttempts: 0, avgScore: 0,  passCount: 0 }, // zero-attempt quiz
    ]);

    const app = await buildApp();
    const res = await request(app).get("/quizzes/admin/all-stats");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const quiz1 = res.body.find((r: any) => r.quizId === 1);
    expect(quiz1.totalAttempts).toBe(5);
    expect(quiz1.avgScore).toBe(72);
    expect(quiz1.passRate).toBe(80); // 4/5 = 80%

    const quiz2 = res.body.find((r: any) => r.quizId === 2);
    expect(quiz2.totalAttempts).toBe(0);
    expect(quiz2.avgScore).toBe(0);
    expect(quiz2.passRate).toBe(0);
  });

  it("returns an empty array when there are no quizzes", async () => {
    dbQueue.push([]);
    const app = await buildApp();
    const res = await request(app).get("/quizzes/admin/all-stats");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /quizzes/admin/stats/:id", () => {
  beforeEach(() => { dbQueue.q.length = 0; });

  it("returns 404 for an unknown quiz", async () => {
    dbQueue.push([]); // empty quiz lookup
    const app = await buildApp();
    const res = await request(app).get("/quizzes/admin/stats/9999");
    expect(res.status).toBe(404);
  });

  it("returns zero-value aggregates for a quiz with no attempts", async () => {
    // Quiz exists but has no attempts yet
    dbQueue.push([{
      id: 3,
      title: "Uji Coba Kosong",
      passingScore: 70,
      questions: [
        { id: "q1", text: "Pertanyaan?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctId: "a" },
      ],
    }]);
    dbQueue.push([]); // zero attempts

    const app = await buildApp();
    const res = await request(app).get("/quizzes/admin/stats/3");

    expect(res.status).toBe(200);
    expect(res.body.totalAttempts).toBe(0);
    expect(res.body.passRate).toBe(0);
    expect(res.body.avgScore).toBe(0);
    expect(res.body.questions).toHaveLength(1);
    expect(res.body.questions[0].failRate).toBe(0);
  });

  it("computes correct pass rate and avg score with mixed attempts", async () => {
    dbQueue.push([{
      id: 4,
      title: "Quiz Aktif",
      passingScore: 70,
      questions: [
        { id: "q1", text: "Soal?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctId: "a" },
      ],
    }]);
    // 3 attempts: two pass (80%), one fail (40%)
    dbQueue.push([
      { id: 1, passed: true,  scorePercent: 80, answers: { q1: "a" } },
      { id: 2, passed: true,  scorePercent: 80, answers: { q1: "a" } },
      { id: 3, passed: false, scorePercent: 40, answers: { q1: "b" } },
    ]);

    const app = await buildApp();
    const res = await request(app).get("/quizzes/admin/stats/4");

    expect(res.status).toBe(200);
    expect(res.body.totalAttempts).toBe(3);
    expect(res.body.passCount).toBe(2);
    expect(res.body.passRate).toBe(67); // Math.round(2/3*100)
    expect(res.body.avgScore).toBe(67); // Math.round((80+80+40)/3)
    // q1: 2 chose "a" (correct), 1 chose "b" → failRate = Math.round(1/3*100) = 33
    expect(res.body.questions[0].failRate).toBe(33);
  });
});
