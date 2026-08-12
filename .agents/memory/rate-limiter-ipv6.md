---
name: Rate limiter IPv6 validation
description: express-rate-limit v8 throws on raw req.ip usage in keyGenerator; must use ipKeyGenerator helper.
---

express-rate-limit v8 throws `ValidationError: ERR_ERL_KEY_GEN_IPV6` at startup if a custom `keyGenerator` reads `req.ip` (or any string that looks like an IP) without using the library's own IPv6-normalising helper.

**Why:** The library added a validator that detects raw IP usage to force developers to handle IPv6 properly (IPv6 users can bypass limits if the address isn't normalised).

**How to apply:**
```typescript
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

function userKey(req: Request): string {
  const uid = (req as any).dbUser?.id;
  return uid !== undefined ? `user:${uid}` : ipKeyGenerator(req); // ← not req.ip
}
```
This is fine for auth-gated routes (IP fallback is rare) and satisfies the validator.
