/**
 * Unit tests for applySharedContextBudget.
 *
 * Core invariant: the returned string length is ALWAYS ≤ the requested budget,
 * including when truncation occurs and a marker is appended.
 */

import { describe, it, expect } from "vitest";
import { applySharedContextBudget, SHARED_CONTEXT_BUDGET_CHARS } from "../lib/context-budget";
import { buildChatContextBlocks } from "../lib/chat-context-blocks";
import { buildSystemPrompt } from "../lib/pkb-system-prompt";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Make a block whose content is exactly `len` characters of `char`. */
const block = (len: number, priority: number, char = "a") => ({
  content: char.repeat(len),
  priority,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("applySharedContextBudget", () => {
  // Fundamental invariant ────────────────────────────────────────────────────

  it("never exceeds the budget when all blocks fit", () => {
    const result = applySharedContextBudget(
      [block(100, 3), block(200, 2), block(300, 1)],
      1000,
    );
    expect(result.length).toBeLessThanOrEqual(1000);
    expect(result.length).toBe(600); // all fit
  });

  it("never exceeds the budget when truncation occurs", () => {
    const result = applySharedContextBudget(
      [block(5000, 3), block(5000, 2), block(5000, 1)],
      10_000,
    );
    expect(result.length).toBeLessThanOrEqual(10_000);
  });

  it("never exceeds the budget with a tiny budget", () => {
    const result = applySharedContextBudget([block(1000, 1)], 50);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("never exceeds the budget when budget equals default", () => {
    // Six blocks of 2 000 chars each (total 12 000 > budget 10 000)
    const blocks = [1, 2, 3, 4, 5, 6].map((p) => block(2000, p));
    const result = applySharedContextBudget(blocks);
    expect(result.length).toBeLessThanOrEqual(SHARED_CONTEXT_BUDGET_CHARS);
  });

  // Priority ordering ────────────────────────────────────────────────────────

  it("trims lowest-priority block first", () => {
    // budget = 150, two blocks of 100 chars: high-priority 'a', low-priority 'b'
    const result = applySharedContextBudget(
      [
        { content: "a".repeat(100), priority: 1 }, // low — trimmed first
        { content: "b".repeat(100), priority: 2 }, // high — preserved
      ],
      150,
    );
    // The high-priority block ('b') should appear in full
    expect(result).toContain("b".repeat(100));
    // The low-priority block ('a') must be trimmed or absent
    expect(result).not.toContain("a".repeat(100));
  });

  it("preserves the highest-priority block in full before trimming lower ones", () => {
    const result = applySharedContextBudget(
      [
        { content: "X".repeat(400), priority: 10 },
        { content: "Y".repeat(400), priority: 5 },
        { content: "Z".repeat(400), priority: 1 },
      ],
      500,
    );
    // Highest-priority block must be untouched
    expect(result).toContain("X".repeat(400));
    expect(result.length).toBeLessThanOrEqual(500);
  });

  // Concatenation order ──────────────────────────────────────────────────────

  it("returns blocks concatenated in the original input order, not priority order", () => {
    // Block A has lower priority but comes first in the input array.
    // Even though B has higher priority it should appear second in output.
    const result = applySharedContextBudget(
      [
        { content: "AAAA", priority: 1 },
        { content: "BBBB", priority: 2 },
      ],
      1000,
    );
    const posA = result.indexOf("AAAA");
    const posB = result.indexOf("BBBB");
    expect(posA).toBeGreaterThanOrEqual(0);
    expect(posB).toBeGreaterThanOrEqual(0);
    expect(posA).toBeLessThan(posB); // A before B — original order preserved
  });

  // Edge cases ──────────────────────────────────────────────────────────────

  it("returns empty string for empty input", () => {
    expect(applySharedContextBudget([])).toBe("");
  });

  it("returns empty string for budget of zero", () => {
    const result = applySharedContextBudget([block(100, 1)], 0);
    expect(result.length).toBe(0);
  });

  it("drops a block whose content is empty string", () => {
    const result = applySharedContextBudget(
      [
        { content: "", priority: 5 },
        { content: "hello", priority: 1 },
      ],
      1000,
    );
    expect(result).toBe("hello");
  });

  it("drops lower-priority block entirely when remaining budget is too small for marker", () => {
    // budget = 102 chars; first block takes 100, leaving only 2 chars — not
    // enough to fit the truncation marker, so second block should be dropped.
    const result = applySharedContextBudget(
      [
        { content: "A".repeat(100), priority: 2 },
        { content: "B".repeat(50), priority: 1 },
      ],
      102,
    );
    expect(result.length).toBeLessThanOrEqual(102);
    // Second block should not appear at all
    expect(result).not.toContain("B");
  });

  it("single block exactly equal to budget is returned unchanged", () => {
    const content = "x".repeat(SHARED_CONTEXT_BUDGET_CHARS);
    const result = applySharedContextBudget([{ content, priority: 1 }]);
    expect(result).toBe(content);
    expect(result.length).toBe(SHARED_CONTEXT_BUDGET_CHARS);
  });

  it("single block one char over budget is trimmed and fits within budget", () => {
    const result = applySharedContextBudget(
      [{ content: "x".repeat(SHARED_CONTEXT_BUDGET_CHARS + 1), priority: 1 }],
    );
    expect(result.length).toBeLessThanOrEqual(SHARED_CONTEXT_BUDGET_CHARS);
    expect(result).toMatch(/\[konteks dipotong\]$/);
  });
});

// ─── Integration: all 8 blocks wired as in chat/index.ts ─────────────────────
//
// These tests use `buildChatContextBlocks` — the same function the production
// chat handler calls — so any priority or slot change in the handler is
// automatically reflected here.  A hand-maintained duplicate array would let
// wiring bugs through; this approach does not.
//
// Priority map (canonical, lives in lib/chat-context-blocks.ts):
//   7 profile | 6 competency | 5 quiz | 4.5 watchedModules
//   4 kegiatan | 3 knowledge | 2 projectBrain | 1 historical

describe("applySharedContextBudget — 8-block integration (mirrors chat/index.ts wiring)", () => {
  // Unique sentinel prefixes so we can identify which block survived.
  const SENTINEL = {
    profile:        "PROFILE::",
    competency:     "COMPETENCY::",
    quiz:           "QUIZ::",
    watchedModules: "WATCHED::",
    kegiatan:       "KEGIATAN::",
    knowledge:      "KNOWLEDGE::",
    projectBrain:   "PROJECTBRAIN::",
    historical:     "HISTORICAL::",
  } as const;

  const BLOCK_SIZE = 1_500; // chars per block; 8 × 1500 = 12 000 > 10 000 budget

  /** Pad a sentinel to exactly `size` chars so budget arithmetic is predictable. */
  const pad = (sentinel: string, size = BLOCK_SIZE) =>
    (sentinel + "x".repeat(Math.max(0, size - sentinel.length))).slice(0, size);

  /** Helper: produce production blocks via the exported factory. */
  function makeProductionBlocks(overrides: Partial<Record<keyof typeof SENTINEL, string>> = {}) {
    return buildChatContextBlocks({
      profileContext:        overrides.profile        ?? pad(SENTINEL.profile),
      competencyContext:     overrides.competency     ?? pad(SENTINEL.competency),
      quizContext:           overrides.quiz           ?? pad(SENTINEL.quiz),
      watchedModulesContext: overrides.watchedModules ?? pad(SENTINEL.watchedModules),
      kegiatanContext:       overrides.kegiatan       ?? pad(SENTINEL.kegiatan),
      knowledgeContext:      overrides.knowledge      ?? pad(SENTINEL.knowledge),
      projectBrainContext:   overrides.projectBrain   ?? pad(SENTINEL.projectBrain),
      historicalPKBContext:  overrides.historical     ?? pad(SENTINEL.historical),
    });
  }

  // ── Budget invariant ──────────────────────────────────────────────────────

  it("combined context never exceeds SHARED_CONTEXT_BUDGET_CHARS when all 8 blocks are large", () => {
    // 8 × 1 500 = 12 000 chars, well over the 10 000 budget.
    const result = applySharedContextBudget(makeProductionBlocks());
    expect(result.length).toBeLessThanOrEqual(SHARED_CONTEXT_BUDGET_CHARS);
  });

  // ── Priority preservation ─────────────────────────────────────────────────

  it("highest-priority block (profile, p=7) is preserved in full when budget is tight", () => {
    const result = applySharedContextBudget(makeProductionBlocks());

    // Must be present and untrimmed — no truncation marker inside it.
    const start = result.indexOf(SENTINEL.profile);
    expect(start).toBeGreaterThanOrEqual(0);
    const slice = result.slice(start, start + BLOCK_SIZE);
    expect(slice).not.toContain("[konteks dipotong]");
  });

  it("competency (p=6) is preserved in full while quiz (p=5) is absent when budget allows only two blocks", () => {
    // Budget = exactly profile + competency (2 × BLOCK_SIZE).
    // quiz and every lower-priority block must be absent entirely.
    const tightBudget = BLOCK_SIZE * 2;
    const result = applySharedContextBudget(makeProductionBlocks(), tightBudget);

    // profile and competency must be fully present.
    expect(result).toContain(SENTINEL.profile);
    expect(result).toContain(SENTINEL.competency);
    // quiz (next lower priority, p=5) must be completely absent — budget is gone.
    expect(result).not.toContain(SENTINEL.quiz);
    // Result must not exceed the tight budget.
    expect(result.length).toBeLessThanOrEqual(tightBudget);
  });

  it("lowest-priority block (historical, p=1) is dropped before higher-priority blocks", () => {
    // All 8 at BLOCK_SIZE = 12 000 > 10 000; historical must be cut first.
    const result = applySharedContextBudget(makeProductionBlocks());

    // historical must NOT appear in full (sentinel + all its padding).
    expect(result).not.toContain(pad(SENTINEL.historical));
    // But the highest-priority block must still be present in full.
    expect(result).toContain(pad(SENTINEL.profile));
  });

  // ── Output ordering ───────────────────────────────────────────────────────

  it("output preserves original input order even when input order differs from priority order", () => {
    // Deliberately place historical (p=1, lowest priority) FIRST in input and
    // profile (p=7, highest priority) LAST.  The budget is large enough for
    // both.  Output must still reflect the input order (historical before profile),
    // not priority order (profile before historical).
    const HIST = "HIST_FIRST::";
    const PROF = "PROF_LAST::";
    const blocks = applySharedContextBudget(
      [
        { content: HIST, priority: 1 }, // input position 0, lowest priority
        { content: PROF, priority: 7 }, // input position 1, highest priority
      ],
      10_000,
    );

    const posHist = blocks.indexOf(HIST);
    const posProf = blocks.indexOf(PROF);
    expect(posHist).toBeGreaterThanOrEqual(0);
    expect(posProf).toBeGreaterThanOrEqual(0);
    // historical must appear before profile — original input order, not priority order.
    expect(posHist).toBeLessThan(posProf);
  });

  it("all 8 production blocks appear in original input order when budget is generous", () => {
    // Tiny blocks — well within budget — so every block survives.
    const smallBlocks = buildChatContextBlocks({
      profileContext:        SENTINEL.profile,
      competencyContext:     SENTINEL.competency,
      quizContext:           SENTINEL.quiz,
      watchedModulesContext: SENTINEL.watchedModules,
      kegiatanContext:       SENTINEL.kegiatan,
      knowledgeContext:      SENTINEL.knowledge,
      projectBrainContext:   SENTINEL.projectBrain,
      historicalPKBContext:  SENTINEL.historical,
    });
    const result = applySharedContextBudget(smallBlocks, 10_000);

    const inputOrder = [
      SENTINEL.profile,
      SENTINEL.competency,
      SENTINEL.quiz,
      SENTINEL.watchedModules,
      SENTINEL.kegiatan,
      SENTINEL.knowledge,
      SENTINEL.projectBrain,
      SENTINEL.historical,
    ];
    const positions = inputOrder.map((s) => result.indexOf(s));

    positions.forEach((pos, i) => {
      expect(pos).toBeGreaterThanOrEqual(0); // every block must be present
      if (i > 0) expect(pos).toBeGreaterThan(positions[i - 1]); // in input order
    });
  });

  // ── Empty-builder resilience ──────────────────────────────────────────────

  it("a single builder returning '' does not drop adjacent blocks", () => {
    // quiz returns "" — the 7 remaining blocks must all still appear.
    const result = applySharedContextBudget(
      makeProductionBlocks({ quiz: "" }),
      10_000,
    );

    expect(result).toContain(SENTINEL.profile);
    expect(result).toContain(SENTINEL.competency);
    expect(result).toContain(SENTINEL.watchedModules);
    expect(result).toContain(SENTINEL.kegiatan);
    expect(result).toContain(SENTINEL.knowledge);
    expect(result).toContain(SENTINEL.projectBrain);
    expect(result).toContain(SENTINEL.historical);
    expect(result.length).toBeLessThanOrEqual(10_000);
  });

  it("all 8 builders returning '' produces an empty combined context without error", () => {
    const result = applySharedContextBudget(
      buildChatContextBlocks({
        profileContext: "", competencyContext: "", quizContext: "",
        watchedModulesContext: "", kegiatanContext: "", knowledgeContext: "",
        projectBrainContext: "", historicalPKBContext: "",
      }),
    );
    expect(result).toBe("");
  });

  // ── System prompt size bound ──────────────────────────────────────────────

  it("system prompt assembled from combined context stays within budget + boilerplate overhead", () => {
    // Measure the boilerplate added by buildSystemPrompt when the context slot is empty.
    const boilerplateOnly = buildSystemPrompt("A", "Ahli Muda Teknik Jalan", "Jenjang 7", "profiling", []);
    const boilerplateLen = boilerplateOnly.length;

    // Build a combined context from all 8 large blocks — result ≤ budget.
    const combinedContext = applySharedContextBudget(makeProductionBlocks());
    expect(combinedContext.length).toBeLessThanOrEqual(SHARED_CONTEXT_BUDGET_CHARS);

    const fullSystemPrompt = buildSystemPrompt(
      "A", "Ahli Muda Teknik Jalan", "Jenjang 7", "profiling", [],
      combinedContext,
    );

    // Full prompt must be ≤ boilerplate + budget — no context leaked outside the slot.
    expect(fullSystemPrompt.length).toBeLessThanOrEqual(boilerplateLen + SHARED_CONTEXT_BUDGET_CHARS);
  });
});
