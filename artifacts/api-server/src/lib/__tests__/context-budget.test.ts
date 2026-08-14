/**
 * Tests for applySharedContextBudget — verifies that higher-priority blocks
 * are preserved in full and lower-priority blocks are trimmed or dropped first
 * when the combined context exceeds the character budget.
 */

import { describe, it, expect } from "vitest";
import { applySharedContextBudget, SHARED_CONTEXT_BUDGET_CHARS, type ContextBlock } from "../context-budget";
import { buildChatContextBlocks } from "../chat-context-blocks";

// Helper: repeat a character to produce a string of exactly `n` chars.
const fill = (char: string, n: number) => char.repeat(n);

const MARKER = "\n…[konteks dipotong]";
const MARKER_LEN = MARKER.length; // 20

describe("applySharedContextBudget", () => {
  // ── Happy-path: all blocks fit ──────────────────────────────────────────────

  it("returns empty string for an empty block list", () => {
    expect(applySharedContextBudget([])).toBe("");
  });

  it("returns all content unchanged when total length is within budget", () => {
    const blocks: ContextBlock[] = [
      { content: "AAA", priority: 7 },
      { content: "BBB", priority: 1 },
    ];
    const result = applySharedContextBudget(blocks, 100);
    expect(result).toBe("AAABBB");
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it("returns all content unchanged when total length equals the budget exactly", () => {
    const blocks: ContextBlock[] = [
      { content: fill("A", 50), priority: 5 },
      { content: fill("B", 50), priority: 3 },
    ];
    const result = applySharedContextBudget(blocks, 100);
    expect(result.length).toBe(100);
    // No truncation marker should appear
    expect(result).not.toContain("dipotong");
  });

  // ── Single block over budget ────────────────────────────────────────────────

  it("truncates a single oversized block to exactly the budget", () => {
    const content = fill("X", 200);
    const result = applySharedContextBudget([{ content, priority: 5 }], 100);
    expect(result.length).toBe(100);
    expect(result.endsWith(MARKER)).toBe(true);
    // The slice should be the first (100 - MARKER_LEN) chars
    expect(result.startsWith(fill("X", 100 - MARKER_LEN))).toBe(true);
  });

  it("drops a single block entirely when budget is too small even for the marker", () => {
    const result = applySharedContextBudget(
      [{ content: fill("X", 50), priority: 5 }],
      MARKER_LEN - 1, // not enough room for content + marker
    );
    expect(result).toBe("");
  });

  // ── Priority ordering ───────────────────────────────────────────────────────

  it("preserves high-priority block in full and trims low-priority block", () => {
    // Budget: 110. High-priority block takes 80 → leaves 30 for low-priority.
    // sliceLen = 30 - MARKER_LEN(20) = 10 > 0, so low is trimmed (not dropped).
    const highContent = fill("H", 80);
    const lowContent  = fill("L", 80);
    const blocks: ContextBlock[] = [
      { content: highContent, priority: 7 },
      { content: lowContent,  priority: 1 },
    ];
    const result = applySharedContextBudget(blocks, 110);

    expect(result.length).toBe(110);
    // High-priority content should be intact at its original position (first)
    expect(result.startsWith(highContent)).toBe(true);
    // Low-priority tail should contain the truncation marker
    expect(result).toContain(MARKER);
    // The low-priority portion is result.slice(80), which is 30 chars
    const lowPortion = result.slice(80);
    expect(lowPortion.length).toBe(30);
    expect(lowPortion.endsWith(MARKER)).toBe(true);
  });

  it("drops low-priority block entirely when high-priority block fills the budget", () => {
    const highContent = fill("H", 100);
    const lowContent  = fill("L", 50);
    const blocks: ContextBlock[] = [
      { content: highContent, priority: 7 },
      { content: lowContent,  priority: 1 },
    ];
    const result = applySharedContextBudget(blocks, 100);

    expect(result.length).toBe(100);
    expect(result).toBe(highContent);
    expect(result).not.toContain("dipotong");
  });

  it("cuts blocks in priority order, not input order", () => {
    // Blocks supplied in low→high input order; budget forces a cut.
    // The lowest-priority block should be cut regardless of its position.
    const blocks: ContextBlock[] = [
      { content: fill("L", 60), priority: 1 }, // input index 0 — lowest priority
      { content: fill("M", 60), priority: 5 }, // input index 1
      { content: fill("H", 60), priority: 9 }, // input index 2 — highest priority
    ];
    // Budget = 150; total = 180; 30 must be cut.
    const result = applySharedContextBudget(blocks, 150);

    expect(result.length).toBe(150);
    // H block (priority 9) should be fully intact somewhere in the output
    expect(result).toContain(fill("H", 60));
    // M block (priority 5) should be fully intact
    expect(result).toContain(fill("M", 60));
    // L block (priority 1) should be trimmed — its 60-char run should NOT appear
    expect(result).not.toContain(fill("L", 60));
    expect(result).toContain(MARKER);
  });

  it("output preserves the original input order of blocks", () => {
    // Even though we cut the low-priority block, the remaining content
    // should appear in the same order they were supplied.
    const blocks: ContextBlock[] = [
      { content: "FIRST",  priority: 3 },
      { content: "SECOND", priority: 7 }, // highest — will be served first internally
      { content: "THIRD",  priority: 1 },
    ];
    const result = applySharedContextBudget(blocks, 1000);
    // All fit; order must be preserved
    const firstIdx  = result.indexOf("FIRST");
    const secondIdx = result.indexOf("SECOND");
    const thirdIdx  = result.indexOf("THIRD");
    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });

  // ── Multiple blocks, tight budget ──────────────────────────────────────────

  it("preserves the two highest-priority blocks and drops the rest when budget is very tight", () => {
    const budget = 100;
    const blocks: ContextBlock[] = [
      { content: fill("A", 60), priority: 7 }, // highest — keep in full
      { content: fill("B", 60), priority: 6 }, // second  — keep in full (40 left)
      { content: fill("C", 60), priority: 3 }, // no room — dropped
      { content: fill("D", 60), priority: 1 }, // no room — dropped
    ];
    const result = applySharedContextBudget(blocks, budget);

    expect(result.length).toBeLessThanOrEqual(budget);
    expect(result).toContain(fill("A", 60));
    // B gets whatever remains after A (40 chars). 40 < MARKER_LEN (20) + 1, so
    // check that the result doesn't contain B in full (60 chars).
    expect(result).not.toContain(fill("B", 60));
    expect(result).not.toContain(fill("C", 60));
    expect(result).not.toContain(fill("D", 60));
  });

  // ── Real priority table from chat-context-blocks ───────────────────────────

  it("mirrors the chat-route priority ordering: profile > competency > ... > historical", () => {
    const budget = 100;
    const blockSize = 60; // each block exceeds budget/8 so cuts will happen

    const inputs = {
      profileContext:        fill("P", blockSize),
      competencyContext:     fill("C", blockSize),
      quizContext:           fill("Q", blockSize),
      watchedModulesContext: fill("W", blockSize),
      kegiatanContext:       fill("K", blockSize),
      knowledgeContext:      fill("N", blockSize),
      projectBrainContext:   fill("B", blockSize),
      historicalPKBContext:  fill("H", blockSize),
    };

    const blocks: ContextBlock[] = buildChatContextBlocks(inputs);
    const result = applySharedContextBudget(blocks, budget);

    expect(result.length).toBeLessThanOrEqual(budget);
    // Profile (priority 7) should be present in full
    expect(result).toContain(fill("P", blockSize));
    // Historical (priority 1) should be entirely absent or heavily cut
    expect(result).not.toContain(fill("H", blockSize));
  });

  // ── Priority tie ──────────────────────────────────────────────────────────

  it("handles blocks with identical priorities without throwing", () => {
    const blocks: ContextBlock[] = [
      { content: fill("A", 60), priority: 5 },
      { content: fill("B", 60), priority: 5 },
      { content: fill("C", 60), priority: 5 },
    ];
    expect(() => applySharedContextBudget(blocks, 100)).not.toThrow();
    const result = applySharedContextBudget(blocks, 100);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  // ── Output length guarantee ────────────────────────────────────────────────

  it("never exceeds the supplied budget regardless of input", () => {
    const blocks: ContextBlock[] = [
      { content: fill("X", 9999), priority: 10 },
      { content: fill("Y", 9999), priority:  5 },
      { content: fill("Z", 9999), priority:  1 },
    ];
    const budget = SHARED_CONTEXT_BUDGET_CHARS;
    const result = applySharedContextBudget(blocks, budget);
    expect(result.length).toBeLessThanOrEqual(budget);
  });

  it("never exceeds the default budget when no budget argument is given", () => {
    const blocks: ContextBlock[] = [
      { content: fill("X", 6000), priority: 7 },
      { content: fill("Y", 6000), priority: 1 },
    ];
    const result = applySharedContextBudget(blocks);
    expect(result.length).toBeLessThanOrEqual(SHARED_CONTEXT_BUDGET_CHARS);
  });

  // ── Empty / whitespace content ─────────────────────────────────────────────

  it("skips empty-string blocks without consuming budget", () => {
    const blocks: ContextBlock[] = [
      { content: "",             priority: 9 },
      { content: fill("A", 50), priority: 5 },
      { content: "",             priority: 1 },
    ];
    const result = applySharedContextBudget(blocks, 100);
    expect(result).toBe(fill("A", 50));
  });
});
