---
name: Quiz attempt snapshots for edit-safe stats
description: Aggregating JSON answer snapshots against a mutable question list needs a content snapshot at attempt time — and that snapshot must stay server-side.
---

# Quiz attempt snapshots

## The rule
When aggregating stored answers against admin-editable questions, snapshot the question content (including the correct answer) at submission time and compare snapshot vs current; any divergence goes into an explicit "unknown/stale" bucket instead of being counted under the current option.

**Why:** Option IDs stay fixed when admins edit option text in place, so "option ID missing" checks silently relabel old answers under new meanings. Judging correctness must use the version the user actually answered.

**How to apply:** Any new aggregation or export over attempt answers must use the snapshot comparison, not the current question list alone. Legacy attempts without a snapshot only support deleted-ID detection. The snapshot contains the answer key — strip it from every participant-facing response; only admin aggregation may read it.
