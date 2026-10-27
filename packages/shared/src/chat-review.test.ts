import { describe, expect, it } from "vitest";
import { SPARKL_ERROR_CODES } from "./errors.js";
import { listMessagesInputSchema, sendMessageInputSchema } from "./messages.js";
import { createReviewInputSchema, listReviewsInputSchema } from "./reviews.js";

describe("sendMessageInputSchema", () => {
  it("trims the body and rejects empty messages", () => {
    expect(
      sendMessageInputSchema.parse({
        jobId: "11111111-1111-4111-8111-111111111111",
        body: "  hello  ",
      }).body,
    ).toBe("hello");
    expect(() =>
      sendMessageInputSchema.parse({
        jobId: "11111111-1111-4111-8111-111111111111",
        body: "   ",
      }),
    ).toThrow();
  });
});

describe("createReviewInputSchema", () => {
  it("allows an absent comment and bounds stars to 1–5", () => {
    const input = createReviewInputSchema.parse({
      jobId: "11111111-1111-4111-8111-111111111111",
      subjectId: "22222222-2222-4222-8222-222222222222",
      stars: 5,
    });
    expect(input.comment).toBeUndefined();
    expect(() =>
      createReviewInputSchema.parse({
        jobId: "11111111-1111-4111-8111-111111111111",
        subjectId: "22222222-2222-4222-8222-222222222222",
        stars: 6,
      }),
    ).toThrow();
  });
});

describe("list inputs", () => {
  it("default paging for chat and review lists", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(listMessagesInputSchema.parse({ jobId: id })).toMatchObject({
      limit: 50,
      offset: 0,
    });
    expect(listReviewsInputSchema.parse({ subjectId: id })).toMatchObject({
      limit: 20,
      offset: 0,
    });
  });
});

describe("SPARKL_ERROR_CODES", () => {
  it("covers the claim race and review preconditions", () => {
    expect(SPARKL_ERROR_CODES.JOB_ALREADY_CLAIMED).toBe("JOB_ALREADY_CLAIMED");
    expect(SPARKL_ERROR_CODES.REVIEW_NOT_ALLOWED).toBe("REVIEW_NOT_ALLOWED");
    expect(SPARKL_ERROR_CODES.REVIEW_DUPLICATE).toBe("REVIEW_DUPLICATE");
    expect(SPARKL_ERROR_CODES.NOT_JOB_PARTY).toBe("NOT_JOB_PARTY");
  });
});
