/**
 * Integration test: POST /chat/conversations/:id/messages
 *
 * Verifies that the user's competency analysis context is included in the
 * system prompt that reaches the LLM. A regression (context silently dropped
 * due to an exception or code change) will cause this test to fail.
 *
 * All external dependencies (DB, LLM, auth, rate-limiter, context builders)
 * are mocked so the test runs without a real database or network.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, users as usersTable } from "@workspace/db";
import { callWithFallback } from "../lib/llm.js";

// ── 1. db mock ────────────────────────────────────────────────────────────────
//
// A queue-based chainable stub: each `await db.<chain>` expression pops the
// next value from the queue, so callers get the right data in call-order.

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
    conversations:    { id: "id", userId: "userId", createdAt: "createdAt" },
    messages:         { conversationId: "conversationId", createdAt: "createdAt", role: "role" },
    evidenceItems:    { conversationId: "conversationId", createdAt: "createdAt" },
    competencyAnalysis: { userId: "userId", createdAt: "createdAt" },
    usageEvents:      {},
    users:            { id: "id", exumCredits: "exumCredits" },
    exumOutlines:     {},
    profiles:         { userId: "userId" },
    competencyClaims: { userId: "userId", createdAt: "createdAt" },
    quizAttempts:     { userId: "userId", quizId: "quizId", completedAt: "completedAt" },
    quizzes:          { id: "id" },
    pkbActivities:       { userId: "userId", tanggalMulai: "tanggalMulai" },
    pkbActivitySkk:      { activityId: "activityId" },
    marketplaceWatched:  { userId: "userId" },
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

// ── 2. Auth middleware — inject a fake authenticated user ─────────────────────

vi.mock("../middlewares/auth.js", () => ({
  requireAuth: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).dbUser = {
      id: 42,
      name: "Budi Santoso",
      plan: null,
      planExpiresAt: null,
      role: "user",
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

// ── 4. Context builders — return controlled strings ───────────────────────────

const KNOWN_COMPETENCY_CONTEXT = [
  "\n\n=== ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI) ===",
  "📊 Jabker: Ahli Muda Teknik Konstruksi / Muda",
  "   🟡 Kesiapan: cukup | SKPK estimasi: 18/25",
  "   Gap utama: \"Gap A\"; \"Gap B\"",
  "   Rekomendasi: (1) Rec A | (2) Rec B",
].join("\n");

const KNOWN_PROFILE_CONTEXT = [
  "\n\n=== PROFIL APL 01 TKK ===",
  "Data identitas resmi TKK. WAJIB pakai nama dan jabatan nyata:",
  "👷 Jabatan: Manajer Proyek Konstruksi",
  "🏢 Perusahaan: PT Bangun Sejahtera",
  "📅 Pengalaman kerja: ≈16 tahun (mulai 2010)",
].join("\n");

const KNOWN_QUIZ_CONTEXT = [
  "\n\n=== DATA QUIZ PKB TKK ===",
  "Hasil quiz yang telah dikerjakan TKK. GUNAKAN ini untuk menyebut kompetensi terukur secara konkret:",
  "📘 [SKK.01.001] Manajemen Konstruksi Dasar: Pre=55% → Post=85% (peningkatan: +30%) | LULUS",
  "🏆 [SKK.02.003] Perencanaan Proyek (Proficiency): 78% — LULUS ✓",
].join("\n");

vi.mock("../lib/historical-pkb.js", () => ({
  buildCompetencyAnalysisContext: vi.fn().mockResolvedValue(KNOWN_COMPETENCY_CONTEXT),
  buildHistoricalPKBContext:      vi.fn().mockResolvedValue(""),
  buildQuizContext:               vi.fn().mockResolvedValue(KNOWN_QUIZ_CONTEXT),
  buildProfileContext:            vi.fn().mockResolvedValue(KNOWN_PROFILE_CONTEXT),
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

// ── 5. LLM — capture messages and stream a fake response ──────────────────────

/** Fake SSE stream: yields a single content chunk then done. */
async function* fakeStream(text = "Halo, saya sudah membaca profil Anda.") {
  yield { choices: [{ delta: { content: text } }] };
}

