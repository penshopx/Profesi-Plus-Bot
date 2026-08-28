/**
 * Contract test: the degradation footer the API server appends to an Exum
 * (routes/chat generate-exum, "Catatan sistem" block) MUST be detected by
 * BOTH clients' `parseExumDegradation` helpers.
 *
 * The footer string is produced by driving the real server code path (the
 * generate-exum route with a failing quiz-context builder), not by a
 * hand-copied fixture — so if anyone rewords the server footer, this test
 * fails instead of users silently losing the amber warning callout.
 *
 * Also pins the negative case: ordinary `---` horizontal rules in normal
 * Exum markdown must NOT be flagged as a degradation footer.
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { db } from "@workspace/db";
import { buildQuizContext } from "../lib/historical-pkb.js";

type DegradationParser = (content: string) => {
  body: string;
  degradationNote: string | null;
};

let parseWeb: DegradationParser;
let parseMobile: DegradationParser;

// ── db mock — queue-based chainable stub (same harness as exum-quiz-warning) ──

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

vi.mock("../middlewares/rateLimiter.js", () => ({
  chatMessageRateLimiter: vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  exumRateLimiter: vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  createChatMessageRateLimiter: vi.fn(),
  createCompetencyRateLimiter: vi.fn(),
}));

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

vi.mock("../lib/push.js", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

// LLM mock returns a fixed Exum body that ALSO contains ordinary `---`
// horizontal rules, so the same round-trip proves the clients do not
// mis-detect mid-document rules as a degradation footer.
const EXUM_BODY =
  "# Executive Summary\n\nRingkasan kompetensi TKK.\n\n---\n\n## Detail\n\nIsi detail Exum.";

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
                choices: [{ message: { content: "# Executive Summary\n\nRingkasan kompetensi TKK.\n\n---\n\n## Detail\n\nIsi detail Exum." } }],
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

async function buildApp() {
  const { default: chatRouter } = await import("../routes/chat/index.js");
  const app = express();
  app.use(express.json());
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).log = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };
    next();
  });
  app.use("/api", chatRouter);
  return app;
}

/** Run the real generate-exum route with a failing quiz builder and return the persisted content. */
async function generateDegradedExum(app: express.Express): Promise<string> {
  vi.mocked(buildQuizContext).mockRejectedValue(new Error("db timeout"));
  // Queue: conversation, messages, evidence, outlines, quizAttempts count (3 → data lost), update, insert.
  dbState.push([FAKE_CONV], [], [], [], [{ total: 3 }], undefined, undefined);
  const res = await request(app).post("/api/chat/generate-exum").send({ conversationId: 1 });
  expect(res.status).toBe(200);
  expect(typeof res.body.content).toBe("string");
  return res.body.content as string;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Exum degradation footer — server ↔ client contract", () => {
  let app: express.Express;

  beforeAll(async () => {
    // Runtime imports keep this cross-artifact contract test exact without
    // pulling frontend source files into the API server's TypeScript rootDir.
    const webModulePath = "../../../gustafta-pkb/src/lib/exum-degradation";
    const mobileModulePath = "../../../gustafta-mobile/lib/exum-degradation";
    const [web, mobile] = await Promise.all([
      vi.importActual<{ parseExumDegradation: DegradationParser }>(webModulePath),
      vi.importActual<{ parseExumDegradation: DegradationParser }>(mobileModulePath),
    ]);
    parseWeb = web.parseExumDegradation;
    parseMobile = mobile.parseExumDegradation;
  });

  beforeEach(async () => {
    dbState.queue = [];
    vi.mocked(buildQuizContext).mockReset().mockResolvedValue("");
    app = await buildApp();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.transaction).mockResolvedValue({ allowed: true, source: "paid" } as any);
  });

  it("footer produced by the server route is detected by BOTH clients' parseExumDegradation", async () => {
    const content = await generateDegradedExum(app);

    // Sanity: the server really appended a footer to the body.
    expect(content.startsWith(EXUM_BODY)).toBe(true);
    expect(content.length).toBeGreaterThan(EXUM_BODY.length);

    for (const [name, parse] of [["web", parseWeb], ["mobile", parseMobile]] as const) {
      const parsed = parse(content);
      // Detected …
      expect(parsed.degradationNote, `${name} client failed to detect the server footer`).not.toBeNull();
      // … note extracted without the "Catatan sistem:" prefix, mentioning the lost block …
      expect(parsed.degradationNote).not.toContain("Catatan sistem");
      expect(parsed.degradationNote).toMatch(/data skor quiz/i);
      expect(parsed.degradationNote).toContain("tidak dapat dimuat");
      // … and the body split cleanly: original Exum, no footer remnants.
      expect(parsed.body).toBe(EXUM_BODY.trimEnd());
      expect(parsed.body).not.toContain("Catatan sistem");
    }
  });

  it("ordinary `---` horizontal rules in normal Exum content are NOT flagged", async () => {
    // Server path: no context failure → no footer appended.
    dbState.push([FAKE_CONV], [], [], [], undefined, undefined);
    const res = await request(app).post("/api/chat/generate-exum").send({ conversationId: 1 });
    expect(res.status).toBe(200);
    const content = res.body.content as string;
    expect(content).toBe(EXUM_BODY); // contains a mid-document `---` rule

    for (const parse of [parseWeb, parseMobile]) {
      const parsed = parse(content);
      expect(parsed.degradationNote).toBeNull();
      expect(parsed.body).toBe(content);
    }
  });

  it("content ending in a plain `---` section or italic line is NOT flagged", () => {
    const samples = [
      "# Exum\n\nIsi.\n\n---\n\n*Penutup: terima kasih.*", // italic but not "Catatan sistem"
      "# Exum\n\nIsi.\n\n---\n\nBagian akhir tanpa italic.",
      "# Exum\n\nIsi tanpa rule sama sekali.",
    ];
    for (const sample of samples) {
      for (const parse of [parseWeb, parseMobile]) {
        const parsed = parse(sample);
        expect(parsed.degradationNote).toBeNull();
        expect(parsed.body).toBe(sample);
      }
    }
  });
});
