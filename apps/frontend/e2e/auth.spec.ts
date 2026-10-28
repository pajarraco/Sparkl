import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { uniqueAccount } from "./fixtures";
import type { TestAccount } from "./fixtures";

// Auth suite: the only suite that drives the real sign-up/sign-in UI
// (context/features/01-e2e-testing-implementation.md step 3). Every
// account is timestamped per worker, so reruns never collide.

async function fillSignUp(
  page: Page,
  account: TestAccount,
  roleLabel: string,
): Promise<void> {
  await page.goto("/sign-up");
  await page.getByTestId("sign-up-name").fill(account.name);
  await page.getByTestId("sign-up-email").fill(account.email);
  await page.getByTestId("sign-up-password").fill(account.password);
  await page.getByRole("radio", { name: roleLabel }).click();
  await page.getByTestId("sign-up-submit").click();
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Sparkl" }),
  ).toBeVisible();
}

test("host sign-up lands on the host tabs", async ({ page }, testInfo) => {
  const account = uniqueAccount("host", testInfo.workerIndex);
  await fillSignUp(page, account, "Host");
  await expect(page.getByRole("tab", { name: "Post" })).toBeVisible();
});

test("cleaner sign-up lands on the ranked board", async ({
  page,
}, testInfo) => {
  const account = uniqueAccount("cleaner", testInfo.workerIndex);
  await fillSignUp(page, account, "Cleaner");
  await expect(page.getByRole("heading", { name: "Open jobs" })).toBeVisible();
});

test("sign-in returns an existing account to its home", async ({
  page,
}, testInfo) => {
  const account = uniqueAccount("host", testInfo.workerIndex);
  await fillSignUp(page, account, "Host");
  await expect(page.getByRole("tab", { name: "Post" })).toBeVisible();
  await signOut(page);
  await page.goto("/sign-in");
  await page.getByTestId("sign-in-email").fill(account.email);
  await page.getByTestId("sign-in-password").fill(account.password);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByRole("tab", { name: "Post" })).toBeVisible();
});

test("sign-out returns to welcome", async ({ page }, testInfo) => {
  const account = uniqueAccount("cleaner", testInfo.workerIndex);
  await fillSignUp(page, account, "Cleaner");
  await expect(page.getByRole("heading", { name: "Open jobs" })).toBeVisible();
  await signOut(page);
});

test("invalid login shows an error and stays put", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByTestId("sign-in-email").fill("nobody@example.com");
  await page.getByTestId("sign-in-password").fill("password123");
  await page.getByTestId("sign-in-submit").click();
  await expect(
    page.getByText("Something went wrong. Try again."),
  ).toBeVisible();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
});

test("duplicate registration shows an error", async ({ page }, testInfo) => {
  const account = uniqueAccount("host", testInfo.workerIndex);
  await fillSignUp(page, account, "Host");
  await expect(page.getByRole("tab", { name: "Post" })).toBeVisible();
  await signOut(page);
  await fillSignUp(page, account, "Host");
  await expect(
    page.getByText("Something went wrong. Try again."),
  ).toBeVisible();
});

test("empty sign-up shows required-field validation", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByTestId("sign-up-submit").click();
  const required = page.getByText("This field is required.");
  await expect(required.first()).toBeVisible();
  expect(await required.count()).toBeGreaterThan(1);
});

test("role is required", async ({ page }, testInfo) => {
  const account = uniqueAccount("cleaner", testInfo.workerIndex);
  await page.goto("/sign-up");
  await page.getByTestId("sign-up-name").fill(account.name);
  await page.getByTestId("sign-up-email").fill(account.email);
  await page.getByTestId("sign-up-password").fill(account.password);
  await page.getByTestId("sign-up-submit").click();
  await expect(page.getByText("This field is required.")).toBeVisible();
});
