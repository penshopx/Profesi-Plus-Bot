---
name: Monetization (pay-per-Exum credits)
description: How the PKB app charges for Executive Summaries (one-time credits, not subscription) and the concurrency rules that keep grants/spends sound.
---

# Monetization — pay-per-Exum credits

**Model = bayar putus per 1 Exum (one-time credits, NO subscription, NO expiry).**
**Why:** PKB holders only need ~1 Exum/year (jenjang 7/8/9 = 4/6/8 Exum across the whole 5-year cert), and PKB points can also be earned via learning activities — so a monthly/recurring plan is mismatched and easy to game (subscribe 1 month, generate all, cancel). The unit sold is the Exum deliverable itself.

- `users.exumCredits` (int) = paid balance; `users.freeExumUsed` (bool) = lifetime free trial consumed.
- Free tier = **1 lifetime** trial Exum (NOT per month — monthly free defeats monetization since usage is ~1/yr). Then each Exum needs 1 credit.
- Legacy `users.plan` / `users.planExpiresAt` columns are kept but UNUSED (left to avoid a destructive drop). Do not reintroduce `isPro`/`monthStart`/`proExpiry` — they were removed.
- **Specialist personas are FREE** (interview costs nothing). The only paywall is generating the Exum. Don't re-add a persona lock.

## Gating (chat generate-exum) — keep atomic
Reserve inside a `db.transaction`: `SELECT … FROM users WHERE id=? FOR UPDATE` (drizzle `.for("update")`), then: credits>0 → decrement (source=`paid`); else !freeExumUsed → set true (source=`free`); else 402 `{code:"plan_limit"}`. On LLM failure, REFUND inside the same handler's try/catch: paid → `exumCredits + 1`, free → `freeExumUsed=false`. Success writes a `usageEvents` audit row (`exum_paid`/`exum_free`).
**Why:** a naive read-then-write lets two concurrent POSTs both spend the free trial or one credit twice; the row lock serializes per user. Refund must live only AFTER a successful reservation so a failed generation never costs the user.

## Scalev webhook — grant credits, insert-first idempotency
`extractOrder()` now also parses a `quantity` (default 1 = bayar putus per Exum). On a paid status, insert the payment with `onConflictDoNothing({target: payments.externalId}).returning()`; ONLY if a row comes back do `exumCredits += quantity`. Buyer→account match is by email (Scalev order email must equal Clerk email; `users.email` not unique so empties skipped, ordered by id).
**Why:** duplicate/retried deliveries must lose the unique-externalId race so credits aren't granted twice. `grantExumCredits` logic is the shared core any provider (Scalev OR the in-progress Midtrans task) should call.

## Still UNCONFIRMED / config
- Scalev has NO Replit connector — manual inbound webhook (`POST /api/webhooks/scalev`, public, HMAC-authed). Payload/header/signing scheme is GUESSED (tolerant field-picking; header tried `x-scalev-signature`/`x-signature`/`signature`; HMAC assumed SHA-512 hex over raw body). Get a real sample delivery to finalize before trusting in prod.
- Config: secret `SCALEV_WEBHOOK_SECRET` (HMAC key; until set the webhook returns 503) + `VITE_SCALEV_CHECKOUT_URL` (frontend "Beli 1 Exum" button; VITE_-prefixed so exposed to the client).
- 402 contract is now just `{code:"plan_limit", error}` (no more limit/used). Frontend `generateExum` throws `PlanLimitError(message)` → paywall modal "Beli 1 Exum".
- A "Midtrans Pro Payment Integration" project task (built on the OLD subscription model) was CANCELLED. If Midtrans is revisited, wire it to grant `exumCredits` (pay-per-Exum), not a plan/subscription.