// Captured LLM call arguments — inspected per-test.
let capturedLLMMessages: Array<{ role: string; content: string }> = [];

vi.mock("../lib/llm.js", () => ({
  DEFAULT_MODEL:   "gpt-4o",
  isKnownModel:    vi.fn().mockReturnValue(false),
  listModels:      vi.fn().mockReturnValue([]),
  callWithFallback: vi.fn().mockImplementation(
    async (_model: string, factory: (llm: any) => Promise<any>) => {
      const fakeClient = {
        client: {
          chat: {
            completions: {
              create: vi.fn().mockImplementation((opts: any) => {
                capturedLLMMessages = opts.messages;
                return fakeStream();
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

// ── 6. Persona / SKK helpers (no real data needed) ───────────────────────────

vi.mock("../lib/personas.js", () => ({
  recommendPersona:        vi.fn().mockReturnValue({ id: "generalis" }),
  isKnownPersona:          vi.fn().mockReturnValue(false),
  isConfidentJabkerMatch:  vi.fn().mockReturnValue(false),
  DEFAULT_PERSONA_ID:      "generalis",
  getPersona:              vi.fn().mockReturnValue({ id: "generalis", name: "Pak Budi" }),
}));

vi.mock("../lib/skk-data.js", () => ({
  findJabkerGroup: vi.fn().mockReturnValue(null),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAKE_CONV = {
  id:         1,
  userId:     42,
  title:      "Sesi Exum",
  mode:       "pkb",
  jabker:     "Ahli Muda Teknik Konstruksi",
  jenjang:    "Muda",
  phase:      "profiling",
  model:      "gpt-4o",
  personaId:  "generalis",
  createdAt:  new Date("2026-01-01"),
  exumContent: null,
};

const FAKE_USER_MSG = {
  id:             10,
  conversationId: 1,
  role:           "user",
  content:        "Halo",
  createdAt:      new Date("2026-01-01T10:00:00Z"),
};

// ── App setup ─────────────────────────────────────────────────────────────────

async function buildApp() {
  const { default: chatRouter } = await import("../routes/chat/index.js");
  const app = express();
  app.use(express.json());
  // Stub req.log so safeCtx can call req.log.warn/error without pino-http.
  // Without this, a builder exception causes req.log.warn() to throw a TypeError
  // (req.log is undefined) and the handler returns 500 instead of falling back gracefully.
  app.use((_req: any, _res: express.Response, next: express.NextFunction) => {
    (_req as any).log = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };
    next();
  });
  // pino-http and clerk are not needed for these tests — the router is mounted directly.
  app.use("/api", chatRouter);
  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/chat/conversations/:id/messages", () => {
  let app: express.Express;

  beforeEach(async () => {
    capturedLLMMessages = [];
    dbState.queue = [];
    app = await buildApp();
  });

  it("includes competency analysis context in the system prompt sent to the LLM", async () => {
    // DB call order in the handler:
    //   1. loadOwnedConversation   → [FAKE_CONV]
    //   2. db.insert(messages)     → undefined  (user message insert)
    //   3. db.select messages      → [FAKE_USER_MSG]
    //   4. db.select evidenceItems → []
    // Context builders are mocked, so no more DB calls.
    //   5. db.insert(messages)     → undefined  (assistant message insert)
    // No phase marker in the fake response, so no phase update.
    dbState.push([FAKE_CONV], undefined, [FAKE_USER_MSG], [], undefined);

    const res = await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({ content: "Halo" });

    // The route streams SSE — accept 200 with text/event-stream.
    expect(res.status).toBe(200);

    // The system prompt is the first message in capturedLLMMessages.
    expect(capturedLLMMessages.length).toBeGreaterThan(0);
    const systemMessage = capturedLLMMessages[0];
    expect(systemMessage.role).toBe("system");

    // The known competency context string must appear verbatim in the system prompt.
    expect(systemMessage.content).toContain("ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI)");
    expect(systemMessage.content).toContain("Ahli Muda Teknik Konstruksi");
    expect(systemMessage.content).toContain("SKPK estimasi: 18/25");
    expect(systemMessage.content).toContain("Gap A");
    expect(systemMessage.content).toContain("Rec A");
  });

  it("includes the user's real APL 01 profile in the system prompt sent to the LLM", async () => {
    dbState.push([FAKE_CONV], undefined, [FAKE_USER_MSG], [], undefined);

    const res = await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({ content: "Halo" });

    expect(res.status).toBe(200);

    const systemMessage = capturedLLMMessages[0];
    expect(systemMessage.role).toBe("system");

    // The known profile context string must appear in the system prompt so the
    // AI can reference the user's real job title and company — not generic placeholders.
    expect(systemMessage.content).toContain("PROFIL APL 01 TKK");
    expect(systemMessage.content).toContain("Manajer Proyek Konstruksi");
    expect(systemMessage.content).toContain("PT Bangun Sejahtera");
  });

  it("calls buildCompetencyAnalysisContext with the authenticated user's ID", async () => {
    dbState.push([FAKE_CONV], undefined, [FAKE_USER_MSG], [], undefined);

    await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({ content: "Halo" });

    const { buildCompetencyAnalysisContext } = await import("../lib/historical-pkb.js");
    expect(vi.mocked(buildCompetencyAnalysisContext)).toHaveBeenCalledWith(42);
  });

  it("calls buildProfileContext with the authenticated user's ID", async () => {
    dbState.push([FAKE_CONV], undefined, [FAKE_USER_MSG], [], undefined);

    await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({ content: "Halo" });

    const { buildProfileContext } = await import("../lib/historical-pkb.js");
    expect(vi.mocked(buildProfileContext)).toHaveBeenCalledWith(42);
  });

  it("includes quiz context in the system prompt sent to the LLM", async () => {
    dbState.push([FAKE_CONV], undefined, [FAKE_USER_MSG], [], undefined);

    const res = await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({ content: "Halo" });

    expect(res.status).toBe(200);

    const systemMessage = capturedLLMMessages[0];
    expect(systemMessage.role).toBe("system");

    // Quiz context must appear verbatim so the AI can reference measured competency scores.
    expect(systemMessage.content).toContain("DATA QUIZ PKB TKK");
    expect(systemMessage.content).toContain("SKK.01.001");
    expect(systemMessage.content).toContain("Pre=55%");
    expect(systemMessage.content).toContain("Post=85%");
    expect(systemMessage.content).toContain("SKK.02.003");
  });

  it("does not return 500 and falls back to empty string when buildProfileContext throws", async () => {
    const { buildProfileContext } = await import("../lib/historical-pkb.js");
    vi.mocked(buildProfileContext).mockRejectedValueOnce(new Error("DB connection lost"));

    dbState.push([FAKE_CONV], undefined, [FAKE_USER_MSG], [], undefined);

    const res = await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({ content: "Halo" });

    // The handler must absorb the exception and still complete the chat request.
    // A 500 here would mean the user's entire session is broken — not acceptable.
    expect(res.status).toBe(200);

    // The system prompt must still be sent (minus the profile block), and other
    // context (e.g. competency) must still appear so the session is not fully generic.
    const systemMessage = capturedLLMMessages[0];
    expect(systemMessage.role).toBe("system");
    expect(systemMessage.content).toContain("ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI)");
  });

  it("does not return 500 and falls back to empty string when buildQuizContext throws", async () => {
    const { buildQuizContext } = await import("../lib/historical-pkb.js");
    vi.mocked(buildQuizContext).mockRejectedValueOnce(new Error("Quiz table unavailable"));

    dbState.push([FAKE_CONV], undefined, [FAKE_USER_MSG], [], undefined);

    const res = await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({ content: "Halo" });

    // Must be 200 — a quiz DB failure must not crash the whole chat endpoint.
    expect(res.status).toBe(200);

    // Profile and competency context must still be present despite the quiz failure.
    const systemMessage = capturedLLMMessages[0];
    expect(systemMessage.role).toBe("system");
    expect(systemMessage.content).toContain("PROFIL APL 01 TKK");
    expect(systemMessage.content).toContain("ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI)");
  });

  it("does not return 500 and falls back to empty string when buildKnowledgeContext throws", async () => {
    const { buildKnowledgeContext } = await import("../lib/knowledge-base.js");
    vi.mocked(buildKnowledgeContext).mockRejectedValueOnce(new Error("KB file I/O error"));

    dbState.push([FAKE_CONV], undefined, [FAKE_USER_MSG], [], undefined);

    const res = await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({ content: "Halo" });

    // A knowledge-base failure must not crash the chat — the user's session must continue.
    expect(res.status).toBe(200);

    // Competency and profile context must still appear in the system prompt even
    // though the knowledge block failed.
    const systemMessage = capturedLLMMessages[0];
    expect(systemMessage.role).toBe("system");
    expect(systemMessage.content).toContain("ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI)");
    expect(systemMessage.content).toContain("PROFIL APL 01 TKK");
  });

  it("does not return 500 and falls back to empty string when buildProjectBrainContext throws", async () => {
    const { buildProjectBrainContextWithMeta } = await import("../lib/project-brain.js");
    vi.mocked(buildProjectBrainContextWithMeta).mockRejectedValueOnce(new Error("Project brain DB schema change"));

    dbState.push([FAKE_CONV], undefined, [FAKE_USER_MSG], [], undefined);

    const res = await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({ content: "Halo" });

    // A project-brain failure must not crash the chat — the user's session must continue.
    expect(res.status).toBe(200);

    // Competency and profile context must still appear in the system prompt even
    // though the project-brain block failed.
    const systemMessage = capturedLLMMessages[0];
    expect(systemMessage.role).toBe("system");
    expect(systemMessage.content).toContain("ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI)");
    expect(systemMessage.content).toContain("PROFIL APL 01 TKK");
  });

  it("does not return 500 and falls back to empty string when buildKegiatanContext throws", async () => {
    const { buildKegiatanContext } = await import("../lib/historical-pkb.js");
    vi.mocked(buildKegiatanContext).mockRejectedValueOnce(new Error("pkb_activities table unavailable"));

    dbState.push([FAKE_CONV], undefined, [FAKE_USER_MSG], [], undefined);

    const res = await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({ content: "Halo" });

    // A kegiatan DB failure must not crash the chat — the session must continue.
    expect(res.status).toBe(200);

    // Other context blocks must still appear despite the kegiatan failure.
    const systemMessage = capturedLLMMessages[0];
    expect(systemMessage.role).toBe("system");
    expect(systemMessage.content).toContain("ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI)");
    expect(systemMessage.content).toContain("PROFIL APL 01 TKK");
  });

  it("does not return 500 and falls back to empty string when buildWatchedModulesContext throws", async () => {
    const { buildWatchedModulesContext } = await import("../lib/historical-pkb.js");
    vi.mocked(buildWatchedModulesContext).mockRejectedValueOnce(new Error("marketplace_watched table unavailable"));

    dbState.push([FAKE_CONV], undefined, [FAKE_USER_MSG], [], undefined);

    const res = await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({ content: "Halo" });

    // A watched-modules DB failure must not crash the chat.
    expect(res.status).toBe(200);

    const systemMessage = capturedLLMMessages[0];
    expect(systemMessage.role).toBe("system");
    expect(systemMessage.content).toContain("ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI)");
    expect(systemMessage.content).toContain("PROFIL APL 01 TKK");
  });

  it("returns 404 when the conversation does not belong to the user", async () => {
    // loadOwnedConversation returns a conversation owned by a different user
    dbState.push([{ ...FAKE_CONV, userId: 999 }]);

    const res = await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({ content: "Halo" });

    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent conversation", async () => {
    dbState.push([]); // no conversation found

    const res = await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({ content: "Halo" });

    expect(res.status).toBe(404);
  });

  it("returns 400 when content is missing", async () => {
    const res = await request(app)
      .post("/api/chat/conversations/1/messages")
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: POST /api/chat/generate-exum
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DB call order inside generate-exum for a successful request:
 *  1. loadOwnedConversation  → db.select → [FAKE_CONV]
 *  2. db.transaction         → mocked per-test (no queue entry)
 *  3. db.select messages     → []
 *  4. db.select evidenceItems → []
 *  5. Promise.all: db.select exumOutlines (.then() on chain) → []
 *  6. callWithFallback       → no DB
 *  7. db.update conversations → undefined
 *  8. db.insert usageEvents  → undefined
 */
describe("POST /api/chat/generate-exum", () => {
  let app: express.Express;

  /** Re-usable standard callWithFallback factory (captures messages, streams fake response). */
  function installStandardLLMMock() {
    vi.mocked(callWithFallback).mockImplementation(
      async (_model: string, factory: (llm: any) => Promise<any>) => {
        const fakeClient = {
          client: {
            chat: {
              completions: {
                create: vi.fn().mockImplementation((opts: any) => {
                  capturedLLMMessages = opts.messages;
                  // generate-exum reads result.choices[0]?.message?.content (non-streaming).
                  // Return an object that satisfies that path.
                  return { choices: [{ message: { content: "EXUM_RESPONSE" } }] };
                }),
              },
            },
          },
          model: "gpt-4o",
        };
        const result = await factory(fakeClient);
        return { result, modelUsed: "gpt-4o" };
      },
    );
  }

  beforeEach(async () => {
    capturedLLMMessages = [];
    dbState.queue = [];
    app = await buildApp();
    installStandardLLMMock();
    // Default: transaction allows a paid credit.
    vi.mocked(db.transaction).mockResolvedValue({ allowed: true, source: "paid" } as any);
  });

  it("includes competency analysis context in the Exum LLM prompt", async () => {
    // Queue: conv, messages, evidenceItems, exumOutlines, update conv, insert usageEvents
    dbState.push([FAKE_CONV], [], [], [], undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    expect(res.status).toBe(200);

    // generate-exum sends a single user message whose content is the full prompt.
    expect(capturedLLMMessages.length).toBeGreaterThan(0);
    const prompt = capturedLLMMessages[0];
    expect(prompt.role).toBe("user");

    // Competency context from buildCompetencyAnalysisContext must appear verbatim.
    expect(prompt.content).toContain("ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI)");
    expect(prompt.content).toContain("SKPK estimasi: 18/25");
    expect(prompt.content).toContain("Gap A");
    expect(prompt.content).toContain("Rec A");
  });

  it("includes the user's real APL 01 profile in the Exum LLM prompt", async () => {
    dbState.push([FAKE_CONV], [], [], [], undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    expect(res.status).toBe(200);

    const prompt = capturedLLMMessages[0];
    expect(prompt.role).toBe("user");

    // Profile context from buildProfileContext must appear so the Exum references the
    // user's real job title and employer — not generic placeholders.
    expect(prompt.content).toContain("PROFIL APL 01 TKK");
    expect(prompt.content).toContain("Manajer Proyek Konstruksi");
    expect(prompt.content).toContain("PT Bangun Sejahtera");
  });

  it("calls buildCompetencyAnalysisContext and buildProfileContext with the authenticated user's ID", async () => {
    dbState.push([FAKE_CONV], [], [], [], undefined, undefined);

    await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    const { buildCompetencyAnalysisContext, buildProfileContext } = await import("../lib/historical-pkb.js");
    expect(vi.mocked(buildCompetencyAnalysisContext)).toHaveBeenCalledWith(42);
    expect(vi.mocked(buildProfileContext)).toHaveBeenCalledWith(42);
  });

  it("includes quiz context in the Exum LLM prompt", async () => {
    dbState.push([FAKE_CONV], [], [], [], undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    expect(res.status).toBe(200);

    const prompt = capturedLLMMessages[0];
    expect(prompt.role).toBe("user");

    // Quiz context from buildQuizContext must appear so the Exum references
    // the user's measured competency scores — not generic descriptions.
    expect(prompt.content).toContain("DATA QUIZ PKB TKK");
    expect(prompt.content).toContain("SKK.01.001");
    expect(prompt.content).toContain("Pre=55%");
    expect(prompt.content).toContain("Post=85%");
    expect(prompt.content).toContain("SKK.02.003");
  });

  it("includes the approved outline blueprint in the Exum LLM prompt and does not evict profile or competency context", async () => {
    // Seed a fake approved exumOutlines row with two sections, one with userNotes.
    const APPROVED_OUTLINE_ROW = {
      id: 99,
      conversationId: 1,
      isApproved: true,
      sections: [
        {
          title: "Latar Belakang Profesional",
          points: ["Pengalaman kerja 16 tahun", "Spesialisasi manajemen proyek"],
          userNotes: "Tolong tekankan proyek besar di Kalimantan",
        },
        {
          title: "Pencapaian Kompetensi SKK",
          points: ["SKK.01.001 lulus dengan skor 85%"],
        },
      ],
    };

    // DB call order:
    //   1. loadOwnedConversation → [FAKE_CONV]
    //   2. db.select messages    → []
    //   3. db.select evidenceItems → []
    //   4. exumOutlines .then()  → [APPROVED_OUTLINE_ROW]  (approved outline present)
    //   5. db.update conversations → undefined
    //   6. db.insert usageEvents  → undefined
    dbState.push([FAKE_CONV], [], [], [APPROVED_OUTLINE_ROW], undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    expect(res.status).toBe(200);

    expect(capturedLLMMessages.length).toBeGreaterThan(0);
    const prompt = capturedLLMMessages[0];
    expect(prompt.role).toBe("user");

    // Blueprint heading must appear — this is the highest-priority context block that
    // carries the user-approved document structure to the LLM.
    expect(prompt.content).toContain("BLUEPRINT YANG TELAH DISETUJUI PENGGUNA");

    // At least one section title from the approved outline must be present so the LLM
    // uses the right document skeleton.
    expect(prompt.content).toContain("Latar Belakang Profesional");

    // userNotes for a section must also reach the prompt.
    expect(prompt.content).toContain("Tolong tekankan proyek besar di Kalimantan");

    // Profile and competency context must still be present — the outline block must not
    // have evicted them from the shared budget.
    expect(prompt.content).toContain("PROFIL APL 01 TKK");
    expect(prompt.content).toContain("ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI)");
  });

  it("does not return 500 and still returns 200 when buildProfileContext throws during Exum generation", async () => {
    const { buildProfileContext } = await import("../lib/historical-pkb.js");
    vi.mocked(buildProfileContext).mockRejectedValueOnce(new Error("Profile DB unreachable"));

    dbState.push([FAKE_CONV], [], [], [], undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    // safeExumCtx must absorb the exception — a profile DB failure must never
    // crash the entire Exum generation and cost the user their credit.
    expect(res.status).toBe(200);

    // The Exum should still be generated; other context (e.g. competency) must
    // still reach the prompt even when profile is unavailable.
    const prompt = capturedLLMMessages[0];
    expect(prompt.role).toBe("user");
    expect(prompt.content).toContain("ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI)");
  });

  it("does not return 500 and still returns 200 when buildQuizContext throws during Exum generation", async () => {
    const { buildQuizContext } = await import("../lib/historical-pkb.js");
    vi.mocked(buildQuizContext).mockRejectedValueOnce(new Error("Quiz table unavailable"));

    // When quiz context throws AND user has zero attempts the footer is suppressed.
    // Pass 0 for the count so we get a clean 200 without the footer complicating the assertion.
    dbState.push([FAKE_CONV], [], [], [], [{ total: 0 }], undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    // safeExumCtx must absorb the exception — a quiz DB failure must not crash
    // Exum generation and must not charge the user a credit.
    expect(res.status).toBe(200);

    // Profile and competency context must still reach the prompt.
    const prompt = capturedLLMMessages[0];
    expect(prompt.role).toBe("user");
    expect(prompt.content).toContain("PROFIL APL 01 TKK");
    expect(prompt.content).toContain("ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI)");
  });

  it("does not return 500 and still returns 200 when buildKegiatanContext throws during Exum generation", async () => {
    const { buildKegiatanContext } = await import("../lib/historical-pkb.js");
    vi.mocked(buildKegiatanContext).mockRejectedValueOnce(new Error("pkb_activities table unavailable"));

    dbState.push([FAKE_CONV], [], [], [], undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    // safeExumCtx must absorb the exception — a kegiatan DB failure must never
    // crash Exum generation and cost the user their credit.
    expect(res.status).toBe(200);

    // Profile and competency context must still reach the prompt.
    const prompt = capturedLLMMessages[0];
    expect(prompt.role).toBe("user");
    expect(prompt.content).toContain("PROFIL APL 01 TKK");
    expect(prompt.content).toContain("ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI)");
  });

  it("does not return 500 and still returns 200 when buildWatchedModulesContext throws during Exum generation", async () => {
    const { buildWatchedModulesContext } = await import("../lib/historical-pkb.js");
    vi.mocked(buildWatchedModulesContext).mockRejectedValueOnce(new Error("marketplace_watched table unavailable"));

    dbState.push([FAKE_CONV], [], [], [], undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    // safeExumCtx must absorb the exception — a watched-modules DB failure must
    // never crash Exum generation and cost the user their credit.
    expect(res.status).toBe(200);

    // Profile and competency context must still reach the prompt.
    const prompt = capturedLLMMessages[0];
    expect(prompt.role).toBe("user");
    expect(prompt.content).toContain("PROFIL APL 01 TKK");
    expect(prompt.content).toContain("ANALISIS KOMPETENSI TKK (STUDIO KOMPETENSI)");
  });

  it("refunds the reserved credit and returns 503 when the LLM call fails", async () => {
    // Queue items consumed before the LLM call: conv, messages, evidenceItems, exumOutlines
    dbState.push([FAKE_CONV], [], [], []);
    // Refund path: db.update(users).set(...).where(...).catch(() => {})
    // The chain's .catch() pops one item from the queue — empty queue returns [] by default.

    // Make the LLM throw so the refund path is triggered.
    vi.mocked(callWithFallback).mockRejectedValueOnce(new Error("All providers unavailable"));

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    // The inner catch returns 503 with a message that credits were not deducted.
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/kredit tidak dikurangi/i);

    // Refund: db.update must have been called with the users table (to restore exumCredits).
    expect(vi.mocked(db.update)).toHaveBeenCalledWith(usersTable);
  });

  it("refunds the reserved credit and returns 500 when db.update(conversations) throws after a successful LLM response", async () => {
    // DB call order:
    //  1. loadOwnedConversation          → [FAKE_CONV]
    //  2. db.select messages             → []
    //  3. db.select evidenceItems        → []
    //  4. Promise.all exumOutlines       → []
    //  5. callWithFallback               → succeeds (standard mock)
    //  6. db.update conversations        → THROWS (e.g. primary key violation / connection lost)
    // Outer catch fires → refundReservation() → db.update(users).catch(() => {}) pops from queue (empty → [] default)
    // Create the rejected promise first and suppress the synchronous unhandled-rejection
    // warning by attaching a no-op .catch(). The chain's .then(resolve, reject) will
    // still receive the rejection when it consumes this queue entry.
    const convUpdateReject = Promise.reject(new Error("DB connection lost during conversation update"));
    convUpdateReject.catch(() => {});
    dbState.push(
      [FAKE_CONV], // 1. conversation
      [],          // 2. messages
      [],          // 3. evidenceItems
      [],          // 4. exumOutlines
      convUpdateReject, // 5. conversations update throws
    );

    // Clear call history so we only assert on invocations from THIS request,
    // not from earlier tests in the suite that may also have called db.update(usersTable).
    vi.mocked(db.update).mockClear();

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    // Outer catch must return 500 — not 503 (that's the inner LLM-failure path).
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to generate/i);

    // Refund: the outer catch must have called db.update with the users table
    // (to restore exumCredits) after the conversations update failed.
    // We cleared the mock before the request, so any users-table invocation here
    // belongs exclusively to the refund path in this request.
    expect(vi.mocked(db.update)).toHaveBeenCalledWith(usersTable);
  });

  it("returns 402 when the user has no credits and has already used the free trial", async () => {
    dbState.push([FAKE_CONV]);
    // Transaction returns denied.
    vi.mocked(db.transaction).mockResolvedValue({ allowed: false } as any);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    expect(res.status).toBe(402);
    expect(res.body.code).toBe("plan_limit");
  });

  it("returns 400 when conversationId is missing", async () => {
    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 404 when the conversation does not belong to the authenticated user", async () => {
    dbState.push([{ ...FAKE_CONV, userId: 999 }]);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    expect(res.status).toBe(404);
  });

  it("appends a quiz-unavailable footer when buildQuizContext throws and user has attempts", async () => {
    // Simulate a DB outage that causes the quiz context builder to throw.
    const { buildQuizContext } = await import("../lib/historical-pkb.js");
    vi.mocked(buildQuizContext).mockRejectedValueOnce(new Error("Quiz table unavailable"));

    // DB call order with quiz failure:
    //   1. loadOwnedConversation          → [FAKE_CONV]
    //   2. db.select messages             → []
    //   3. db.select evidenceItems        → []
    //   4. Promise.all exumOutlines       → []  (no approved outline)
    //   5. quiz attempt count query       → [{ total: 2 }]  (user has attempts → show footer)
    //   6. db.update conversations        → undefined
    //   7. db.insert usageEvents          → undefined
    dbState.push([FAKE_CONV], [], [], [], [{ total: 2 }], undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    // Request must still succeed — a quiz DB failure must not kill the Exum.
    expect(res.status).toBe(200);

    // The footer notice must appear in both the response body (what the client sees)
    // and will be identical to what is persisted (content === finalExumResponse).
    expect(res.body.content).toContain("EXUM_RESPONSE");
    expect(res.body.content).toContain("Data skor quiz tidak dapat dimuat");
  });

  it("still appends the quiz-unavailable footer when the attempt count query also fails", async () => {
    // Both the quiz context builder and the follow-up count query fail.
    // The handler must fail conservatively and still deliver the user notice.
    const { buildQuizContext } = await import("../lib/historical-pkb.js");
    vi.mocked(buildQuizContext).mockRejectedValueOnce(new Error("Quiz table unavailable"));

    // Push null for the count query slot: Promise.resolve(null) resolves with null,
    // and `const [quizCountRow] = null` throws a TypeError that is caught by the
    // try/catch around the count query — triggering the conservative "keep footer" path.
    dbState.push([FAKE_CONV], [], [], [], null, undefined, undefined);

    const res = await request(app)
      .post("/api/chat/generate-exum")
      .send({ conversationId: 1 });

    expect(res.status).toBe(200);
    // Conservative: footer must still appear even when count query itself fails.
    expect(res.body.content).toContain("Data skor quiz tidak dapat dimuat");
  });
});
