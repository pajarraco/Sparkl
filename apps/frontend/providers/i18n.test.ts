import { describe, expect, it } from "vitest";
import { getStrings } from "./i18n";

describe("i18n provider", () => {
  it("returns the English table with board and tab keys", () => {
    const strings = getStrings();
    expect(strings.tabs.board).toBe("Board");
    expect(strings.board.title).toBe("Open jobs");
    expect(strings.postJob.submit).toBe("Post job");
  });
});
