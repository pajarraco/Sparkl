import type { JobRequest, JobStatus } from "@sparkl/shared";
import { getStrings } from "./i18n";

// Pure helpers for the cleaner Job Detail screen (rules.md: no logic in
// components). The service re-checks the role, the status and every
// race; this only decides what to render and which message a failed
// call shows.

// Only open jobs take a request or an offer response.
export function cleanerClaimAvailableForStatus(status: JobStatus): boolean {
  return status === "open";
}

// Only the claiming cleaner starts (claimed -> in_progress); the service
// re-checks the party, this only decides what to render.
export function cleanerStartAvailableForStatus(status: JobStatus): boolean {
  return status === "claimed";
}

// Chat unlocks once the job is claimed (the service rejects sends on open
// jobs); the thread stays readable afterwards, including history.
export function cleanerChatAvailableForStatus(status: JobStatus): boolean {
  return status !== "open";
}

// Reviews open once the job is completed (the service rejects earlier
// reviews); the form stays reachable from history afterwards.
export function cleanerReviewAvailableForStatus(status: JobStatus): boolean {
  return status === "completed";
}

function isConflictError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const data = (err as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return false;
  return (data as { code?: unknown }).code === "CONFLICT";
}

function errorCode(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const shape = err as { message?: unknown };
  return typeof shape.message === "string" ? shape.message : null;
}

// jobRequests.request/offer/accept/decline map JOB_REQUEST_EXISTS,
// OFFER_CAP_REACHED, REQUEST_CAP_REACHED and JOB_NOT_OPEN to TRPC CONFLICT
// alike; the message text (unmapped further by the client) tells them
// apart, falling back to the generic claim-taken copy.
export function requestSubmitErrorMessage(err: unknown): string {
  const strings = getStrings();
  if (!isConflictError(err)) return strings.errors.generic;
  const code = errorCode(err);
  if (code?.includes("already requested")) {
    return strings.errors.requestExists;
  }
  if (code?.includes("maximum number of pending offers")) {
    return strings.errors.offerCapReached;
  }
  if (code?.includes("too many pending requests")) {
    return strings.errors.requestCapReached;
  }
  if (code?.includes("no longer pending")) {
    return strings.errors.requestGone;
  }
  return strings.errors.claimTaken;
}

// The caller's own pending row on this job, if any — drives whether the
// screen shows "Request job" or the offer-response actions.
export function myPendingRequestForJob(
  mine: Array<{ request: JobRequest; job: { id: string } }>,
  jobId: string,
): JobRequest | null {
  const row = mine.find((r) => r.job.id === jobId);
  return row === undefined ? null : row.request;
}
