/**
 * Unit tests for applySharedContextBudget.
 *
 * Core invariant: the returned string length is ALWAYS ≤ the requested budget,
 * including when truncation occurs and a marker is appended.
 */

import { describe, it, expect } from "vitest";
import { applySharedContextBudget, SHARED_CONTEXT_BUDGET_CHARS } from "../lib/context-budget";

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
