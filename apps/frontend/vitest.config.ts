import { defineConfig } from "vitest/config";

// Unit suite only: Playwright E2E lives in e2e/ and runs via `pnpm e2e`
// (its specs import @playwright/test, which vitest must never collect).
export default defineConfig({
  test: {
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
