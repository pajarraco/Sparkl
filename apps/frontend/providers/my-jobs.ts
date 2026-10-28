import type { Job, JobStatus } from "@sparkl/shared";
import { getStrings } from "./i18n";
import type { JobStatusPill } from "./theme";

// Pure helpers for the host My Jobs list (rules.md: no logic in
// components). Segments group lifecycle states the way the tab design
// does: open jobs, active work, and terminal history.

export type MyJobsSegment = "open" | "active" | "history";

export const SEGMENT_STATUSES: Record<MyJobsSegment, JobStatus[]> = {
  open: ["open"],
  active: ["claimed", "in_progress"],
  history: ["completed", "cancelled"],
};

export function segmentForStatus(status: JobStatus): MyJobsSegment {
  if (status === "open") return "open";
  if (status === "completed" || status === "cancelled") return "history";
  return "active";
}

export function filterJobsBySegment(
  jobs: Job[],
  segment: MyJobsSegment,
): Job[] {
  const kept = new Set<JobStatus>(SEGMENT_STATUSES[segment]);
  return jobs.filter((job) => kept.has(job.status));
}

export function pillKeyForStatus(status: JobStatus): JobStatusPill {
  return status === "in_progress" ? "inProgress" : status;
}

export function statusLabelFor(status: JobStatus): string {
  const labels = getStrings().status;
  switch (status) {
    case "open":
      return labels.open;
    case "claimed":
      return labels.claimed;
    case "in_progress":
      return labels.inProgress;
    case "completed":
      return labels.completed;
    case "cancelled":
      return labels.cancelled;
  }
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPriceMinorUnits(minorUnits: number): string {
  return usd.format(minorUnits / 100);
}

const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatTimeUtc(iso: string): string {
  const date = new Date(iso);
  let hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const suffix = hours < 12 ? "AM" : "PM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const paddedMinutes = minutes.toString().padStart(2, "0");
  return `${hours}:${paddedMinutes} ${suffix}`;
}

export function formatJobWindow(
  windowStart: string,
  windowEnd: string,
): string {
  const day = dayFormat.format(new Date(windowStart));
  return `${day} · ${formatTimeUtc(windowStart)}–${formatTimeUtc(windowEnd)}`;
}

// Cleaner segments per design.md Screen Inventory: claimed jobs waiting to
// start, active work in progress, and terminal history. The myClaimed
// endpoint only ever returns jobs claimed by the caller, so there is no
// open segment — unlike the host list.

export type CleanerMyJobsSegment = "claimed" | "active" | "history";

export const CLEANER_SEGMENT_STATUSES: Record<
  CleanerMyJobsSegment,
  JobStatus[]
> = {
  claimed: ["claimed"],
  active: ["in_progress"],
  history: ["completed", "cancelled"],
};

export function cleanerSegmentForStatus(
  status: JobStatus,
): CleanerMyJobsSegment {
  if (status === "claimed") return "claimed";
  if (status === "in_progress") return "active";
  return "history";
}

export function filterCleanerJobsBySegment(
  jobs: Job[],
  segment: CleanerMyJobsSegment,
): Job[] {
  const kept = new Set<JobStatus>(CLEANER_SEGMENT_STATUSES[segment]);
  return jobs.filter((job) => kept.has(job.status));
}

// Variant B spotlight (prototype/board.html §vB): the next-up job — earliest
// windowStart — in the claimed/active segments. History never spotlights;
// match explanations and photos arrive with the board prototype fold-in,
// myClaimed carries no scores.
export function spotlightCleanerJob(
  jobs: Job[],
  segment: CleanerMyJobsSegment,
): Job | null {
  if (segment === "history") return null;
  const kept = filterCleanerJobsBySegment(jobs, segment);
  if (kept.length === 0) return null;
  return kept.reduce((earliest, job) =>
    job.windowStart < earliest.windowStart ? job : earliest,
  );
}

// Cleaner card meta line: same card spec as the host (date/time · price ·
// size), separate name so cleaner screens never import host helpers.
export function cleanerMetaLine(job: Job): string {
  return hostMetaLine(job);
}

// Host meta line per design.md job card: date/time · price · size.
export function hostMetaLine(job: Job): string {
  const parts = [
    formatJobWindow(job.windowStart, job.windowEnd),
    formatPriceMinorUnits(job.priceMinorUnits),
  ];
  if (job.sizeSqm !== null) parts.push(`${job.sizeSqm} m²`);
  return parts.join(" · ");
}
