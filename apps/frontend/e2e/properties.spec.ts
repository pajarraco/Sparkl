import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { newBrowserSession } from "./fixtures";

// Properties suite (03 E): a host adds a property once, posts a job for
// it from the Post form's picker, then archives it. Geo is mocked, like
// forms.spec.ts, so runs stay offline-friendly.

async function mockGeo(page: Page): Promise<void> {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.route("**/trpc/geo.autocomplete?**", async (route) => {
    const raw = new URL(route.request().url()).searchParams.get("input");
    const query = (JSON.parse(raw ?? "{}") as { 0?: { query?: string } })[0]
      ?.query;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          result: {
            data: {
              places: [
                {
                  id: "osm:N1",
                  label: query ?? "E2E property",
                  latitude: 25.7617,
                  longitude: -80.1918,
                },
              ],
            },
          },
        },
      ]),
    });
  });
}

test.describe("properties", () => {
  test("add a property, use it on a posted job, then archive it", async ({
    browser,
  }, testInfo) => {
    const { context } = await newBrowserSession(
      browser,
      "host",
      testInfo.workerIndex,
    );
    const page = await context.newPage();
    try {
      const name = `E2E Studio ${Date.now()}-w${testInfo.workerIndex}`;
      const address = `123 Fake Street ${Date.now()}-w${testInfo.workerIndex}`;

      // Properties tab starts empty for a fresh account.
      await mockGeo(page);
      await page.goto("/host/properties");
      await expect(page.getByTestId("properties-empty")).toBeVisible();

      // Add one.
      await page.getByTestId("properties-add").click();
      await page.getByTestId("property-name").fill(name);
      await page.getByTestId("property-address").fill(address);
      await page.getByTestId("property-place-0").click();
      await expect(page.getByTestId("property-map")).toBeVisible();
      await page.getByTestId("property-size").fill("60");
      await page.getByTestId("property-notes").fill("Mop the hall");
      await page.getByTestId("property-save").click();

      // Back on the list, the new property shows.
      await expect(page.getByTestId("properties-list")).toBeVisible();
      await expect(page.getByText(name)).toBeVisible();

      // Post Job offers it in the picker.
      await page.goto("/host/post");
      await page.getByTestId("assistant-review").click();
      await expect(page.getByTestId("post-job-property-picker")).toBeVisible();
      await page.getByRole("button", { name }).click();
      await expect(page.getByTestId("post-job-selected-address")).toBeVisible();
      await page.getByTestId("post-job-date").fill("2026-11-07");
      await page.getByTestId("post-job-window-start").fill("10:00");
      await page.getByTestId("post-job-window-end").fill("13:00");
      await page.getByTestId("post-job-price").fill("85");
      await page.getByTestId("post-job-submit").click();
      await expect(page).toHaveURL(/\/host\/my-jobs$/);

      // Archive the property; it drops off the active list and picker.
      await page.goto("/host/properties");
      await page.getByText(name).click();
      await page.getByTestId("property-archive").click();
      await expect(page.getByTestId("property-archived")).toBeVisible();
      await page.goto("/host/properties");
      await expect(page.getByTestId("properties-empty")).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
