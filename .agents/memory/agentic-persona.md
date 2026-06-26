---
name: Agentic Persona design
description: How specialist AI interviewer personas are layered into Dialog Gustafta and auto-recommended
---

# Agentic Persona — specialist interviewers for Dialog Gustafta

A curated, static catalog of specialist personas (generalist + per-construction-domain
experts) replaces the single hardcoded interviewer. Each persona carries only a *voice*
and *domain-focus* prompt block; the shared Gustafta methodology (Trilogi, STAR, fase,
SKK linkage) stays common and is NOT duplicated per persona. The persona is persisted
per conversation and injected into the interview system prompt.

**Scope rule:** persona drives the *interview* only. The Exum (output document)
synthesis stays persona-neutral — do not fork the Exum prompt per persona.

**Auto-recommendation must be confidence-gated.** The persona is picked from the target
jabker's SKK *klasifikasi*. But the jabker→jabker-group lookup uses loose token scoring
that returns a best-guess for almost any free text. For recommendation, only trust an
*exact / substring / ≥2-shared-significant-token* match; otherwise fall back to the
default generalist rather than committing to a wrong specialist.

**Why:** a wrong specialist silently shapes the entire interview's tone and probing
focus, which is worse than a neutral generalist. A safe default + an explicit user
override (the UI persona picker) beats a confident-but-wrong guess.

**How to apply:** any new feature that maps free-text jabker → a behavior-changing
choice should reuse the same confidence gate, not raw best-guess matching. Public
persona catalog/recommend endpoints stay read-only with no user data or LLM cost.
