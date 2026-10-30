import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { newBrowserSession } from "./fixtures";

// Assistant learning suite (04 L1, step 10). Runs on the fake model that
// the e2e API boot uses (LLM_MODE=fake, NODE_ENV=test): the host's message
// markers pick the scripted tool calls. Chips are found by their
// accessibility labels, never by CSS.

const PROPOSAL_ROW = /^assistant-proposal-[0-9a-f-]{36}$/;

async function send(page: Page, text: string): Promise<void> {
  await page.getByTestId("assistant-input").fill(text);
  await page.getByTestId("assistant-send").click();
}

async function expectReply(page: Page, text: string): Promise<void> {
  await expect(page.getByTestId("assistant-thinking")).toHaveCount(0);
  await expect(page.getByText(text)).toBeVisible();
}

test.describe("assistant learning", () => {
  test("a saved checklist is accepted and offered first in a new session; a phone number is refused", async ({
    browser,
  }, testInfo) => {
    const { context } = await newBrowserSession(
      browser,
      "host",
      testInfo.workerIndex,
    );
    const page = await context.newPage();
    try {
      await page.goto("/host/post");

      // Session 1: save a clean checklist. It is offered as a candidate.
      await send(page, "[e2e:save] save this checklist");
      await expectReply(page, "Saved this checklist for next time.");
      await expect(page.getByTestId(PROPOSAL_ROW).first()).toContainText(
        "Checklist (2 items)",
      );
      // Accepting it makes it active; the chip row goes away.
      await page
        .getByRole("button", { name: "Use this: Checklist (2 items)" })
        .click();
      await expect(page.getByTestId("assistant-proposals")).toHaveCount(0);

      // Same session: a checklist with a phone number is refused, and
      // nothing new is offered.
      await send(page, "[e2e:save-phone] save a checklist with a phone number");
      await expectReply(page, "[e2e:refused] I could not save that checklist.");
      await expect(page.getByTestId("assistant-proposals")).toHaveCount(0);

      // Session 2: start over, then ask for the saved checklists. The host's
      // own checklist comes first, ahead of every shared one.
      await page.getByTestId("assistant-start-over").click();
      await send(page, "[e2e:find] what checklists do I have?");
      await expectReply(page, "Here are the saved checklists.");
      await expect(page.getByTestId(PROPOSAL_ROW).first()).toContainText(
        "Checklist (2 items)",
      );
    } finally {
      await context.close();
    }
  });
});
