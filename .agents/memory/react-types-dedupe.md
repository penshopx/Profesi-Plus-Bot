---
name: React types dedupe
description: How @types/react is kept to a single version across web + Expo in this monorepo
---

The monorepo must resolve exactly ONE @types/react version or ref-typing across dependency boundaries (e.g. react-day-picker rootRef, lucide-react props) produces cryptic errors.

**Rule:** the catalog pins `@types/react`/`@types/react-dom` to the Expo-compatible `~19.1.x` line, AND a pnpm `overrides` entry forces the same range onto transitive deps (Radix etc. would otherwise pull newer 19.2.x types).

**Why:** Expo SDK 54 requires `@types/react@~19.1.10`; react itself is 19.1.0. Aligning down to 19.1.x is safe; forcing Expo up is not. Two versions coexisted before and casts had to be sprinkled into ui components.

**How to apply:** when bumping React or Expo, update catalog + `overrides` in `pnpm-workspace.yaml` together, then verify with `ls node_modules/.pnpm | grep -o '@types+react@[0-9.]*' | sort -u` (stale unreferenced dirs may remain; check pnpm-lock.yaml instead). Never re-add `as React.Ref<...>` casts to paper over a version split.
