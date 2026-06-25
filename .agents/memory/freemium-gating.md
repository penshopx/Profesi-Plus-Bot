---
name: Freemium gating must be server-side
description: For gated/paid content behind a teaser, redact on the server; never rely on a visual blur of full data.
---

When gating premium content behind registration/payment (e.g. "Dialog Gustafta" Blueprint behind sign-up), the gated payload must be redacted server-side into a teaser (summary + counts + a tiny preview). Do NOT send the full content and merely blur it in the UI.

**Why:** A blurred-but-full JSON response is trivially bypassed by inspecting the network tab or calling the anonymous endpoint directly — the gate becomes cosmetic.

**How to apply:** Anonymous/unentitled requests get a teaser shape only; the full asset is unlocked after an authenticated entitlement check. Also protect anonymous LLM endpoints with a per-IP rate limit — they spend the user's own API keys (denial-of-wallet).
