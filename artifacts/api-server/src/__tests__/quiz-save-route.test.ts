/**
 * Integration tests: quiz save endpoints reject malformed questions with 400
 * BEFORE anything reaches the database.
 *
 * Covers:
 *  - POST /quizzes returns 400 for malformed questions (blank text, blank option,
 *    duplicate ID, missing correctId, empty/missing array) and db.insert is NOT called
 *  - POST /quizzes returns 201 for a valid payload
 *  - PATCH /quizzes/:id returns 400 for malformed questions and db.update is NOT called
 *  - PATCH /quizzes/:id allows omitting the questions field
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// ── auth mock — everyone is an authenticated admin ────────────────────────────
vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).dbUser = { id: 1, role: "admin" };
    next();
  },
  requireRole: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  optionalAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// ── LLM mock (imported by the routes module) ──────────────────────────────────
vi.mock("../lib/llm", () => ({
  getClientForModel: vi.fn(),
  DEFAULT_MODEL: "test-model",
}));

// ── DB mock — chainable; each awaited call pops queued value ──────────────────
const dbQueue = vi.hoisted(() => ({
  q: [] as unknown[],
  push(...items: unknown[]) { this.q.push(...items); },
  shift(): unknown { return this.q.shift() ?? []; },
  reset() { this.q = []; },
}));

const dbSpies = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  function makeChain() {
    const obj: Record<string, unknown> = {};
    obj["then"] = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(dbQueue.shift()).then(resolve, reject);
    for (const m of [
      "select", "from", "where", "leftJoin", "innerJoin", "groupBy",
      "orderBy", "limit", "values", "set", "returning",
    ]) {
      obj[m] = vi.fn().mockReturnValue(obj);
    }
    return obj;
  }
  const chain = makeChain();
  dbSpies.insert.mockReturnValue(chain);
  dbSpies.update.mockReturnValue(chain);
  return {
    db: {
      select: vi.fn().mockReturnValue(chain),
      insert: dbSpies.insert,
      update: dbSpies.update,
      delete: vi.fn().mockReturnValue(chain),
    },
    quizzes: { id: "id", isActive: "isActive", updatedAt: "updatedAt" },
    quizAttempts: {},
    competencyClaims: {},
  };
});

import quizRouter from "../routes/quizzes";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).log = { error: vi.fn() };
    next();
  });
  app.use(quizRouter);
  return app;
}

function validQuiz() {
  return {
    title: "Quiz K3",
    quizType: "learning",
    passingScore: 70,
    questions: [
      {
        id: "q1",
        text: "Apa fungsi K3?",
        options: [
          { id: "a", text: "Keselamatan" },
          { id: "b", text: "Estetika" },
        ],
        correctId: "a",
      },
      {
        id: "q2",
        text: "Siapa penanggung jawab K3?",
        options: [
          { id: "a", text: "Semua pihak" },
          { id: "b", text: "Tidak ada" },
        ],
        correctId: "a",
      },
    ],
  };
}

beforeEach(() => {
  dbQueue.reset();
  dbSpies.insert.mockClear();
  dbSpies.update.mockClear();
});

describe("POST /quizzes — malformed questions rejected with 400", () => {
  const cases: [string, (q: ReturnType<typeof validQuiz>) => object][] = [
    ["missing questions", (q) => ({ ...q, questions: undefined })],
    ["non-array questions", (q) => ({ ...q, questions: "oops" })],
    ["empty questions array", (q) => ({ ...q, questions: [] })],
    ["blank question text", (q) => {
      const body = validQuiz();
      body.questions[0]!.text = "  ";
      return body;
    }],
    ["blank option text", () => {
      const body = validQuiz();
      body.questions[0]!.options[1]!.text = "";
      return body;
    }],
    ["missing correctId", () => {
      const body = validQuiz();
      body.questions[0]!.correctId = "";
      return body;
    }],
    ["duplicate question IDs", () => {
      const body = validQuiz();
      body.questions[1]!.id = "q1";
      return body;
    }],
  ];

  for (const [label, mutate] of cases) {
    it(`returns 400 for ${label} and never touches the database`, async () => {
      const res = await request(makeApp()).post("/quizzes").send(mutate(validQuiz()));
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
      expect(dbSpies.insert).not.toHaveBeenCalled();
    });
  }

  it("returns 201 for a valid payload", async () => {
    const saved = { id: 7, ...validQuiz() };
    dbQueue.push([saved]);
    const res = await request(makeApp()).post("/quizzes").send(validQuiz());
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(7);
    expect(dbSpies.insert).toHaveBeenCalledTimes(1);
  });
});

describe("PATCH /quizzes/:id — malformed questions rejected with 400", () => {
  it("returns 400 for a blank question text and never touches the database", async () => {
    const body = { questions: [{ id: "q1", text: "", options: [], correctId: "a" }] };
    const res = await request(makeApp()).patch("/quizzes/5").send(body);
    expect(res.status).toBe(400);
    expect(dbSpies.update).not.toHaveBeenCalled();
  });

  it("returns 400 for non-array questions", async () => {
    const res = await request(makeApp()).patch("/quizzes/5").send({ questions: 42 });
    expect(res.status).toBe(400);
    expect(dbSpies.update).not.toHaveBeenCalled();
  });

  it("allows a PATCH that omits the questions field", async () => {
    dbQueue.push([{ id: 5, title: "Updated" }]);
    const res = await request(makeApp()).patch("/quizzes/5").send({ title: "Updated" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated");
    expect(dbSpies.update).toHaveBeenCalledTimes(1);
  });
});
