---
name: SKK competency mapping — authoritative reference
description: Design rule for AI features that map TKK experience onto SKK units (Studio Kompetensi and similar)
---

# SKK competency mapping must be grounded in static reference data, not LLM output

When an AI feature maps a user's experience onto SKK competency units (e.g. Studio
Kompetensi), the **authoritative unit list must come from the static SKK
definition**, not from whatever the LLM returns. After parsing the LLM JSON, rebuild
the unit array from the Jabker's own `units` (in canonical order) and merge the LLM's
per-unit verdicts in by code; any unit the model omits defaults to a `gap`.

**Why:** the LLM frequently drops or reorders units. If you trust its `units[]`
directly, the coverage map is silently incomplete — which undermines the whole point
of the feature (showing the user every unit and where the gaps are). It also lets the
model hallucinate unit codes that don't exist.

**How to apply:** in any prompt→JSON mapping over SKK units, treat the LLM output as
advisory verdicts keyed by unit code, and the static data as the source of truth for
which units exist and their names. Also clamp any derived SKPK score to 0–25 (one
high-quality Exum = max 25 SKPK) and normalize unknown enum values to safe defaults.

SKK reference data is static TypeScript, not in the DB (large hand-authored dataset
of jabkers→units); LLM calls go through a provider-agnostic OpenAI-compatible client
factory. Persisted AI analyses are owner-scoped per user.
