---
name: Client countdown + server clock skew
description: Pattern for showing accurate countdowns that don't drift when the device clock differs from the server.
---

# Client Countdown + Server Clock Skew

## The Rule
Always pair an absolute timestamp (`resetAt`) with a `serverNow` field in the same API response. Never rely on `Date.now()` alone to compute a countdown from an absolute timestamp.

## Why
If the user's device clock is wrong (phone set to wrong time, timezone mismatch), `new Date(resetAt).getTime() - Date.now()` gives a wrong delay. A 30-minute skew means the countdown shows −30:00 or +30:00 before the real reset.

## How to Apply
**Backend** (`GET /users/me/usage` in `artifacts/api-server/src/routes/users.ts`):
```ts
const serverNow = new Date().toISOString();
res.json({ used, limit, remaining, resetAt, serverNow });
```

**Client** (React / React Native):
```ts
const usageFetchedAt = useRef<number>(0);
useEffect(() => {
  if (!usage?.resetAt || !usage.serverNow) { setCountdown(null); return; }
  usageFetchedAt.current = Date.now();
  const resetDelay = new Date(usage.resetAt).getTime() - new Date(usage.serverNow).getTime();
  const tick = () => {
    const msLeft = Math.max(0, resetDelay - (Date.now() - usageFetchedAt.current));
    // format + setCountdown
  };
  tick();
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}, [usage?.resetAt, usage?.serverNow]);
```

Key: `resetDelay` is fixed at fetch time; elapsed is `Date.now() - usageFetchedAt.current`. The device clock is only used to measure elapsed time (a relative quantity), never to interpret the absolute `resetAt`.
