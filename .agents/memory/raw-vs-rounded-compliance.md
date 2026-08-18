---
name: Raw-value compliance checks
description: Regulatory threshold checks must compare unrounded values; round only for display.
---
Rule: any pass/fail check against a regulatory threshold (e.g. Pasal 20 komposisi 75%/60%/25%) must evaluate the RAW ratio; rounding is presentation-only.

**Why:** rounding 74.96% → 75.0% before comparison falsely reports compliance; a completion code review rejected exactly this bug.

**How to apply:** keep computation in a pure lib function (`computeKomposisi` pattern in api-server) with `ok` from raw values and `actualPct` rounded separately; add boundary tests (just-below vs exact threshold).
