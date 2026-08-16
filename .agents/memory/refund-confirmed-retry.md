---
name: Refund-confirmed retrySafe
description: Only advertise "credit not lost / safe to retry" after the refund write is confirmed.
---
Rule: an error response may set retrySafe:true (and reassure the user their credit is intact) only when the refund DB write succeeded; otherwise return a distinct non-retry-safe error ("hubungi admin").
**Why:** a DB outage can fail both the original operation and the refund — swallowing the refund error (.catch(()=>{})) lets the client invite a retry that burns another credit. Code review rejects unconditional retrySafe.
**How to apply:** refund helpers must return a confirmed boolean; clients key retry UX off the server retrySafe flag, never off HTTP status alone.

**Lockout rule (client side):** any generation failure without an explicit `retrySafe:true` — including plain network errors — must lock EVERY generation entry point (header button, banners, modal auto-generate) until an awaited refetch of the authoritative credit endpoint (`getMyPlan`, not usage/rate-limit counters) succeeds. Clear the lock only on refetch success; keep it and show an error on failure.
