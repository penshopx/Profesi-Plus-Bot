import { defineConfig } from "vitest/config";
import path from "node:path";

// Standalone vitest config — deliberately does NOT reuse vite.config.ts
// (the app config pulls in React/runtime plugins that unit tests don't need).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
