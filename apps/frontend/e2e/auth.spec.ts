import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { newApiSession, signUpViaApi, uniqueAccount } from "./fixtures";
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

// In-app sign-in from welcome (no page.goto): a reload would wipe the
// in-memory session and query cache, which is where a role switch breaks.
async function signInFromWelcome(
  page: Page,
  account: TestAccount,
): Promise<void> {
  await page.getByTestId("welcome-sign-in").click();
  await page.getByTestId("sign-in-email").fill(account.email);
  await page.getByTestId("sign-in-password").fill(account.password);
  await page.getByTestId("sign-in-submit").click();
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

// Role switch on one browser (03 A1): the second account must land on its
// own home on the first sign-in, in both directions.
test("host → cleaner switch lands on the board first time", async ({
  page,
}, testInfo) => {
  const hostSession = await newApiSession("host", testInfo.workerIndex);
  const cleanerSession = await newApiSession("cleaner", testInfo.workerIndex);
  await hostSession.api.dispose();
  await cleanerSession.api.dispose();
  const host = hostSession.account;
  const cleaner = cleanerSession.account;
  await page.goto("/welcome");
  await signInFromWelcome(page, host);
  await expect(page.getByRole("tab", { name: "Post" })).toBeVisible();
  await signOut(page);
  await signInFromWelcome(page, cleaner);
  await expect(page.getByRole("heading", { name: "Open jobs" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Board" })).toBeVisible();
});

test("cleaner → host switch lands on the host tabs first time", async ({
  page,
}, testInfo) => {
  const cleanerSession = await newApiSession("cleaner", testInfo.workerIndex);
  const hostSession = await newApiSession("host", testInfo.workerIndex);
  await cleanerSession.api.dispose();
  await hostSession.api.dispose();
  const cleaner = cleanerSession.account;
  const host = hostSession.account;
  await page.goto("/welcome");
  await signInFromWelcome(page, cleaner);
  await expect(page.getByRole("heading", { name: "Open jobs" })).toBeVisible();
  await signOut(page);
  await signInFromWelcome(page, host);
  await expect(page.getByRole("tab", { name: "Post" })).toBeVisible();
});

test("restored host session → cleaner switch lands on the board", async ({
  page,
}, testInfo) => {
  // Host session restored on page load (cookie already in the browser),
  // the way a returning user starts, not one created by the sign-in form.
  const host = uniqueAccount("host", testInfo.workerIndex);
  await signUpViaApi(page.context().request, host);
  const cleanerSession = await newApiSession("cleaner", testInfo.workerIndex);
  await cleanerSession.api.dispose();
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Post" })).toBeVisible();
  await signOut(page);
  await signInFromWelcome(page, cleanerSession.account);
  await expect(page.getByRole("heading", { name: "Open jobs" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Board" })).toBeVisible();
});
