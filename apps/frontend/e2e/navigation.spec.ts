import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import {
  dayWindow,
  newBrowserSession,
  pinBoardToDay,
  seedOpenJob,
  tap,
} from "./fixtures";

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

test("a reload keeps each role on its own screens", async ({
  page,
  browser,
}, testInfo) => {
  // Regression: host and cleaner used to share /profile, /my-jobs and
  // /messages, and a direct load always opened the cleaner screen.
  await signUpAs(page, "host", testInfo.workerIndex);
  await page.getByRole("tab", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/host\/profile$/);
  await page.reload();
  await expect(page.getByTestId("host-profile-screen")).toBeVisible();
  await expect(page.getByTestId("cleaner-profile-screen")).toHaveCount(0);
  await page.goto("/host/my-jobs");
  await expect(page.getByTestId("host-my-jobs-screen")).toBeVisible();
  // An old cleaner-side URL sends the host home instead of the cleaner screen.
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/host\/my-jobs$/);
  await expect(page.getByTestId("host-my-jobs-screen")).toBeVisible();

  const fresh = await browser.newContext();
  const cleanerPage = await fresh.newPage();
  await signUpAs(cleanerPage, "cleaner", testInfo.workerIndex);
  // Wait for the signed-in tabs before loading a URL directly.
  await expect(cleanerPage.getByRole("tab", { name: "Board" })).toBeVisible();
  await cleanerPage.goto("/profile");
  await expect(cleanerPage.getByTestId("cleaner-profile-screen")).toBeVisible();
  await fresh.close();
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

// Tab stacks (03 A2): detail screens push inside their tab, keep the tab
// bar, and have a Back button that also works after a reload.

const NAV_DAY = "2036-07-01";

async function hostOnJobDetail(
  browser: Browser,
  workerIndex: number,
): Promise<{ page: Page; jobId: string; close: () => Promise<void> }> {
  const { context } = await newBrowserSession(browser, "host", workerIndex);
  const page = await context.newPage();
  const { id } = await seedOpenJob(context.request, {
    address: `E2E Nav ${Date.now()}-w${workerIndex}`,
    ...dayWindow(NAV_DAY),
  });
  await page.goto("/post");
  await page.getByRole("tab", { name: "My jobs" }).click();
  await tap(page, `host-job-card-${id}`);
  await expect(page.getByTestId("host-job-detail-screen")).toBeVisible();
  return { page, jobId: id, close: () => context.close() };
}

test("job detail keeps the tab bar and Back returns to My Jobs", async ({
  browser,
}, testInfo) => {
  const { page, close } = await hostOnJobDetail(browser, testInfo.workerIndex);
  try {
    await expect(page.getByRole("tab", { name: "Post" })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("host-my-jobs-screen")).toBeVisible();
    await expect(page).toHaveURL(/\/my-jobs$/);
  } finally {
    await close();
  }
});

test("a detail screen can jump straight to another tab", async ({
  browser,
}, testInfo) => {
  const { page, close } = await hostOnJobDetail(browser, testInfo.workerIndex);
  try {
    await page.getByRole("tab", { name: "Messages" }).click();
    await expect(page.getByTestId("host-messages-screen")).toBeVisible();
    await expect(page).toHaveURL(/\/messages$/);
  } finally {
    await close();
  }
});

test("tapping the active tab on a detail screen returns to its root", async ({
  browser,
}, testInfo) => {
  const { page, close } = await hostOnJobDetail(browser, testInfo.workerIndex);
  try {
    await page.getByRole("tab", { name: "My jobs" }).click();
    await expect(page.getByTestId("host-my-jobs-screen")).toBeVisible();
    await expect(page.getByTestId("host-job-detail-screen")).toHaveCount(0);
  } finally {
    await close();
  }
});

test("reload on a detail screen keeps the role, and Back goes to the tab", async ({
  browser,
}, testInfo) => {
  const { page, jobId, close } = await hostOnJobDetail(
    browser,
    testInfo.workerIndex,
  );
  try {
    // /job/:id exists in both role groups; a reload must not land a host
    // on the cleaner's screens.
    await page.reload();
    await expect(page.getByTestId("host-job-detail-screen")).toBeVisible();
    await expect(page.getByTestId("cleaner-job-detail-screen")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/job/${jobId}$`));
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("host-my-jobs-screen")).toBeVisible();
  } finally {
    await close();
  }
});

test("cleaner job detail keeps the tab bar and Back returns to the board", async ({
  browser,
}, testInfo) => {
  const host = await newBrowserSession(browser, "host", testInfo.workerIndex);
  const { id } = await seedOpenJob(host.context.request, {
    address: `E2E Nav ${Date.now()}-w${testInfo.workerIndex}`,
    ...dayWindow(NAV_DAY),
  });
  await host.context.close();
  const { context } = await newBrowserSession(
    browser,
    "cleaner",
    testInfo.workerIndex,
  );
  const page = await context.newPage();
  try {
    await pinBoardToDay(page, NAV_DAY, id);
    await tap(page, `cleaner-board-card-${id}`);
    await expect(page.getByTestId("cleaner-job-detail-screen")).toBeVisible();
    await expect(page.getByRole("tab", { name: "My jobs" })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("cleaner-board-screen")).toBeVisible();
  } finally {
    await context.close();
  }
});
