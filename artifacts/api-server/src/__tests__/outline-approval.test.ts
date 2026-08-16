/**
 * Integration tests: POST /outlines/:conversationId/approve persists approval.
 *
 * The generate-exum path reads the approved outline (isApproved=true) from
 * exumOutlines — these tests confirm the approval endpoint actually writes
 * isApproved=true (plus approvedAt/updatedAt) scoped to the right
 * conversationId + userId, and echoes the updated row back.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// ── auth mock — everyone is authenticated user id 1 ──────────────────────────
vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).dbUser = { id: 1, role: "user" };
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

// ── drizzle-orm mock — makes where() arguments inspectable ───────────────────
vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ op: "eq", col, val }),
  and: (...conds: unknown[]) => ({ op: "and", conds }),
}));

// ── DB mock — chainable; each awaited call pops queued value ──────────────────
const dbQueue = vi.hoisted(() => ({
  q: [] as unknown[],
  push(...items: unknown[]) { this.q.push(...items); },
  shift(): unknown { return this.q.shift() ?? []; },
  reset() { this.q = []; },
}));

const dbSpies = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  function makeChain() {
    const obj: Record<string, unknown> = {};
    obj["then"] = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(dbQueue.shift()).then(resolve, reject);
    for (const m of [
      "select", "from", "leftJoin", "innerJoin", "groupBy",
      "orderBy", "limit", "values", "returning", "onConflictDoUpdate",
    ]) {
      obj[m] = vi.fn().mockReturnValue(obj);
    }
    obj["set"] = dbSpies.set.mockReturnValue(obj);
    obj["where"] = dbSpies.where.mockReturnValue(obj);
    return obj;
  }
  const chain = makeChain();
  dbSpies.update.mockReturnValue(chain);
  return {
    db: {
      select: vi.fn().mockReturnValue(chain),
      insert: vi.fn().mockReturnValue(chain),
      update: dbSpies.update,
      delete: vi.fn().mockReturnValue(chain),
    },
    exumOutlines: {
      conversationId: "exumOutlines.conversationId",
      userId: "exumOutlines.userId",
      isApproved: "exumOutlines.isApproved",
    },
    conversations: {},
    evidenceItems: {},
    messages: {},
  };
});

import outlinesRouter from "../routes/outlines";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).log = { error: vi.fn(), warn: vi.fn() };
    next();
  });
  app.use(outlinesRouter);
  return app;
}

beforeEach(() => {
  dbQueue.reset();
  dbSpies.update.mockClear();
  dbSpies.set.mockClear();
  dbSpies.where.mockClear();
});

describe("POST /outlines/:conversationId/approve", () => {
  it("writes isApproved=true with approvedAt/updatedAt and returns the updated row", async () => {
    const sections = [
      { id: "s1", title: "Identitas", points: ["a"], userNotes: "", order: 1 },
    ];
    const updatedRow = {
      id: 9,
      conversationId: 42,
      userId: 1,
      sections,
      isApproved: true,
    };
    dbQueue.push([updatedRow]);

    const res = await request(makeApp()).post("/outlines/42/approve").send();

    expect(res.status).toBe(200);
    // Response echoes the updated row (what the DB returned)
    expect(res.body).toMatchObject({
      id: 9,
      conversationId: 42,
      isApproved: true,
      sections,
    });

    // db.update was performed exactly once with the approval payload
    expect(dbSpies.update).toHaveBeenCalledTimes(1);
    expect(dbSpies.set).toHaveBeenCalledTimes(1);
    const setPayload = dbSpies.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setPayload.isApproved).toBe(true);
    expect(setPayload.approvedAt).toBeInstanceOf(Date);
    expect(setPayload.updatedAt).toBeInstanceOf(Date);

    // Scoped to the requested conversation AND the authenticated user
    expect(dbSpies.where).toHaveBeenCalledTimes(1);
    expect(dbSpies.where.mock.calls[0]![0]).toEqual({
      op: "and",
      conds: [
        { op: "eq", col: "exumOutlines.conversationId", val: 42 },
        { op: "eq", col: "exumOutlines.userId", val: 1 },
      ],
    });
  });

  it("returns 404 when no outline row matches (nothing updated)", async () => {
    dbQueue.push([]); // update ... returning() yields no rows

    const res = await request(makeApp()).post("/outlines/999/approve").send();

    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
    // The update was still scoped to conversation 999 + user 1
    expect(dbSpies.where.mock.calls[0]![0]).toEqual({
      op: "and",
      conds: [
        { op: "eq", col: "exumOutlines.conversationId", val: 999 },
        { op: "eq", col: "exumOutlines.userId", val: 1 },
      ],
    });
  });
});
