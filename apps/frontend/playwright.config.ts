import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// Web-only, local-only E2E (context/features/01-e2e-testing-implementation.md).
// Playwright drives the Expo web build; native stays manual. Runs need the
// local stack — the webServer entries below boot the API and Expo web when
// they are not already running (reuseExistingServer), so `pnpm e2e` works
// from a cold checkout as long as Docker (PostgreSQL) is up. Kept out of
// `pnpm verify` on purpose: these suites need live servers.
//
// The repo-root .env picks the stack (a second worktree runs on its own
// ports, see .env.example). Shell variables still win; loading it here
// also hands the values to global-setup and the webServer commands.
const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const apiUrl =
  process.env.SPKL_API_URL ??
  `http://localhost:${process.env.API_PORT ?? "3000"}`;
const webUrl = process.env.SPKL_WEB_URL ?? "http://localhost:8081";
const webPort = new URL(webUrl).port || "8081";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: webUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // 375px phone width on Chromium (Apple device descriptors need
      // WebKit, which is not installed; the width is what the spec
      // asserts, not the Safari engine).
      name: "phone",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 375, height: 667 },
        hasTouch: true,
      },
    },
    {
      name: "wide",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @sparkl/api dev",
      url: `${apiUrl}/api/auth/get-session`,
      reuseExistingServer: true,
      timeout: 120_000,
      // The assistant suite needs the scripted model; a live LLM is not
      // reachable from the e2e run. fake is refused outside test/development.
      env: { LLM_MODE: "fake", NODE_ENV: "test" },
    },
    {
      command: `pnpm --filter @sparkl/frontend dev -- --web --port ${webPort}`,
      url: webUrl,
      reuseExistingServer: true,
      timeout: 240_000,
    },
  ],
});
