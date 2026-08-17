---
name: Optimistic concurrency needs a revision precondition
description: Why status-based conditional updates miss same-outcome races; use updatedAt/version instead.
---

Rule: for "second writer must see a 409" semantics, condition the UPDATE on a revision value (`updatedAt` or a version column), not on the status/state field.

**Why:** A `WHERE status = <what the officer saw>` guard passes when two concurrent decisions produce the *same* status (e.g. two re-verifications of an already-verified record) — the first write leaves status unchanged, so the second silently overwrites, duplicates history/journey rows, and re-sends notifications. Code review rejected a status-only guard for exactly this.

**How to apply:** client echoes the `updatedAt` it displayed (`expectedUpdatedAt`); server fast-fails 409 if it differs from the freshly read row, then runs the transactional UPDATE with `WHERE id = ? AND updatedAt = <the Date just read from DB>` + `.returning()`, throwing a conflict error on 0 rows to roll everything back. Compare timestamps via `getTime()` (ms precision) for the fast path; use the exact DB-read Date object in the SQL condition to avoid precision mismatches.
