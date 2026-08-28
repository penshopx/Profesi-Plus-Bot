---
name: Release-build port isolation
description: Replit workflow ports and local bundler ports must not make production builds environment-dependent.
---

Production builds must not require the workflow `PORT`; only dev/preview servers should validate it. Expo static-build scripts should allocate an available loopback port and pass it explicitly to Metro instead of assuming port 8081.

**Why:** Replit can keep several artifact workflows running at once. A Vite build failed when no workflow port was injected, and a non-interactive Expo build timed out when another artifact occupied Metro's default port.

**How to apply:** Keep Vite port validation inside `serve` mode, provide an artifact-safe build base path, and route every Metro health/bundle/manifest request through the dynamically selected build port.