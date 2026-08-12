---
name: Context failure detection (PKB chat)
description: safeCtx tracks errors vs legitimately-empty blocks; emits SSE contextWarning when personalisation blocks throw.
---

## Rule
`safeCtx` in `chat/index.ts` catches errors and returns `""` so a single DB/network failure doesn't kill the chat request. But silent fallback means the user gets generic AI advice without knowing why.

**Why:** Distinguishing "user has no data" (empty) from "context builder threw" (failure) lets us warn the user only when something actually went wrong.

**How to apply:**
- `const contextErrors: string[] = []` declared before `safeCtx`.
- `safeCtx` pushes the block name to `contextErrors` on catch.
- After LLM stream obtained and SSE headers set, check `contextErrors.filter(b => PERSONALISATION_BLOCKS.includes(b))`.
- If any personalisation blocks failed, emit `data: { contextWarning: true, failedBlocks: [...] }` before the first content chunk.
- `streamMessage` in web `lib/api.ts` and mobile `lib/api.ts` both accept optional `onContextWarning?: () => void`.
- Web `chat.tsx` shows a dismissible amber banner (`contextFailureBanner` state); cleared when user sends a new message.
- The Exum flow uses `safeExumCtx` — same error catching but no contextWarning SSE (Exum is one-shot, not streaming conversation).
