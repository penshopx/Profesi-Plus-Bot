import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Each test file runs in its own context so rate-limiter stores never
    // bleed between test files.
    pool: "forks",
    // Do NOT set NODE_ENV to "test" via vitest — the rate-limiter skip
    // guard checks this value. We set it explicitly in our test helpers
    // only when we want the production skips to apply; the rate-limiter
    // tests create their own instances without skip.
    env: {
      // override so the general app code doesn't see "test" if it matters,
      // but our test-specific limiter instances ignore NODE_ENV anyway.
      NODE_ENV: "test",
    },
  },
});
