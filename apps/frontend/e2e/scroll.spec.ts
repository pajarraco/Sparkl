import { expect, test } from "@playwright/test";
import { newApiSession, newBrowserSession, seedOpenJob } from "./fixtures";

// Scroll suite (context/features/01-e2e-testing-implementation.md step 6):
// the board FlatList scrolls at both viewports. Seeded jobs share one
// day, unique per run and project, so the date filter isolates them from
// every other run's leftovers on the shared dev database (each run seeds
// SCROLL_JOBS rows; a hardcoded day would overflow the board limit).

const SCROLL_JOBS = 10;

function uniqueJobDay(projectName: string, salt: number): string {
  const base = Date.UTC(2031, 5, 1);
  const minutes = Math.floor(Date.now() / 60_000);
  const projectSalt = projectName === "phone" ? 0 : 239;
  const offsetDays = (minutes + projectSalt + salt * 53) % 400;
  const day = new Date(base + offsetDays * 86_400_000);
  return day.toISOString().slice(0, 10);
}

test("board scrolls to the last seeded row", async ({ browser }, testInfo) => {
  const day = uniqueJobDay(testInfo.project.name, 7);
  const { api: hostApi } = await newApiSession("host", testInfo.workerIndex);
  const stamp = `${Date.now()}-w${testInfo.workerIndex}`;
  const ids: string[] = [];
  for (let index = 0; index < SCROLL_JOBS; index += 1) {
    const seeded = await seedOpenJob(hostApi, {
      address: `E2E Scroll ${stamp} #${index}`,
      windowStart: `${day}T10:00:00Z`,
      windowEnd: `${day}T13:00:00Z`,
    });
    ids.push(seeded.id);
  }
  const { context } = await newBrowserSession(
    browser,
    "cleaner",
    testInfo.workerIndex,
  );
  try {
    const page = await context.newPage();
    await page.goto("/board");
    await page.getByTestId("cleaner-board-date").fill(day);
    await page.getByTestId("cleaner-board-apply").click();
    const first = page.getByTestId(`cleaner-board-card-${ids[0]}`);
    await expect(first).toBeVisible();
    await expect(page.getByTestId("cleaner-board-loading")).toHaveCount(0);
    const cards = page.getByTestId(/cleaner-board-card-/);
    await expect(cards).toHaveCount(SCROLL_JOBS);
    // Wheel-scroll the list: the locator re-resolves on every poll, so
    // FlatList row recycling mid-scroll cannot detach the assertion.
    const list = page.getByTestId("cleaner-board-list");
    await list.hover();
    for (let wheel = 0; wheel < 8; wheel += 1) {
      await page.mouse.wheel(0, 500);
    }
    const last = page.getByTestId(`cleaner-board-card-${ids[SCROLL_JOBS - 1]}`);
    await expect(last).toBeVisible();
    const scrolled = await list.evaluate((element) => element.scrollTop);
    expect(scrolled).toBeGreaterThan(0);
  } finally {
    await hostApi.dispose();
    await context.close();
  }
});
