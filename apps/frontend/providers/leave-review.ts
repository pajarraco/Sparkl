import type { Job } from "@sparkl/shared";
import { getStrings } from "./i18n";

// Pure helpers for the Leave Review screen (rules.md: no logic in
// components). The server re-checks everything (completed-only,
// job-party author, other-party subject, one review per job+author —
// see apps/api/src/services/reviews.ts); this module only validates
// the form before sending and maps the duplicate error to its string.
// A host always reviews the claiming cleaner.

export const REVIEW_STARS = [1, 2, 3, 4, 5] as const;

export type ReviewStars = (typeof REVIEW_STARS)[number];

export const REVIEW_COMMENT_MAX_LENGTH = 1000;

export type ReviewField = "stars" | "comment";

export type ReviewFieldErrors = Partial<Record<ReviewField, string>>;

export interface ReviewFormResult {
  data: { stars: ReviewStars; comment: string | undefined } | null;
  errors: ReviewFieldErrors;
}

export interface ReviewFormInput {
  stars?: unknown;
  comment?: unknown;
}

export function validateReviewForm(input: ReviewFormInput): ReviewFormResult {
  const strings = getStrings();
  const errors: ReviewFieldErrors = {};

  const stars = input.stars;
  const starsOk =
    typeof stars === "number" &&
    Number.isInteger(stars) &&
    stars >= 1 &&
    stars <= 5;
  if (!starsOk) errors.stars = strings.errors.requiredField;

  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  if (comment.length > REVIEW_COMMENT_MAX_LENGTH) {
    errors.comment = strings.errors.generic;
  }

  if (errors.stars !== undefined || errors.comment !== undefined) {
    return { data: null, errors };
  }
  return {
    data: {
      stars: stars as ReviewStars,
      comment: comment === "" ? undefined : comment,
    },
    errors: {},
  };
}

export function hostReviewSubjectForJob(
  job: Pick<Job, "claimedByCleanerId">,
): string | null {
  return job.claimedByCleanerId;
}

function isConflictError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const data = (err as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return false;
  return (data as { code?: unknown }).code === "CONFLICT";
}

// reviews.create maps REVIEW_DUPLICATE to TRPC CONFLICT (no other
// reviews.create failure uses that code), so a conflict always means
// this job was already reviewed by the caller.
export function reviewSubmitErrorMessage(err: unknown): string {
  const strings = getStrings();
  if (isConflictError(err)) return strings.errors.reviewExists;
  return strings.errors.generic;
}
