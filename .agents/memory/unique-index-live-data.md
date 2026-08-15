---
name: Unique index on live data
description: How to safely add a unique constraint when the running DB may already hold duplicates.
---

Rule: never add a unique index to a table that a deployed app may have populated with duplicates without a reconciliation step that runs BEFORE `db push`.

**Why:** `drizzle-kit push` creates the index directly and fails on existing duplicates, aborting the whole post-merge script (which runs push before seeds). A completion review rejected exactly this.

**How to apply:**
- Add an idempotent dedupe script (keep the oldest row, `DELETE ... USING ... WHERE a.id > b.id`), guard with `to_regclass` so it no-ops on fresh DBs, and call it in `scripts/post-merge.sh` before `pnpm --filter db push`.
- In the route, insert atomically with `.onConflictDoNothing({ target }).returning()` and map an empty result to 409 — read-then-insert checks are not concurrency-safe.
- Related: `CREATE TABLE IF NOT EXISTS` is not atomic across sessions (parallel vitest workers) — catch pg error code 23505 in DDL bootstrap helpers and treat as success.
