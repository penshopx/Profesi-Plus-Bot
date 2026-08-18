/**
 * POST /helpbot — Asisten Gustafta (anonymous floating helpbot)
 *
 * Covers:
 * - Happy path: valid user message → { reply } from LLM
 * - 400 when messages has no user turn / is malformed
 * - Oversized history is truncated to MAX_MESSAGES and content clipped
 * - 503 when no model is configured
 * - 502 when the LLM returns an empty reply
 * - 500 (friendly message) when the LLM call throws
 */

import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();
let availableModels: { id: string; available: boolean }[] = [
  { id: "gpt-4o-mini", available: true },
];

vi.mock("../../lib/llm", () => ({
  getClientForModel: vi.fn(() => ({
    client: { chat: { completions: { create: createMock } } },
    model: "gpt-4o-mini",
  })),
  isKnownModel: vi.fn(() => true),
  listModels: vi.fn(() => availableModels),
}));

vi.mock("../../lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// Rate limiter is PG-backed in production; bypass it here (its own behavior is
// covered by the middleware factory's skip guard under NODE_ENV=test anyway).
vi.mock("../../middlewares/rateLimiter", () => ({
  helpbotRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import helpbotRouter from "../helpbot";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(helpbotRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  availableModels = [{ id: "gpt-4o-mini", available: true }];
  createMock.mockResolvedValue({
    choices: [{ message: { content: "Jawaban asisten." } }],
  });
});

describe("POST /helpbot", () => {
  it("returns the LLM reply for a valid conversation", async () => {
    const res = await request(makeApp())
      .post("/helpbot")
      .send({ messages: [{ role: "user", content: "Apa itu PKB?" }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: "Jawaban asisten." });
    const args = createMock.mock.calls[0][0];
    expect(args.messages[0].role).toBe("system");
    expect(args.messages[0].content).toContain("Permen PUPR No. 12 Tahun 2021");
    expect(args.messages.at(-1)).toEqual({ role: "user", content: "Apa itu PKB?" });
  });

  it("rejects a request without any user turn", async () => {
    const res = await request(makeApp())
      .post("/helpbot")
      .send({ messages: [{ role: "assistant", content: "Halo" }] });
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects malformed bodies", async () => {
    const res = await request(makeApp()).post("/helpbot").send({ messages: "nope" });
    expect(res.status).toBe(400);
  });

  it("truncates oversized history and clips long content", async () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `pesan ${i} ` + "x".repeat(2000),
    }));
    const res = await request(makeApp()).post("/helpbot").send({ messages });

    expect(res.status).toBe(200);
    const sent = createMock.mock.calls[0][0].messages;
    // 1 system + max 12 history turns
    expect(sent.length).toBe(13);
    for (const m of sent.slice(1)) {
      expect(m.content.length).toBeLessThanOrEqual(1000);
    }
  });

  it("returns 503 when no model is configured", async () => {
    availableModels = [];
    const res = await request(makeApp())
      .post("/helpbot")
      .send({ messages: [{ role: "user", content: "halo" }] });
    expect(res.status).toBe(503);
  });

  it("returns 502 when the LLM reply is empty", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "   " } }] });
    const res = await request(makeApp())
      .post("/helpbot")
      .send({ messages: [{ role: "user", content: "halo" }] });
    expect(res.status).toBe(502);
  });

  it("returns a friendly 500 when the LLM call throws", async () => {
    createMock.mockRejectedValue(new Error("boom"));
    const res = await request(makeApp())
      .post("/helpbot")
      .send({ messages: [{ role: "user", content: "halo" }] });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Asisten Gustafta");
  });
});
