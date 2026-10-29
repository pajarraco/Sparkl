import { expect, test } from "@playwright/test";
import type { Browser } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  dayWindow,
  fillInto,
  newBrowserSession,
  pinBoardToDay,
  seedOpenJob,
  tap,
} from "./fixtures";

// Happy-path suite (context/features/01-e2e-testing-implementation.md
// step 7): post → claim → chat → in-progress → completed → both reviews,
// end to end on web. Two staged tests share the lifecycle through
// API-seeded handoffs so each stays far under the timeout on a cold dev
// server; every stage itself is driven through the UI. Chat assertions
// use history refetch (reload), never socket-push timing.
//
// Navigation stays inside each role's tab group: /my-jobs, /job/:id,
// /chat/:jobId and /review/:jobId exist in BOTH the (host) and (cleaner)
// groups, so a bare page.goto on those URLs can resolve to the wrong
// group's screen. Only /post (host) and /board (cleaner) are unique and
// safe to deep-link; everything else goes through tab taps and buttons.

async function newRolePage(
  browser: Browser,
  role: "host" | "cleaner",
  workerIndex: number,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const { context } = await newBrowserSession(browser, role, workerIndex);
  return { page: await context.newPage(), close: () => context.close() };
}

const HAPPY_DAY_1 = "2036-06-06";

test("claim, chat, history refetch", async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const host = await newRolePage(browser, "host", testInfo.workerIndex);
  const cleaner = await newRolePage(browser, "cleaner", testInfo.workerIndex);
  // Seed through the browser host's own session so it owns the job.
  const address = `E2E Happy ${Date.now()}-w${testInfo.workerIndex}`;
  const message = `Hello E2E ${Date.now()}, obviously fake`;
  const { id: jobId } = await seedOpenJob(host.page.context().request, {
    address,
    ...dayWindow(HAPPY_DAY_1),
  });
  try {
    // Cleaner claims from the board (pinned to our day, failing fast).
    await pinBoardToDay(cleaner.page, HAPPY_DAY_1, jobId);
    await tap(cleaner.page, `cleaner-board-card-${jobId}`);
    await tap(cleaner.page, "cleaner-job-claim");
    await expect(cleaner.page.getByTestId("cleaner-job-claimed")).toBeVisible();

    // Cleaner opens chat and sends; reload proves history refetch.
    await tap(cleaner.page, "cleaner-job-open-chat");
    await fillInto(cleaner.page, "chat-input", message);
    await tap(cleaner.page, "chat-send");
    await expect(cleaner.page.getByText(message)).toBeVisible();
    await cleaner.page.reload();
    await expect(cleaner.page.getByText(message)).toBeVisible();

    // Host reads the message from their own chat thread (claimed jobs
    // live under the Active segment).
    await host.page.goto("/post");
    await host.page.getByRole("tab", { name: "My jobs" }).click();
    await host.page.getByTestId("host-my-jobs-segment-active").click();
    await tap(host.page, `host-job-card-${jobId}`);
    await tap(host.page, "host-job-open-chat");
    await expect(host.page.getByText(message)).toBeVisible();
  } finally {
    await host.close();
    await cleaner.close();
  }
});

const HAPPY_DAY_2 = "2036-06-07";

test("start, complete, both reviews", async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const host = await newRolePage(browser, "host", testInfo.workerIndex);
  const cleaner = await newRolePage(browser, "cleaner", testInfo.workerIndex);
  // Seed through the browser host's own session so it owns the job.
  const address = `E2E Done ${Date.now()}-w${testInfo.workerIndex}`;
  const { id: jobId } = await seedOpenJob(host.page.context().request, {
    address,
    ...dayWindow(HAPPY_DAY_2),
  });
  try {
    // Cleaner claims through the UI so the job belongs to this session.
    await pinBoardToDay(cleaner.page, HAPPY_DAY_2, jobId);
    await tap(cleaner.page, `cleaner-board-card-${jobId}`);
    await tap(cleaner.page, "cleaner-job-claim");
    await expect(cleaner.page.getByTestId("cleaner-job-claimed")).toBeVisible();

    // Cleaner starts; host completes.
    await cleaner.page.getByRole("tab", { name: "My jobs" }).click();
    await tap(cleaner.page, `cleaner-job-card-${jobId}`);
    await tap(cleaner.page, "cleaner-job-start");
    await expect(cleaner.page.getByTestId("cleaner-job-start")).toHaveCount(0);
    await host.page.goto("/post");
    await host.page.getByRole("tab", { name: "My jobs" }).click();
    await host.page.getByTestId("host-my-jobs-segment-active").click();
    await tap(host.page, `host-job-card-${jobId}`);
    await tap(host.page, "host-job-complete");
    await expect(host.page.getByTestId("host-job-complete")).toHaveCount(0);

    // Host reviews the cleaner.
    await tap(host.page, "host-job-leave-review");
    await tap(host.page, "review-star-5");
    await fillInto(host.page, "review-comment", "E2E review, obviously fake");
    await tap(host.page, "review-submit");
    await expect(host.page.getByTestId("leave-review-success")).toBeVisible();

    // Cleaner reviews the host from history. The completion happened in
    // the host session, so reload first: the cleaner's myClaimed cache
    // still says in_progress and only a fresh query shows history.
    await cleaner.page.reload();
    await cleaner.page.getByRole("tab", { name: "My jobs" }).click();
    await cleaner.page.getByTestId("cleaner-my-jobs-segment-history").click();
    await tap(cleaner.page, `cleaner-job-card-${jobId}`);
    await tap(cleaner.page, "cleaner-job-leave-review");
    await tap(cleaner.page, "review-star-4");
    await tap(cleaner.page, "review-submit");
    await expect(
      cleaner.page.getByTestId("leave-review-success"),
    ).toBeVisible();
  } finally {
    await host.close();
    await cleaner.close();
  }
});
