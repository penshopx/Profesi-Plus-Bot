---
name: Multi-provider LLM via OpenAI SDK
description: How DeepSeek/Qwen/Gemini are served alongside OpenAI, and the non-obvious key/region gotchas.
---

# Multi-provider AI models (OpenAI / DeepSeek / Qwen / Gemini)

All four providers are reachable through the **same `openai` SDK** by swapping `baseURL` + `apiKey`; no provider-specific SDKs needed. A provider registry maps model id → provider, with lazy client creation so a missing key only errors when that provider is actually selected (never at startup).

OpenAI-compatible base URLs:
- DeepSeek: `https://api.deepseek.com` (DEEPSEEK_API_KEY)
- Qwen: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (DASHSCOPE_API_KEY)
- Gemini: `https://generativelanguage.googleapis.com/v1beta/openai/` (GEMINI_API_KEY) — trailing slash matters; SDK appends `chat/completions`.

**Why / gotchas:**
- **Qwen is region-split.** The `-intl` DashScope endpoint only accepts keys created in the International (Singapore) console. A China-mainland key returns **401** against `-intl`; those keys need `https://dashscope.aliyuncs.com/compatible-mode/v1` instead. A 401 here usually means region mismatch, not a bad key.
- A 401 from any provider surfaces as an invalid-key error from the live API even though the integration code is correct — verify one known-good provider (Gemini worked) before assuming a code bug.

**How to apply:** When a provider "doesn't work," test the raw `baseURL`+key with a tiny completion from inside the api-server dir (`openai` isn't resolvable from repo root). If one provider succeeds with the identical pattern, the failing ones are key/region issues, not code.

**SSE error surfacing:** the frontend `streamMessage()` must check `response.ok` before reading the SSE body — a JSON error response (e.g. 400 missing key) has no `data:` lines, so without the check the UI hangs in streaming state forever.
