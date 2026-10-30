import type { JobRequest } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  cleanerChatAvailableForStatus,
  cleanerClaimAvailableForStatus,
  cleanerReviewAvailableForStatus,
  cleanerStartAvailableForStatus,
  myPendingRequestForJob,
  requestSubmitErrorMessage,
} from "./cleaner-job-detail";

function makeRequest(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    jobId: "22222222-2222-4222-8222-222222222222",
    cleanerId: "cleaner-1",
    initiatedBy: "cleaner",
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    respondedAt: null,
    ...overrides,
  };
}

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

describe("cleanerStartAvailableForStatus", () => {
  it("offers the start only while the job is claimed", () => {
    expect(cleanerStartAvailableForStatus("open")).toBe(false);
    expect(cleanerStartAvailableForStatus("claimed")).toBe(true);
    expect(cleanerStartAvailableForStatus("in_progress")).toBe(false);
    expect(cleanerStartAvailableForStatus("completed")).toBe(false);
    expect(cleanerStartAvailableForStatus("cancelled")).toBe(false);
  });
});

describe("requestSubmitErrorMessage", () => {
  it("maps each conflict message to its own copy", () => {
    expect(
      requestSubmitErrorMessage({
        data: { code: "CONFLICT" },
        message: "You already requested this job.",
      }),
    ).toBe("You already requested this job.");
    expect(
      requestSubmitErrorMessage({
        data: { code: "CONFLICT" },
        message: "This job already has the maximum number of pending offers.",
      }),
    ).toBe("This job already has the maximum number of pending offers.");
    expect(
      requestSubmitErrorMessage({
        data: { code: "CONFLICT" },
        message: "You have too many pending requests. Withdraw one first.",
      }),
    ).toBe("You have too many pending requests. Withdraw one first.");
    expect(
      requestSubmitErrorMessage({
        data: { code: "CONFLICT" },
        message: "Request is no longer pending.",
      }),
    ).toBe("This request is no longer available.");
    expect(
      requestSubmitErrorMessage({
        data: { code: "CONFLICT" },
        message: "Job is claimed, not open.",
      }),
    ).toBe("This job was just claimed by someone else.");
  });

  it("falls back to generic outside a conflict", () => {
    expect(requestSubmitErrorMessage({})).toBe(
      "Something went wrong. Try again.",
    );
  });
});

describe("myPendingRequestForJob", () => {
  it("finds the caller's own row for a job, or null when there is none", () => {
    const request = makeRequest();
    const rows = [{ request, job: { id: request.jobId } }];
    expect(myPendingRequestForJob(rows, request.jobId)).toEqual(request);
    expect(myPendingRequestForJob(rows, "other-job")).toBeNull();
    expect(myPendingRequestForJob([], request.jobId)).toBeNull();
  });
});
