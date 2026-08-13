---
name: Context usage bookkeeping
description: How to correctly record "the AI read this entry" for prompt-context blocks under a shared budget.
---

Rule: never mark an entry as "used by the AI" inside its context builder — the shared context budget (`applySharedContextBudget`, priority-based, trims/drops low-priority blocks) runs later and may cut it.

**Why:** builders run before budget enforcement; marking there produces false "read by AI" indicators (architect flagged this twice on the Project Brain lastUsedAt feature).

**How to apply:** builder returns `{ text, blocks: [{id, block}] }`; after the budget produces the final combined context, do an ordered cursor scan (`indexOf(block, cursor)`, advance past each match, stop at first miss since trimming is tail-first) so duplicate-rendered entries aren't over-marked. Persist via fire-and-forget async IIFE with `.catch` (drizzle builders are PromiseLike without `.catch`).
