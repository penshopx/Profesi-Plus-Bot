---
name: api-server dev has no watch
description: The api-server dev workflow builds then starts; backend edits need a workflow restart to take effect.
---

The `artifacts/api-server` dev workflow runs `build && start` (esbuild then node) — it does NOT watch or hot-reload.

**Why:** After editing any backend route/lib, the running process keeps serving the old bundle; curl tests will silently hit stale code and look like your edit "didn't work."

**How to apply:** After any backend source change, call `restart_workflow("artifacts/api-server: API Server")` before re-testing endpoints. The web (vite) artifact does hot-reload, but `tsc --noEmit` on the api-server reports pre-existing TS6305 project-reference errors (unbuilt `lib/db`, `lib/api-zod` dist) and implicit-any in `chat/index.ts` — these are not from new code and don't block the esbuild runtime.
