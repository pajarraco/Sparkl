import { defineConfig, devices } from "@playwright/test";

// Web-only, local-only E2E (context/features/01-e2e-testing-implementation.md).
// Playwright drives the Expo web build; native stays manual. Runs need the
// local stack — the webServer entries below boot the API and Expo web when
// they are not already running (reuseExistingServer), so `pnpm e2e` works
// from a cold checkout as long as Docker (PostgreSQL) is up. Kept out of
// `pnpm verify` on purpose: these suites need live servers.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.SPKL_WEB_URL ?? "http://localhost:8081",
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
      url: "http://localhost:3000/api/auth/get-session",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @sparkl/frontend dev -- --web --port 8081",
      url: process.env.SPKL_WEB_URL ?? "http://localhost:8081",
      reuseExistingServer: true,
      timeout: 240_000,
    },
  ],
});
