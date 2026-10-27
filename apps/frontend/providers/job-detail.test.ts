import { describe, expect, it } from "vitest";
import { hostActionsForStatus, suggestionTrustLine } from "./job-detail.js";

describe("hostActionsForStatus", () => {
  it("offers cancel on pre-terminal states", () => {
    expect(hostActionsForStatus("open")).toEqual(["cancel"]);
    expect(hostActionsForStatus("claimed")).toEqual(["cancel"]);
  });

  it("offers complete plus cancel while in progress", () => {
    expect(hostActionsForStatus("in_progress")).toEqual(["complete", "cancel"]);
  });

  it("offers nothing on terminal states", () => {
    expect(hostActionsForStatus("completed")).toEqual([]);
    expect(hostActionsForStatus("cancelled")).toEqual([]);
  });
});

describe("suggestionTrustLine", () => {
  it("combines rating and completed count", () => {
    expect(suggestionTrustLine({ avgRating: 4.8, completedJobCount: 12 })).toBe(
      "4.8 · 12 jobs completed",
    );
  });

  it("omits the rating for unrated cleaners", () => {
    expect(suggestionTrustLine({ avgRating: null, completedJobCount: 0 })).toBe(
      "0 jobs completed",
    );
  });
});
