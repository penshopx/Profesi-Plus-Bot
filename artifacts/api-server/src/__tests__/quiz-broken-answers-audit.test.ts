/**
 * Route tests: GET /quizzes/admin/broken-answers
 *
 * Covers:
 *  - detects questions whose correctId is not among the option IDs
 *  - includes inactive quizzes in the scan
 *  - returns an empty result when all quizzes are healthy
 *  - requires the admin role (403 for non-admins)
 *  - static /quizzes/admin/* paths are NOT captured by the dynamic /quizzes/:id route
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// ── auth mock — role is switchable per test ───────────────────────────────────
const authState = vi.hoisted(() => ({ role: "admin" }));

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).dbUser = { id: 1, role: authState.role };
    next();
  },
  requireRole: (role: string) => (req: Request, res: Response, next: NextFunction) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((req as any).dbUser?.role !== role) { res.status(403).json({ error: "Forbidden" }); return; }
    next();
  },
  optionalAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

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
  return {
    db: {
      select: vi.fn().mockReturnValue(chain),
      insert: vi.fn().mockReturnValue(chain),
      update: vi.fn().mockReturnValue(chain),
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
  app.use(quizRouter);
  return app;
}

function quizRow(id: number, isActive: boolean, correctId: string) {
  return {
    id,
    title: `Quiz ${id}`,
    isActive,
    questions: [
      {
        id: "q1",
        text: "Soal pertama",
        options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
        correctId,
      },
    ],
  };
}

beforeEach(() => {
  dbQueue.reset();
  authState.role = "admin";
});

describe("GET /quizzes/admin/broken-answers", () => {
  it("flags quizzes whose correctId matches no option, including inactive ones", async () => {
    dbQueue.push([
      quizRow(1, true, "a"),        // healthy
      quizRow(2, true, "zz"),       // broken, active
      quizRow(3, false, "nope"),    // broken, inactive — must still be scanned
    ]);
    const res = await request(makeApp()).get("/quizzes/admin/broken-answers");
    expect(res.status).toBe(200);
    expect(res.body.scanned).toBe(3);
    expect(res.body.brokenCount).toBe(2);
    const ids = res.body.broken.map((b: { quizId: number }) => b.quizId);
    expect(ids).toEqual([2, 3]);
    expect(res.body.broken[0].brokenQuestions).toEqual([
      { number: 1, id: "q1", text: "Soal pertama", correctId: "zz" },
    ]);
    expect(res.body.broken[1].isActive).toBe(false);
  });

  it("returns an empty audit when every quiz is healthy", async () => {
    dbQueue.push([quizRow(1, true, "a"), quizRow(2, false, "b")]);
    const res = await request(makeApp()).get("/quizzes/admin/broken-answers");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ scanned: 2, brokenCount: 0, broken: [] });
  });

  it("tolerates quizzes with null/empty questions", async () => {
    dbQueue.push([{ id: 9, title: "Kosong", isActive: true, questions: null }]);
    const res = await request(makeApp()).get("/quizzes/admin/broken-answers");
    expect(res.status).toBe(200);
    expect(res.body.brokenCount).toBe(0);
  });

  it("rejects non-admin users with 403", async () => {
    authState.role = "user";
    const res = await request(makeApp()).get("/quizzes/admin/broken-answers");
    expect(res.status).toBe(403);
  });
});

describe("static /quizzes/admin/* paths are not captured by /quizzes/:id", () => {
  it("GET /quizzes/admin/all hits the admin list, not the :id route", async () => {
    dbQueue.push([quizRow(1, true, "a")]);
    const res = await request(makeApp()).get("/quizzes/admin/all");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /quizzes/admin/all-stats hits the stats route, not the :id route", async () => {
    dbQueue.push([{ quizId: 1, totalAttempts: 0, avgScore: 0, passCount: 0 }]);
    const res = await request(makeApp()).get("/quizzes/admin/all-stats");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ quizId: 1, totalAttempts: 0, avgScore: 0, passRate: 0 }]);
  });

  it("GET /quizzes/:id with a non-numeric id returns 404, never NaN queries", async () => {
    const res = await request(makeApp()).get("/quizzes/abc");
    expect(res.status).toBe(404);
  });
});
