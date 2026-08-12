/**
 * Shared context budget enforcement.
 *
 * Each context builder returns a string that is concatenated into the system
 * prompt.  When a user has data in every block the combined context can exceed
 * 10 000 characters, inflating latency and cost.
 *
 * This module provides a single function that accepts the blocks together with
 * a priority score for each, then trims lower-priority blocks first until the
 * total fits within the budget.
 */

/** Total character ceiling for all context blocks combined. */
export const SHARED_CONTEXT_BUDGET_CHARS = 10_000;

/** Appended to a block that was cut short. */
const TRUNCATION_MARKER = "\n…[konteks dipotong]";
const TRUNCATION_MARKER_LEN = TRUNCATION_MARKER.length;

export interface ContextBlock {
  content: string;
  /**
   * Relative importance.  Higher = preserved longer when budget runs low.
   */
  priority: number;
}

/**
 * Enforces a shared character budget across context blocks.
 *
 * Blocks are processed from highest priority to lowest.  Each block is
 * granted its full length while budget remains; once the budget is exhausted,
 * remaining (lower-priority) blocks are either trimmed to whatever space is
 * left or dropped entirely.
 *
 * The total length of the returned string is guaranteed to be ≤ `budget`.
 *
 * The blocks are **returned concatenated in the same order they were
 * supplied**, so callers don't need to worry about reordering.
 */
export function applySharedContextBudget(
  blocks: ContextBlock[],
  budget = SHARED_CONTEXT_BUDGET_CHARS,
): string {
  if (!blocks.length) return "";

  // Pair each block with its original position so we can restore order later.
  const indexed = blocks.map((b, idx) => ({ ...b, idx }));

  // Sort by descending priority — highest priority is served first.
  indexed.sort((a, b) => b.priority - a.priority);

  let remaining = budget;
  const trimmed = new Array<string>(blocks.length).fill("");

  for (const block of indexed) {
    if (!block.content || remaining <= 0) {
      trimmed[block.idx] = "";
      continue;
    }

    if (block.content.length <= remaining) {
      trimmed[block.idx] = block.content;
      remaining -= block.content.length;
    } else {
      // Reserve space for the truncation marker so the output never exceeds
      // `remaining`. If `remaining` is too small to even hold the marker,
      // drop the block entirely rather than emitting a dangling marker.
      const sliceLen = remaining - TRUNCATION_MARKER_LEN;
      if (sliceLen <= 0) {
        trimmed[block.idx] = "";
      } else {
        trimmed[block.idx] = block.content.slice(0, sliceLen) + TRUNCATION_MARKER;
        remaining = 0;
      }
    }
  }

  return trimmed.join("");
}
