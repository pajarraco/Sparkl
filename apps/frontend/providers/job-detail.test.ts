import type { JobRequest } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  hasPendingOfferTo,
  hostActionsForStatus,
  hostChatAvailableForStatus,
  hostReviewAvailableForStatus,
  suggestionTrustLine,
} from "./job-detail";

function makeRequest(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    jobId: "22222222-2222-4222-8222-222222222222",
    cleanerId: "cleaner-1",
    initiatedBy: "host",
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    respondedAt: null,
    ...overrides,
  };
}

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

describe("hasPendingOfferTo", () => {
  it("is true only for a pending host-initiated offer to that cleaner", () => {
    const rows = [{ request: makeRequest({ cleanerId: "cleaner-1" }) }];
    expect(hasPendingOfferTo(rows, "cleaner-1")).toBe(true);
    expect(hasPendingOfferTo(rows, "cleaner-2")).toBe(false);
    expect(
      hasPendingOfferTo(
        [
          {
            request: makeRequest({
              cleanerId: "cleaner-1",
              initiatedBy: "cleaner",
            }),
          },
        ],
        "cleaner-1",
      ),
    ).toBe(false);
    expect(hasPendingOfferTo([], "cleaner-1")).toBe(false);
  });
});
