---
name: React Native Jest mutation testing (gustafta-mobile)
description: Durable lesson — use react-test-renderer for async React Query mutation tests; two-phase act() to commit state before press; apiFetch reads body once.
---

# React Native Jest — mutation testing

## The durable lesson
Use `react-test-renderer` directly (not `@testing-library/react-native`) for component tests involving async React Query mutations.

**Why:** RNTL v14 requires `test-renderer@1.x`, which uses ConcurrentRoot. React Query's MutationCache spawns async chains after a mutation resolves that overlap with RNTL's `findByTestId`, creating act()-scope leakage between tests in React 19.

**How to apply:** Two-phase act() pattern:
1. Phase 1 (separate act): commit input state — mutation closures capture committed values, not empty strings
2. Phase 2 (same act): press the button AND wait 200ms for React Query's promise chain to settle before asserting

**apiFetch error body:** Read the response body once with `text()`, then `JSON.parse()` it — a real Response body stream can only be consumed once. Never call both `json()` and `text()` on the same error response.

**pnpm transformIgnorePatterns:** Include `\\.pnpm` in the exception list so the regex falls through to the second `/node_modules/` where the actual package name (e.g. `expo`) is checked.
