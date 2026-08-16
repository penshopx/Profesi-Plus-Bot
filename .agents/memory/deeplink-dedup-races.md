---
name: Deep-link dedup races
description: How to dedupe async deep-link handling in effects without losing or misrouting taps.
---

Rule: in a React effect that resolves a deep-link param asynchronously, never mark the id "handled" when the request *starts* — only at a terminal state (opened, alerted, or rejected as malformed). Track in-flight ids in a separate ref, and keep an "active id" ref updated on every effect run so a stale request's completion (tap A) is discarded when a newer tap (B) superseded it. Clear the in-flight ref only if it still equals the completing request's id.

**Why:** background list refreshes / Strict Mode re-run the effect mid-flight; marking handled early silently drops the tap, and unguarded completions let an old tap override a newer one.

**How to apply:** any `openXId`-style param effect that may fall back to a direct fetch (see kegiatan deep-link fallback + its `kegiatan-deeplink-fallback` test suite for the pattern and race regression tests).
