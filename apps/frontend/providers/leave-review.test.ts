import { describe, expect, it } from "vitest";
import {
  hostReviewSubjectForJob,
  reviewSubmitErrorMessage,
  validateReviewForm,
} from "./leave-review";

describe("validateReviewForm", () => {
  it("accepts stars with a comment", () => {
    expect(
      validateReviewForm({ stars: 5, comment: "Spotless, on time" }),
    ).toEqual({
      data: { stars: 5, comment: "Spotless, on time" },
      errors: {},
    });
  });

  it("accepts stars alone", () => {
    expect(validateReviewForm({ stars: 4 })).toEqual({
      data: { stars: 4, comment: undefined },
      errors: {},
    });
  });

  it("requires a star rating", () => {
    for (const stars of [null, undefined, 0, 6, 3.5, "5"]) {
      expect(validateReviewForm({ stars }).data).toBe(null);
      expect(validateReviewForm({ stars }).errors.stars).toBe(
        "This field is required.",
      );
    }
  });

  it("rejects comments over the shared 1000-character limit", () => {
    const result = validateReviewForm({ stars: 5, comment: "x".repeat(1001) });
    expect(result.data).toBe(null);
    expect(result.errors.comment).not.toBe(undefined);
  });
});

describe("hostReviewSubjectForJob", () => {
  it("reviews the claiming cleaner", () => {
    expect(
      hostReviewSubjectForJob({
        claimedByCleanerId: "33333333-3333-3333-3333-333333333333",
      }),
    ).toBe("33333333-3333-3333-3333-333333333333");
  });

  it("has no subject before a claim", () => {
    expect(hostReviewSubjectForJob({ claimedByCleanerId: null })).toBe(null);
  });
});

describe("reviewSubmitErrorMessage", () => {
  it("names the duplicate case", () => {
    expect(reviewSubmitErrorMessage({ data: { code: "CONFLICT" } })).toBe(
      "You already reviewed this job.",
    );
  });

  it("falls back to generic", () => {
    expect(reviewSubmitErrorMessage({})).toBe(
      "Something went wrong. Try again.",
    );
    expect(reviewSubmitErrorMessage(null)).toBe(
      "Something went wrong. Try again.",
    );
  });
});
