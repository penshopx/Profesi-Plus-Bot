---
name: Monetization (Scalev freemium)
description: How Pro upgrades and per-month free quotas are enforced for the PKB app, and the concurrency rules that keep them sound.
---

# Monetization — Scalev freemium

Pro is a 30-day plan (`users.plan` = free/pro, `users.planExpiresAt`). `isPro()` checks plan==pro AND not expired. Free tier: 1 Exum generation per calendar month + forced generalist persona (pak-budi); Pro = unlimited + specialist personas.

## Scalev (no Replit integration exists)
Scalev is an Indonesian order/funnel platform. There is NO Replit connector — it is wired manually as an inbound webhook (`POST /api/webhooks/scalev`, public route, authenticated by HMAC).
- **Webhook payload/header/signing scheme is UNCONFIRMED.** `extractOrder()` is deliberately tolerant (tries many field names); signature header tried across `x-scalev-signature`/`x-signature`/`signature`; HMAC assumed SHA-512 hex over the raw body. Get a real sample delivery from the user to finalize parsing + the exact header/algorithm before trusting it in production.
- Config needed: secret `SCALEV_WEBHOOK_SECRET` (HMAC key) + `VITE_SCALEV_CHECKOUT_URL` (frontend upgrade button; exposed to Vite via a VITE_-prefixed env/secret).
- **Buyer→account mapping is by email** (Scalev order email must equal the user's Clerk email). `users.email` is NOT unique (defaults to '') so empty emails are skipped and matches are ordered by id for determinism. The robust fix (if abuse appears) is to carry an immutable userId/reference in Scalev checkout metadata instead of matching on email.

## Concurrency rules (don't regress these)
- **Free Exum quota must be reserved atomically, not count-then-insert.** A naive `count() … generate … insert(usage)` lets two concurrent requests both pass. Pattern used: a transaction that does `SELECT id FROM users WHERE id=? FOR UPDATE` (serializes per user), re-counts the month, and inserts the usage_event up-front as a reservation. On LLM failure the reserved row is deleted so a failed attempt never costs quota.
- **Webhook idempotency must be insert-first, not check-then-act.** Insert the payment with `onConflictDoNothing({target: payments.externalId}).returning()`; only grant Pro if a row came back. The unique `externalId` makes duplicate/retried deliveries lose the race. Checking existence before upgrading is racy.

**Why:** both are real monetization-bypass / double-grant vectors flagged in architect review; the UI button-disable alone does not stop scripted concurrent POSTs.

## Misc
- Monthly window (`monthStart()`) is UTC, not WIB — quota resets at 07:00 local. Acceptable for now; revisit if users complain.
- 402 `{code:"plan_limit", limit, used}` is the gate contract; frontend `generateExum` throws `PlanLimitError` → paywall modal.
