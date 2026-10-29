import { expect, test } from "@playwright/test";
import type { Browser } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  dayWindow,
  jobIdByAddress,
  newApiSession,
  newBrowserSession,
  pinBoardToDay,
  seedOpenJob,
} from "./fixtures";

// Forms and buttons suite (context/features/01-e2e-testing-implementation.md
// step 5): Post Job create flow, board filters (date, distance, price),
// the claim CTA, every primary button asserted by accessible label or
// testID at both viewports. Sessions are API-seeded; only the auth suite
// drives the sign-up UI.

const JOB_DAY = "2026-11-07";

async function newHostPage(
  browser: Browser,
  workerIndex: number,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const { context } = await newBrowserSession(browser, "host", workerIndex);
  const page = await context.newPage();
  return { page, close: () => context.close() };
}

async function fillPostForm(page: Page, address: string): Promise<void> {
  await page.goto("/post");
  await page.getByTestId("post-job-address").fill(address);
  await page.getByTestId("post-job-date").fill(JOB_DAY);
  await page.getByTestId("post-job-window-start").fill("10:00");
  await page.getByTestId("post-job-window-end").fill("13:00");
  await page.getByTestId("post-job-size").fill("80");
  await page
    .getByTestId("post-job-notes")
    .fill("E2E posted job, obviously fake");
  await page.getByTestId("post-job-price").fill("85");
  await page.getByTestId("post-job-latitude").fill("25.7617");
  await page.getByTestId("post-job-longitude").fill("-80.1918");
}

test("host posts a job through the UI and sees success", async ({
  browser,
}, testInfo) => {
  const { page, close } = await newHostPage(browser, testInfo.workerIndex);
  try {
    const address = `E2E Post ${Date.now()}-w${testInfo.workerIndex}`;
    await fillPostForm(page, address);
    await page.getByTestId("post-job-submit").click();
    await expect(page.getByTestId("post-job-success")).toBeVisible();
    const id = await jobIdByAddress(
      page.context().request,
      "jobs.myJobs",
      address,
    );
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    await page.getByTestId("post-job-again").click();
    await expect(page.getByTestId("post-job-address")).toHaveValue("");
  } finally {
    await close();
  }
});

test("empty post form shows validation", async ({ browser }, testInfo) => {
  const { page, close } = await newHostPage(browser, testInfo.workerIndex);
  try {
    await page.goto("/post");
    await page.getByTestId("post-job-submit").click();
    await expect(page.getByText("This field is required.")).toBeVisible();
    await expect(page.getByText("Use YYYY-MM-DD.")).toBeVisible();
    await expect(page.getByText("Enter a valid price.")).toBeVisible();
    await expect(page.getByTestId("post-job-success")).toHaveCount(0);
  } finally {
    await close();
  }
});

// Seeded jobs use a day no other run touches: the shared dev database
// accumulates open jobs, and the unfiltered board only shows the top 20
// by rank, so every board test isolates its job with a unique date.
const FILTER_DAY = "2033-03-03";

test("board date filter narrows to the job day", async ({
  browser,
}, testInfo) => {
  const { api: hostApi } = await newApiSession("host", testInfo.workerIndex);
  const address = `E2E Filter ${Date.now()}-w${testInfo.workerIndex}`;
  const { id } = await seedOpenJob(hostApi, {
    address,
    windowStart: `${FILTER_DAY}T10:00:00Z`,
    windowEnd: `${FILTER_DAY}T13:00:00Z`,
  });
  const { context } = await newBrowserSession(
    browser,
    "cleaner",
    testInfo.workerIndex,
  );
  try {
    const page = await context.newPage();
    await page.goto("/board");
    await page.getByTestId("cleaner-board-date").fill(FILTER_DAY);
    await page.getByTestId("cleaner-board-apply").click();
    await expect(page.getByTestId(`cleaner-board-card-${id}`)).toBeVisible();
    await page.getByTestId("cleaner-board-date").fill("2030-01-01");
    await page.getByTestId("cleaner-board-apply").click();
    await expect(page.getByTestId("cleaner-board-list")).toHaveCount(0);
    await expect(page.getByText("No open jobs near you yet.")).toBeVisible();
    await page.getByTestId("cleaner-board-clear").click();
    await expect(page.getByTestId("cleaner-board-date")).toHaveValue("");
    await expect(page.getByTestId("cleaner-board-list")).toBeVisible();
  } finally {
    await hostApi.dispose();
    await context.close();
  }
});

const PRICE_DAY = "2032-02-02";

