/**
 * GET /quizzes/admin/stats/:id
 *
 * Covers the case where a question's options were edited/deleted AFTER users
 * had already submitted attempts: stale option IDs in attempt answer snapshots
 * must not be silently dropped — they are counted in an "unknown" bucket and
 * flagged via staleAnswerCount / staleAnswerNote.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock ───────────────────────────────────────────────────────────────────

const selectResponses: unknown[][] = [];
let selectCallCount = 0;
let insertedValues: Record<string, unknown> | null = null;

vi.mock("@workspace/db", () => {
  function chain(resolveWith: () => unknown) {
    const c: Record<string, unknown> = {};
    c["then"] = (res: (v: unknown) => void, rej?: (e: unknown) => void) =>
      Promise.resolve(resolveWith()).then(res, rej);
    for (const m of ["from", "where", "limit", "orderBy", "set", "returning", "values", "innerJoin", "leftJoin", "groupBy"]) {
      c[m] = vi.fn().mockReturnValue(c);
    }
    return c;
  }

  const dbMock = {
    select: vi.fn().mockImplementation(() =>
      chain(() => selectResponses[selectCallCount++] ?? []),
    ),
    update: vi.fn().mockImplementation(() => chain(() => [])),
    insert: vi.fn().mockImplementation(() => {
      const c = chain(() => [{ id: 99, ...(insertedValues ?? {}) }]);
      const origValues = c["values"] as ReturnType<typeof vi.fn>;
      c["values"] = vi.fn().mockImplementation((v: Record<string, unknown>) => {
        insertedValues = v;
        return origValues(v);
      });
      return c;
    }),
  };

  return {
    db: dbMock,
    quizzes: { id: "id", isActive: "isActive", updatedAt: "updatedAt", title: "title", jabker: "jabker", skkUnitCode: "skkUnitCode", quizType: "quizType", passingScore: "passingScore" },
    quizAttempts: { id: "id", quizId: "quizId", userId: "userId", attemptType: "attemptType", scorePercent: "scorePercent", passed: "passed", completedAt: "completedAt" },
    competencyClaims: { userId: "userId", skkUnitCode: "skkUnitCode" },
  };
});

// ── Auth middleware mock ──────────────────────────────────────────────────────

vi.mock("../../middlewares/auth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as unknown as { dbUser: { id: number; role: string } }).dbUser = { id: 1, role: "admin" };
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../lib/llm", () => ({
  getClientForModel: vi.fn(),
  DEFAULT_MODEL: "test-model",
}));

import quizzesRouter from "../quizzes";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { log: { error: () => void } }).log = { error: vi.fn() };
    next();
  });
  app.use(quizzesRouter);
  return app;
}

// The quiz as it exists NOW (admin edited q1: option "c" was removed, and
// question "q2" was deleted entirely after attempts were submitted).
const quiz = {
  id: 7,
  title: "Quiz Uji",
  passingScore: 70,
  isActive: true,
  questions: [
    {
      id: "q1",
      text: "Pertanyaan 1",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      correctId: "a",
    },
  ],
};

// Attempt snapshots recorded BEFORE the edit: one user chose the now-deleted
// option "c" on q1; both users answered the now-deleted question "q2".
// These are legacy attempts (questionsSnapshot: null).
const attempts = [
  { id: 1, quizId: 7, passed: true, scorePercent: 100, answers: { q1: "a", q2: "b" }, questionsSnapshot: null },
  { id: 2, quizId: 7, passed: false, scorePercent: 0, answers: { q1: "c", q2: "a" }, questionsSnapshot: null },
];

beforeEach(() => {
  selectResponses.length = 0;
  selectCallCount = 0;
  insertedValues = null;
});

describe("participant endpoints never leak questionsSnapshot (contains correctId)", () => {
  it("POST /quizzes/:id/attempt stores the snapshot but strips it from the response", async () => {
    selectResponses.push([quiz]);

    const res = await request(makeApp())
      .post("/quizzes/7/attempt")
      .send({ answers: { q1: "a", inventedId: "x", q1b: "zzz" }, attemptType: "pre" });

    expect(res.status).toBe(200);
    // Invented question IDs / invalid options are dropped before persisting
    expect(insertedValues?.["answers"]).toEqual({ q1: "a" });
    // Snapshot WAS persisted (admin stats depend on it)…
    expect(insertedValues?.["questionsSnapshot"]).toEqual([
      { id: "q1", text: "Pertanyaan 1", options: quiz.questions[0].options, correctId: "a" },
    ]);
    // …but is never sent back to the participant
    expect(res.body.attempt).toBeDefined();
    expect(res.body.attempt.questionsSnapshot).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("correctId");
  });

  it("GET /quizzes/my-attempts strips questionsSnapshot from every row", async () => {
    selectResponses.push([
      {
        id: 1, quizId: 7, attemptType: "pre", scorePercent: 100, passed: true,
        answers: { q1: "a" },
        questionsSnapshot: quiz.questions,
        completedAt: new Date("2026-08-14T00:00:00Z"),
      },
    ]);

    const res = await request(makeApp()).get("/quizzes/my-attempts");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].questionsSnapshot).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("correctId");
  });
});

describe("GET /quizzes/admin/stats/:id with stale attempt answers", () => {
  it("counts answers referencing deleted options under an 'unknown' bucket with a note", async () => {
    selectResponses.push([quiz], attempts);

    const res = await request(makeApp()).get("/quizzes/admin/stats/7");
    expect(res.status).toBe(200);
    expect(res.body.totalAttempts).toBe(2);

    const q1 = res.body.questions.find((q: { id: string }) => q.id === "q1");
    expect(q1).toBeDefined();
    // Valid answer still counted normally
    expect(q1.optionCounts["a"]).toBe(1);
    expect(q1.optionCounts["b"]).toBe(0);
    // Stale answer ("c") surfaces in the unknown bucket instead of vanishing
    expect(q1.optionCounts["unknown"]).toBe(1);
    expect(q1.staleAnswerCount).toBe(1);
    expect(q1.staleAnswerNote).toMatch(/diubah\/dihapus/);
    // The stale answer is not the correctId, so it counts as incorrect
    expect(q1.failRate).toBe(50);
  });

  it("flags answers as stale when the option text was edited in place (same ID)", async () => {
    // The attempt snapshot shows option "b" used to say something different
    const snapshot = [{
      id: "q1",
      text: "Pertanyaan 1",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B (teks lama)" }, // text since edited by admin
      ],
      correctId: "a",
    }];
    selectResponses.push([quiz], [
      { id: 1, quizId: 7, passed: true, scorePercent: 100, answers: { q1: "a" }, questionsSnapshot: snapshot },
      { id: 2, quizId: 7, passed: false, scorePercent: 0, answers: { q1: "b" }, questionsSnapshot: snapshot },
    ]);

    const res = await request(makeApp()).get("/quizzes/admin/stats/7");
    expect(res.status).toBe(200);
    const q1 = res.body.questions.find((q: { id: string }) => q.id === "q1");
    // "a" is unchanged → counted normally; "b" was edited → stale, NOT relabelled
    expect(q1.optionCounts["a"]).toBe(1);
    expect(q1.optionCounts["b"]).toBe(0);
    expect(q1.optionCounts["unknown"]).toBe(1);
    expect(q1.staleAnswerCount).toBe(1);
    expect(q1.staleAnswerNote).toMatch(/diubah\/dihapus/);
  });

  it("flags ALL prior answers as stale when the correct answer was changed", async () => {
    // Snapshot: correctId was "b" when the user answered; admin later set "a"
    const snapshot = [{
      id: "q1",
      text: "Pertanyaan 1",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      correctId: "b",
    }];
    selectResponses.push([quiz], [
      { id: 1, quizId: 7, passed: true, scorePercent: 100, answers: { q1: "b" }, questionsSnapshot: snapshot },
    ]);

    const res = await request(makeApp()).get("/quizzes/admin/stats/7");
    const q1 = res.body.questions.find((q: { id: string }) => q.id === "q1");
    expect(q1.optionCounts["unknown"]).toBe(1);
    expect(q1.staleAnswerCount).toBe(1);
    // Correctness judged against the snapshot's correctId ("b" was correct then)
    expect(q1.failRate).toBe(0);
  });

  it("reports quiz-level counts for questions deleted after attempts (legacy, no snapshot)", async () => {
    selectResponses.push([quiz], attempts);

    const res = await request(makeApp()).get("/quizzes/admin/stats/7");
    // q2 was deleted from the quiz; both attempts answered it
    expect(res.body.removedQuestionCount).toBe(1);
    expect(res.body.removedAnswerCount).toBe(2);
    expect(res.body.removedQuestionNote).toMatch(/dihapus dari quiz/);
  });

  it("derives removed questions from the snapshot, including unanswered ones", async () => {
    // Snapshot shows the user was served q1 AND q2; q2 was later deleted.
    // The user left q2 unanswered — it must still be reported as removed.
    const snapshot = [
      { ...quiz.questions[0] },
      {
        id: "q2",
        text: "Pertanyaan 2",
        options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
        correctId: "a",
      },
    ];
    selectResponses.push([quiz], [
      { id: 1, quizId: 7, passed: true, scorePercent: 100, answers: { q1: "a" }, questionsSnapshot: snapshot },
    ]);

    const res = await request(makeApp()).get("/quizzes/admin/stats/7");
    expect(res.body.removedQuestionCount).toBe(1);
    expect(res.body.removedAnswerCount).toBe(0); // unanswered → no answer count
    expect(res.body.removedQuestionNote).toMatch(/dihapus dari quiz/);
  });

  it("ignores invented answer keys when a snapshot exists (no false deletions)", async () => {
    const snapshot = [{ ...quiz.questions[0] }];
    selectResponses.push([quiz], [
      {
        id: 1, quizId: 7, passed: true, scorePercent: 100,
        // "inventedId" was never part of the quiz — must not be reported
        answers: { q1: "a", inventedId: "x" },
        questionsSnapshot: snapshot,
      },
    ]);

    const res = await request(makeApp()).get("/quizzes/admin/stats/7");
    expect(res.body.removedQuestionCount).toBe(0);
    expect(res.body.removedAnswerCount).toBe(0);
    expect(res.body.removedQuestionNote).toBeNull();
  });

  it("omits the unknown bucket and note when all answers map to current options", async () => {
    const snapshot = [{ ...quiz.questions[0] }];
    selectResponses.push([quiz], [
      { id: 1, quizId: 7, passed: true, scorePercent: 100, answers: { q1: "a" }, questionsSnapshot: snapshot },
    ]);

    const res = await request(makeApp()).get("/quizzes/admin/stats/7");
    expect(res.status).toBe(200);
    const q1 = res.body.questions[0];
    expect(q1.optionCounts).toEqual({ a: 1, b: 0 });
    expect(q1.staleAnswerCount).toBe(0);
    expect(q1.staleAnswerNote).toBeNull();
  });
});
