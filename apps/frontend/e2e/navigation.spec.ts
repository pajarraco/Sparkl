import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Navigation suite (context/features/01-e2e-testing-implementation.md
// step 4): role tabs, URL-per-tab, history back, unknown routes, and the
// logged-out / expired-session redirects.

async function signUpAs(
  page: Page,
  role: "host" | "cleaner",
  workerIndex: number,
): Promise<void> {
  const stamp = `${Date.now()}-w${workerIndex}`;
  await page.goto("/sign-up");
  await page.getByTestId("sign-up-name").fill(`E2E Nav ${stamp}`);
  await page.getByTestId("sign-up-email").fill(`e2e-nav-${stamp}@example.com`);
  await page.getByTestId("sign-up-password").fill("password123");
  await page
    .getByRole("radio", { name: role === "host" ? "Host" : "Cleaner" })
    .click();
  await page.getByTestId("sign-up-submit").click();
}

test("host sees host tabs, cleaner sees cleaner tabs", async ({
  page,
  browser,
}, testInfo) => {
  await signUpAs(page, "host", testInfo.workerIndex);
  for (const tab of ["My jobs", "Post", "Messages", "Profile"]) {
    await expect(page.getByRole("tab", { name: tab })).toBeVisible();
  }
  await expect(page.getByRole("tab", { name: "Board" })).toHaveCount(0);

  const fresh = await browser.newContext();
  const cleanerPage = await fresh.newPage();
  await signUpAs(cleanerPage, "cleaner", testInfo.workerIndex);
  for (const tab of ["Board", "My jobs", "Messages", "Profile"]) {
    await expect(cleanerPage.getByRole("tab", { name: tab })).toBeVisible();
  }
  await expect(cleanerPage.getByRole("tab", { name: "Post" })).toHaveCount(0);
  await fresh.close();
});

test("each tab changes the URL to its route", async ({ page }, testInfo) => {
  await signUpAs(page, "host", testInfo.workerIndex);
  await page.getByRole("tab", { name: "Post" }).click();
  await expect(page).toHaveURL(/\/post$/);
  await page.getByRole("tab", { name: "My jobs" }).click();
  await expect(page).toHaveURL(/\/my-jobs$/);
});

test("history back returns to the previous tab", async ({ page }, testInfo) => {
  await signUpAs(page, "host", testInfo.workerIndex);
  await page.getByRole("tab", { name: "Post" }).click();
  await expect(page).toHaveURL(/\/post$/);
  await page.getByRole("tab", { name: "My jobs" }).click();
  await expect(page).toHaveURL(/\/my-jobs$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/post$/);
});

test("unknown route leaves the app usable", async ({ page }) => {
  await page.goto("/nope-not-a-route");
  await page.goto("/welcome");
  await expect(
    page.getByRole("heading", { name: "Welcome to Sparkl" }),
  ).toBeVisible();
});

test("logged-out deep link redirects to welcome", async ({ page }) => {
  await page.goto("/my-jobs");
  await expect(
    page.getByRole("heading", { name: "Welcome to Sparkl" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/welcome$/);
});

test("expired session returns to welcome", async ({
  page,
  context,
}, testInfo) => {
  await signUpAs(page, "cleaner", testInfo.workerIndex);
  await expect(page.getByRole("heading", { name: "Open jobs" })).toBeVisible();
  await context.clearCookies();
  await page.goto("/board");
  // Queries retry before the UNAUTHORIZED handler fires; allow the
  // backoff to play out.
  await expect(
    page.getByRole("heading", { name: "Welcome to Sparkl" }),
    "expired session redirects to welcome",
  ).toBeVisible({ timeout: 30_000 });
});
