import type { JobStatus, RankedCleaner } from "@sparkl/shared";
import { getStrings } from "./i18n";

// Pure helpers for the host Job Detail screen (rules.md: no logic in
// components). Action availability mirrors the server's transition rules
// (only the host completes/cancels; only the claiming cleaner starts —
// the service re-checks everything, this only decides what to render).

export type HostJobAction = "cancel" | "complete";

export function hostActionsForStatus(status: JobStatus): HostJobAction[] {
  switch (status) {
    case "open":
    case "claimed":
      return ["cancel"];
    case "in_progress":
      return ["complete", "cancel"];
    case "completed":
    case "cancelled":
      return [];
  }
}

// Chat unlocks once a cleaner claims the job (the service rejects sends
// on open jobs); the thread stays readable afterwards, including history.
export function hostChatAvailableForStatus(status: JobStatus): boolean {
  return status !== "open";
}

// Reviews open once the job is completed (the service rejects earlier
// reviews); the form stays reachable from history afterwards so both
// parties can leave one.
export function hostReviewAvailableForStatus(status: JobStatus): boolean {
  return status === "completed";
}

type CleanerTrustProfile = Pick<
  RankedCleaner["cleaner"]["profile"],
  "avgRating" | "completedJobCount"
>;

// Suggestion trust line per design.md job card: ★ rating plus
// completed-job count from the matching service, never hardcoded.
// The ★ glyph itself stays in the component (orange-deep styling).
export function suggestionTrustLine(profile: CleanerTrustProfile): string {
  const jobs = `${profile.completedJobCount} ${getStrings().jobCard.jobsDone}`;
  if (profile.avgRating === null) return jobs;
  return `${profile.avgRating.toFixed(1)} · ${jobs}`;
}
