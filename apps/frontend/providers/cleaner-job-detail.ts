import type { JobStatus } from "@sparkl/shared";
import { getStrings } from "./i18n";

// Pure helpers for the cleaner Job Detail screen (rules.md: no logic in
// components). Only open jobs can be claimed — the service re-checks the
// role, the status and the claim race, this only decides what to render
// and which message a failed claim shows.

export function cleanerClaimAvailableForStatus(status: JobStatus): boolean {
  return status === "open";
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

// jobs.claim maps JOB_ALREADY_CLAIMED and JOB_NOT_OPEN to TRPC CONFLICT
// (see apps/api/src/trpc/trpc.ts), so a conflict always means the job
// went away between the board render and the claim tap.
export function claimSubmitErrorMessage(err: unknown): string {
  const strings = getStrings();
  if (isConflictError(err)) return strings.errors.claimTaken;
  return strings.errors.generic;
}
