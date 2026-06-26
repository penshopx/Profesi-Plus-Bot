---
name: Express router.use auth leaks across root-mounted routers
description: Why a path-less router.use(requireAuth) inside one feature router blocked unrelated endpoints in the api-server
---

In `artifacts/api-server/src/routes/index.ts` every feature router is mounted at the
root with `router.use(chatRouter)`, `router.use(dialogGustaftaRouter)`, etc. (no mount path).

**Gotcha:** a path-less `router.use(requireAuth)` placed inside one feature router runs for
**every** request that flows through that router — including requests destined for other
routers mounted later — because root-mounted routers see all paths and only fall through
(via next()) when no route matches. Since `requireAuth` sends 401 instead of calling next(),
it blocked the anonymous `/dialog-gustafta` endpoint when added to the chat router.

**Why:** middleware added with `router.use(mw)` (no path) matches all paths; root-mounting
means unrelated requests still pass through and trip it before reaching their own router.

**How to apply:** when gating a subset of routes in this api-server, scope the middleware to
the shared path prefix — e.g. `router.use("/chat", requireAuth)` — or attach `requireAuth`
per-route. Never use a bare `router.use(requireAuth)` in a feature router that is root-mounted
alongside public routers. Keep any intentionally-public route (e.g. `/chat/models`) registered
*before* the gate.
