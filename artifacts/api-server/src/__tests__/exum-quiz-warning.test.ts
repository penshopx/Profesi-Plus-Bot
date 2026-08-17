/**
 * Integration tests: POST /chat/generate-exum quiz-failure warning contract.
 *
 * Pins the response contract for the quiz-context-unavailable path:
 *   1. buildQuizContext throws + user HAS quiz attempts
 *        → `quizContextUnavailable: true` and a visible footer note in `content`
 *   2. buildQuizContext throws + zero attempts positively confirmed
 *        → `quizContextUnavailable: false` and NO footer note
 *   3. buildQuizContext succeeds
 *        → `quizContextUnavailable: false` and NO footer note
 *
 * All external dependencies (DB, LLM, auth, rate-limiter, context builders,
 * push) are mocked so the test runs without a real database or network.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@workspace/db";
import { buildQuizContext } from "../lib/historical-pkb.js";

// ── 1. db mock — queue-based chainable stub ───────────────────────────────────

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
    obj["catch"] = (reject: (e: unknown) => void) =>
      Promise.resolve(dbState.shift()).catch(reject);
    for (const m of [
      "select", "from", "where", "orderBy", "limit",
      "innerJoin", "insert", "values", "returning",
      "update", "set", "for", "delete",
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
    conversations:      { id: "id", userId: "userId", createdAt: "createdAt" },
    messages:           { conversationId: "conversationId", createdAt: "createdAt", role: "role" },
    evidenceItems:      { conversationId: "conversationId", createdAt: "createdAt" },
    competencyAnalysis: { userId: "userId", createdAt: "createdAt" },
    usageEvents:        {},
    users:              { id: "id", exumCredits: "exumCredits", freeExumUsed: "freeExumUsed" },
    exumOutlines:       { conversationId: "conversationId", isApproved: "isApproved" },
    profiles:           { userId: "userId" },
    competencyClaims:   { userId: "userId", createdAt: "createdAt" },
    quizAttempts:       { userId: "userId", quizId: "quizId", completedAt: "completedAt" },
    quizzes:            { id: "id" },
    pkbActivities:      { userId: "userId", tanggalMulai: "tanggalMulai" },
    pkbActivitySkk:     { activityId: "activityId" },
    marketplaceWatched: { userId: "userId" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockReturnValue({}),
  and: vi.fn().mockReturnValue({}),
  ne: vi.fn().mockReturnValue({}),
  desc: vi.fn().mockReturnValue({}),
  asc: vi.fn().mockReturnValue({}),
  isNotNull: vi.fn().mockReturnValue({}),
  count: vi.fn().mockReturnValue({}),
  gte: vi.fn().mockReturnValue({}),
  inArray: vi.fn().mockReturnValue({}),
  sql: vi.fn().mockReturnValue({}),
}));

// ── 2. Auth middleware — inject a fake authenticated user (no push token) ────

vi.mock("../middlewares/auth.js", () => ({
  requireAuth: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).dbUser = {
      id: 42,
      name: "Budi Santoso",
      plan: null,
      planExpiresAt: null,
      role: "user",
      expoPushToken: null,
    };
    next();
  }),
  requireRole: vi.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
}));

// ── 3. Rate-limiter — passthrough ─────────────────────────────────────────────

vi.mock("../middlewares/rateLimiter.js", () => ({
  chatMessageRateLimiter: vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  exumRateLimiter: vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  createChatMessageRateLimiter: vi.fn(),
  createCompetencyRateLimiter: vi.fn(),
}));

// ── 4. Context builders — quiz builder controlled per test ───────────────────

vi.mock("../lib/historical-pkb.js", () => ({
  buildCompetencyAnalysisContext: vi.fn().mockResolvedValue(""),
  buildHistoricalPKBContext:      vi.fn().mockResolvedValue(""),
  buildQuizContext:               vi.fn().mockResolvedValue(""),
  buildProfileContext:            vi.fn().mockResolvedValue(""),
  buildKegiatanContext:           vi.fn().mockResolvedValue(""),
  buildWatchedModulesContext:     vi.fn().mockResolvedValue(""),
}));

vi.mock("../lib/knowledge-base.js", () => ({
  buildKnowledgeContext: vi.fn().mockResolvedValue(""),
}));

vi.mock("../lib/project-brain.js", () => ({
  buildProjectBrainContext: vi.fn().mockResolvedValue(""),
  buildProjectBrainContextWithMeta: vi.fn().mockResolvedValue({ text: "", blocks: [] }),
  markProjectBrainUsed: vi.fn(),
  getUsedProjectBrainIds: vi.fn().mockReturnValue([]),
}));

// ── 5. Push — no-op ───────────────────────────────────────────────────────────

vi.mock("../lib/push.js", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

// ── 6. LLM — non-streaming Exum response ─────────────────────────────────────

const EXUM_BODY = "EXUM_RESPONSE_BODY";

vi.mock("../lib/llm.js", () => ({
  DEFAULT_MODEL:   "gpt-4o",
  isKnownModel:    vi.fn().mockReturnValue(false),
  listModels:      vi.fn().mockReturnValue([]),
  getClientForModel: vi.fn(),
  callWithFallback: vi.fn().mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (_model: string, factory: (llm: any) => Promise<any>) => {
      const fakeClient = {
        client: {
          chat: {
            completions: {
              create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: "EXUM_RESPONSE_BODY" } }],
              }),
            },
          },
        },
        model: "gpt-4o",
      };
      const result = await factory(fakeClient);
      return { result, modelUsed: "gpt-4o" };
    },
  ),
}));

// ── 7. Persona / SKK helpers ──────────────────────────────────────────────────

vi.mock("../lib/personas.js", () => ({
  recommendPersona:       vi.fn().mockReturnValue({ id: "generalis" }),
  isKnownPersona:         vi.fn().mockReturnValue(false),
  isConfidentJabkerMatch: vi.fn().mockReturnValue(false),
  DEFAULT_PERSONA_ID:     "generalis",
  getPersona:             vi.fn().mockReturnValue({ id: "generalis", name: "Pak Budi" }),
}));

vi.mock("../lib/skk-data.js", () => ({
  findJabkerGroup: vi.fn().mockReturnValue(null),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAKE_CONV = {
  id:          1,
  userId:      42,
  title:       "Sesi Exum",
  mode:        "pkb",
  jabker:      "Ahli Muda Teknik Konstruksi",
  jenjang:     "Muda",
  phase:       "synthesis",
  model:       "gpt-4o",
  personaId:   "generalis",
  createdAt:   new Date("2026-01-01"),
  exumContent: null,
};

const FOOTER_MARKER = "Catatan sistem";
// The route capitalises the first lost-block label, so match case-insensitively.
const QUIZ_FOOTER_LABEL = /data skor quiz/i;

// ── App setup ─────────────────────────────────────────────────────────────────

async function buildApp() {
  const { default: chatRouter } = await import("../routes/chat/index.js");
  const app = express();
  app.use(express.json());
  // Stub req.log so safeCtx / handler logging works without pino-http.
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).log = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };
    next();
  });
  app.use("/api", chatRouter);
  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/chat/generate-exum — quiz-failure warning contract", () => {
  let app: express.Express;

  beforeEach(async () => {
    dbState.queue = [];
    vi.mocked(buildQuizContext).mockReset().mockResolvedValue("");
    app = await buildApp();
    // Credit reservation succeeds (paid credit).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.transaction).mockResolvedValue({ allowed: true, source: "paid" } as any);
  });

  /**
   * DB call order for a successful generate-exum request:
   *  1. loadOwnedConversation      → [FAKE_CONV]
   *  2. db.transaction             → mocked (no queue entry)
   *  3. db.select messages         → []
   *  4. db.select evidenceItems    → []
   *  5. db.select exumOutlines     → []      (only DB call in the Promise.all)
   *  (6. db.select count(quizAttempts) → [{ total: n }]  — only when quiz builder failed)
   *  7. db.update conversations    → undefined
   *  8. db.insert usageEvents      → undefined
   */

  it("sets quizContextUnavailable and appends footer when buildQuizContext throws and the user has attempts", async () => {
    vi.mocked(buildQuizContext).mockRejectedValue(new Error("db timeout"));
    // Queue includes the quizAttempts count confirmation → user HAS 3 attempts.
    dbState.push([FAKE_CONV], [], [], [], [{ total: 3 }], undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.quizContextUnavailable).toBe(true);
    expect(res.body.unavailableContextBlocks).toEqual(["quiz"]);
    expect(res.body.content).toContain(EXUM_BODY);
    expect(res.body.content).toContain(FOOTER_MARKER);
    expect(res.body.content).toMatch(QUIZ_FOOTER_LABEL);
  });

  it("suppresses the warning when buildQuizContext throws but zero attempts are positively confirmed", async () => {
    vi.mocked(buildQuizContext).mockRejectedValue(new Error("db timeout"));
    // Count confirmation returns 0 rows → nothing was lost, suppress the notice.
    dbState.push([FAKE_CONV], [], [], [], [{ total: 0 }], undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.quizContextUnavailable).toBe(false);
    expect(res.body.unavailableContextBlocks).toEqual([]);
    expect(res.body.content).toBe(EXUM_BODY);
    expect(res.body.content).not.toContain(FOOTER_MARKER);
    expect(res.body.content).not.toMatch(QUIZ_FOOTER_LABEL);
  });

  it("keeps the warning when buildQuizContext throws and the count confirmation also fails (conservative)", async () => {
    vi.mocked(buildQuizContext).mockRejectedValue(new Error("db timeout"));
    // Count query rejects → cannot confirm zero rows → keep the notice.
    // Lazy thenable (not an eager Promise.reject) so vitest doesn't flag an
    // unhandled rejection before the queue entry is consumed.
    const rejectingCount = { then: (_res: unknown, rej: (e: unknown) => void) => rej(new Error("count failed")) };
    dbState.push([FAKE_CONV], [], [], [], rejectingCount, undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.quizContextUnavailable).toBe(true);
    expect(res.body.content).toContain(FOOTER_MARKER);
    expect(res.body.content).toMatch(QUIZ_FOOTER_LABEL);
  });

  it("returns quizContextUnavailable: false and no footer when nothing fails", async () => {
    vi.mocked(buildQuizContext).mockResolvedValue("\n\n=== DATA QUIZ PKB TKK ===\nquiz ok");
    // No failure → no count query in the queue.
    dbState.push([FAKE_CONV], [], [], [], undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.quizContextUnavailable).toBe(false);
    expect(res.body.unavailableContextBlocks).toEqual([]);
    expect(res.body.content).toBe(EXUM_BODY);
    expect(res.body.content).not.toContain(FOOTER_MARKER);
  });
});
