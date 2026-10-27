import { describe, expect, it } from "vitest";
import {
  hostActionsForStatus,
  hostChatAvailableForStatus,
  hostReviewAvailableForStatus,
  suggestionTrustLine,
} from "./job-detail";

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

describe("hostChatAvailableForStatus", () => {
  it("hides chat while the job is still open", () => {
    expect(hostChatAvailableForStatus("open")).toBe(false);
  });

  it("offers chat once claimed and afterwards", () => {
    expect(hostChatAvailableForStatus("claimed")).toBe(true);
    expect(hostChatAvailableForStatus("in_progress")).toBe(true);
    expect(hostChatAvailableForStatus("completed")).toBe(true);
    expect(hostChatAvailableForStatus("cancelled")).toBe(true);
  });
});

describe("hostReviewAvailableForStatus", () => {
  it("offers reviews only on completed jobs", () => {
    expect(hostReviewAvailableForStatus("completed")).toBe(true);
    expect(hostReviewAvailableForStatus("open")).toBe(false);
    expect(hostReviewAvailableForStatus("claimed")).toBe(false);
    expect(hostReviewAvailableForStatus("in_progress")).toBe(false);
    expect(hostReviewAvailableForStatus("cancelled")).toBe(false);
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
