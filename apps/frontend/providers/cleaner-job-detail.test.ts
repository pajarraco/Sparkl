import { describe, expect, it } from "vitest";
import {
  claimSubmitErrorMessage,
  cleanerChatAvailableForStatus,
  cleanerClaimAvailableForStatus,
  cleanerReviewAvailableForStatus,
} from "./cleaner-job-detail";

describe("cleanerClaimAvailableForStatus", () => {
  it("offers the claim only while the job is open", () => {
    expect(cleanerClaimAvailableForStatus("open")).toBe(true);
    expect(cleanerClaimAvailableForStatus("claimed")).toBe(false);
    expect(cleanerClaimAvailableForStatus("in_progress")).toBe(false);
    expect(cleanerClaimAvailableForStatus("completed")).toBe(false);
    expect(cleanerClaimAvailableForStatus("cancelled")).toBe(false);
  });
});

describe("cleanerChatAvailableForStatus", () => {
  it("opens chat once claimed, never while open", () => {
    expect(cleanerChatAvailableForStatus("open")).toBe(false);
    expect(cleanerChatAvailableForStatus("claimed")).toBe(true);
    expect(cleanerChatAvailableForStatus("in_progress")).toBe(true);
    expect(cleanerChatAvailableForStatus("completed")).toBe(true);
    expect(cleanerChatAvailableForStatus("cancelled")).toBe(true);
  });
});

describe("cleanerReviewAvailableForStatus", () => {
  it("opens reviews only once completed", () => {
    expect(cleanerReviewAvailableForStatus("open")).toBe(false);
    expect(cleanerReviewAvailableForStatus("claimed")).toBe(false);
    expect(cleanerReviewAvailableForStatus("in_progress")).toBe(false);
    expect(cleanerReviewAvailableForStatus("completed")).toBe(true);
    expect(cleanerReviewAvailableForStatus("cancelled")).toBe(false);
  });
});

describe("claimSubmitErrorMessage", () => {
  it("names the just-claimed race", () => {
    expect(claimSubmitErrorMessage({ data: { code: "CONFLICT" } })).toBe(
      "This job was just claimed by someone else.",
    );
  });

  it("falls back to generic", () => {
    expect(claimSubmitErrorMessage({})).toBe(
      "Something went wrong. Try again.",
    );
    expect(claimSubmitErrorMessage(null)).toBe(
      "Something went wrong. Try again.",
    );
  });
});