test("board price filter narrows by minimum", async ({ browser }, testInfo) => {
  const { api: hostApi } = await newApiSession("host", testInfo.workerIndex);
  const address = `E2E Price ${Date.now()}-w${testInfo.workerIndex}`;
  const { id } = await seedOpenJob(hostApi, {
    address,
    priceMinorUnits: 8500,
    windowStart: `${PRICE_DAY}T10:00:00Z`,
    windowEnd: `${PRICE_DAY}T13:00:00Z`,
  });
  const { context } = await newBrowserSession(
    browser,
    "cleaner",
    testInfo.workerIndex,
  );
  try {
    const page = await context.newPage();
    await page.goto("/board");
    await page.getByTestId("cleaner-board-date").fill(PRICE_DAY);
    await page.getByTestId("cleaner-board-apply").click();
    await expect(page.getByTestId(`cleaner-board-card-${id}`)).toBeVisible();
    await page.getByTestId("cleaner-board-min-price").fill("100");
    await page.getByTestId("cleaner-board-apply").click();
    await expect(page.getByTestId("cleaner-board-list")).toHaveCount(0);
    await page.getByTestId("cleaner-board-min-price").fill("10");
    await page.getByTestId("cleaner-board-apply").click();
    await expect(page.getByTestId(`cleaner-board-card-${id}`)).toBeVisible();
  } finally {
    await hostApi.dispose();
    await context.close();
  }
});

test("board shows validation for bad filter values", async ({
  browser,
}, testInfo) => {
  const { context } = await newBrowserSession(
    browser,
    "cleaner",
    testInfo.workerIndex,
  );
  try {
    const page = await context.newPage();
    await page.goto("/board");
    await page.getByTestId("cleaner-board-date").fill("not-a-date");
    await page.getByTestId("cleaner-board-min-price").fill("abc");
    await page.getByTestId("cleaner-board-apply").click();
    await expect(page.getByText("Use YYYY-MM-DD.")).toBeVisible();
    await expect(page.getByText("Enter a valid price.")).toBeVisible();
  } finally {
    await context.close();
  }
});

const DISTANCE_DAY = "2034-04-04";

test("board distance filter needs a service area first", async ({
  browser,
}, testInfo) => {
  const { api: hostApi } = await newApiSession("host", testInfo.workerIndex);
  const address = `E2E Dist ${Date.now()}-w${testInfo.workerIndex}`;
  const { id } = await seedOpenJob(hostApi, {
    address,
    windowStart: `${DISTANCE_DAY}T10:00:00Z`,
    windowEnd: `${DISTANCE_DAY}T13:00:00Z`,
  });
  const { context } = await newBrowserSession(
    browser,
    "cleaner",
    testInfo.workerIndex,
  );
  try {
    const page = await context.newPage();
    await page.goto("/board");
    await page.getByTestId("cleaner-board-date").fill(DISTANCE_DAY);
    await page.getByTestId("cleaner-board-max-distance").fill("50");
    await page.getByTestId("cleaner-board-apply").click();
    await expect(
      page.getByText("Set your service area in Profile to filter by distance."),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Profile" }).click();
    await page.getByTestId("cleaner-profile-latitude").fill("25.7617");
    await page.getByTestId("cleaner-profile-longitude").fill("-80.1918");
    await page.getByTestId("cleaner-profile-radius").fill("50");
    await page.getByTestId("cleaner-profile-save-area").click();
    await page.getByRole("tab", { name: "Board" }).click();
    await page.getByTestId("cleaner-board-max-distance").fill("50");
    await page.getByTestId("cleaner-board-apply").click();
    await expect(page.getByTestId(`cleaner-board-card-${id}`)).toBeVisible();
  } finally {
    await hostApi.dispose();
    await context.close();
  }
});

const CLAIM_DAY = "2035-05-05";

test("claim CTA claims the job from its detail", async ({
  browser,
}, testInfo) => {
  const { api: hostApi } = await newApiSession("host", testInfo.workerIndex);
  const address = `E2E Claim ${Date.now()}-w${testInfo.workerIndex}`;
  const { id } = await seedOpenJob(hostApi, {
    address,
    ...dayWindow(CLAIM_DAY),
  });
  const { context } = await newBrowserSession(
    browser,
    "cleaner",
    testInfo.workerIndex,
  );
  try {
    const page = await context.newPage();
    await pinBoardToDay(page, CLAIM_DAY, id);
    await page.getByTestId(`cleaner-board-card-${id}`).click();
    await expect(page.getByRole("button", { name: "Claim job" })).toBeVisible();
    await page.getByTestId("cleaner-job-claim").click();
    await expect(page.getByTestId("cleaner-job-claimed")).toBeVisible();
  } finally {
    await hostApi.dispose();
    await context.close();
  }
});
