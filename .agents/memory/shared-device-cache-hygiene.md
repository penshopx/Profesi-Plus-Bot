---
name: Shared-device cache hygiene
description: Rules for user-scoped client caches (mobile) so account switches/sign-out never leak another user's data
---

Rule: any client-side cache of per-user data (AsyncStorage + React Query) must be defended on FOUR fronts, not just key scoping:

1. **Scope every cache key by userId** — disk keys AND React Query query keys; gate queries with `enabled: !!userId`.
2. **Owner-tag in-memory state** (`{ owner, ids }`) and derive at render time only when `owner === currentUserId` — effects run after commit, so a reset-in-effect alone still flashes the prior user's data for one render.
3. **Guard async completions** — disk-read effects need a `cancelled` cleanup flag; mutation callbacks must capture the initiating `ownerId` in mutation variables and write only to that owner's key/state.
4. **Fence sign-out with an epoch** — a monotonic counter bumped by the sign-out cleanup; in-flight mutations capture it at start and skip persistence if it advanced, otherwise a settling request recreates the cache sign-out just wiped.

Also validate parsed cache JSON with `Array.isArray` / element type checks — valid-but-wrong-shaped values must degrade to `[]`, not crash at `.map`.

**Why:** completion code review rejected key-scoping-only fixes three times for exactly these races (stale-window query cache, pre-effect render flash, in-flight mutation, post-sign-out persist).

**How to apply:** whenever caching user data client-side (see `lib/marketplaceCache.ts` in gustafta-mobile for the reference implementation and its sign-out epoch).
