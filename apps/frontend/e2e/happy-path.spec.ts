import { expect, test } from "@playwright/test";
import type { Browser } from "@playwright/test";
import type { Page } from "@playwright/test";
import { newBrowserSession, seedOpenJob } from "./fixtures";

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

test("claim, chat, history refetch", async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const host = await newRolePage(browser, "host", testInfo.workerIndex);
  const cleaner = await newRolePage(browser, "cleaner", testInfo.workerIndex);
  // Seed through the browser host's own session so it owns the job.
  const address = `E2E Happy ${Date.now()}-w${testInfo.workerIndex}`;
  const message = `Hello E2E ${Date.now()}, obviously fake`;
  const { id: jobId } = await seedOpenJob(host.page.context().request, {
    address,
  });
  try {
    // Cleaner claims from the board.
    await cleaner.page.goto("/board");
    await cleaner.page.getByTestId(`cleaner-board-card-${jobId}`).click();
    await cleaner.page.getByTestId("cleaner-job-claim").click();
    await expect(cleaner.page.getByTestId("cleaner-job-claimed")).toBeVisible();

    // Cleaner opens chat and sends; reload proves history refetch.
    await cleaner.page.getByTestId("cleaner-job-open-chat").click();
    await cleaner.page.getByTestId("chat-input").fill(message);
    await cleaner.page.getByTestId("chat-send").click();
    await expect(cleaner.page.getByText(message)).toBeVisible();
    await cleaner.page.reload();
    await expect(cleaner.page.getByText(message)).toBeVisible();

    // Host reads the message from their own chat thread (claimed jobs
    // live under the Active segment).
    await host.page.goto("/post");
    await host.page.getByRole("tab", { name: "My jobs" }).click();
    await host.page.getByTestId("host-my-jobs-segment-active").click();
    await host.page.getByTestId(`host-job-card-${jobId}`).click();
    await host.page.getByTestId("host-job-open-chat").click();
    await expect(host.page.getByText(message)).toBeVisible();
  } finally {
    await host.close();
    await cleaner.close();
  }
});

test("start, complete, both reviews", async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const host = await newRolePage(browser, "host", testInfo.workerIndex);
  const cleaner = await newRolePage(browser, "cleaner", testInfo.workerIndex);
  // Seed through the browser host's own session so it owns the job.
  const address = `E2E Done ${Date.now()}-w${testInfo.workerIndex}`;
  const { id: jobId } = await seedOpenJob(host.page.context().request, {
    address,
  });
  try {
    // Cleaner claims through the UI so the job belongs to this session.
    await cleaner.page.goto("/board");
    await cleaner.page.getByTestId(`cleaner-board-card-${jobId}`).click();
    await cleaner.page.getByTestId("cleaner-job-claim").click();
    await expect(cleaner.page.getByTestId("cleaner-job-claimed")).toBeVisible();

    // Cleaner starts; host completes.
    await cleaner.page.getByRole("tab", { name: "My jobs" }).click();
    await cleaner.page.getByTestId(`cleaner-job-card-${jobId}`).click();
    await cleaner.page.getByTestId("cleaner-job-start").click();
    await expect(cleaner.page.getByTestId("cleaner-job-start")).toHaveCount(0);
    await host.page.goto("/post");
    await host.page.getByRole("tab", { name: "My jobs" }).click();
    await host.page.getByTestId("host-my-jobs-segment-active").click();
    await host.page.getByTestId(`host-job-card-${jobId}`).click();
    await host.page.getByTestId("host-job-complete").click();
    await expect(host.page.getByTestId("host-job-complete")).toHaveCount(0);

    // Host reviews the cleaner.
    await host.page.getByTestId("host-job-leave-review").click();
    await host.page.getByTestId("review-star-5").click();
    await host.page
      .getByTestId("review-comment")
      .fill("E2E review, obviously fake");
    await host.page.getByTestId("review-submit").click();
    await expect(host.page.getByTestId("leave-review-success")).toBeVisible();

    // Cleaner reviews the host from history. The completion happened in
    // the host session, so reload first: the cleaner's myClaimed cache
    // still says in_progress and only a fresh query shows history.
    await cleaner.page.reload();
    await cleaner.page.getByRole("tab", { name: "My jobs" }).click();
    await cleaner.page.getByTestId("cleaner-my-jobs-segment-history").click();
    await cleaner.page.getByTestId(`cleaner-job-card-${jobId}`).click();
    await cleaner.page.getByTestId("cleaner-job-leave-review").click();
    await cleaner.page.getByTestId("review-star-4").click();
    await cleaner.page.getByTestId("review-submit").click();
    await expect(
      cleaner.page.getByTestId("leave-review-success"),
    ).toBeVisible();
  } finally {
    await host.close();
    await cleaner.close();
  }
});
