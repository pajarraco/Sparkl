import { expect, test } from "@playwright/test";

// Groundwork smoke: the harness boots the local stack (API + Expo web via
// the config webServer entries) and drives the real welcome screen. No
// fixtures yet — those land with step 2.
test("welcome renders with sign-in and sign-up entries", async ({ page }) => {
  await page.goto("/welcome");
  await expect(
    page.getByRole("heading", { name: "Welcome to Sparkl" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
