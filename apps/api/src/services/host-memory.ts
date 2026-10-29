// Framework-free business logic: no drizzle/fastify imports allowed here.
// Per-host memory for the post-tab assistant (02 P2 smart). Everything here
// is worked out by the service from the host's own jobs, reviews and past
// assistant sessions — never by the model — and passed to the prompt as
// facts. Across hosts only aggregates may ever be used, never another
// host's data; this module reads one host at a time, so that rule holds by
// construction. No message text, only counts and field names.
import { JOB_DRAFT_FIELDS, type Job, type JobDraftField } from "@sparkl/shared";
import type {
  AssistantSessionsStore,
  SessionCorrections,
} from "./assistant-sessions.js";
import type { JobsStore } from "./jobs.js";
import type { ReviewsStore } from "./reviews.js";
import type { UsersStore } from "./users.js";

export interface HostMemoryStores {
  jobs: Pick<JobsStore, "listJobsByHost">;
  users: Pick<UsersStore, "findById">;
  reviews: Pick<ReviewsStore, "findReviewByJobAndAuthor">;
  sessions: Pick<AssistantSessionsStore, "listFinishedByHost">;
}

export interface HostJobSummary {
  address: string;
  windowStart: string;
  windowEnd: string;
  sizeSqm: number | null;
  notes: string | null;
  priceMinorUnits: number;
}

export interface HostProperty {
  address: string;
  latitude: number;
  longitude: number;
}

export interface HostMemory {
  recentJobs: HostJobSummary[];
  singleProperty: HostProperty | null;
  usualCleaner: { id: string; name: string } | null;
  correctionHints: JobDraftField[];
}

// Recent jobs offered to the model through get_host_history.
export const HOST_HISTORY_LIMIT = 5;
// usualCleaner: the same cleaner on this many of the host's last N
// completed jobs, with no review from the host below MIN_STARS.
export const USUAL_CLEANER_LAST_N = 5;
export const USUAL_CLEANER_MIN_SAME = 3;
export const USUAL_CLEANER_MIN_STARS = 4;
// A field earns a correction hint when the host changed it this often after
// the model filled it, with at least MIN_FILLS observations.
export const CORRECTION_MIN_FILLS = 2;
export const CORRECTION_MIN_RATE = 0.5;

export function toJobSummary(job: Job): HostJobSummary {
  return {
    address: job.address,
    windowStart: job.windowStart,
    windowEnd: job.windowEnd,
    sizeSqm: job.sizeSqm,
    notes: job.notes,
    priceMinorUnits: job.priceMinorUnits,
  };
}

export function recentJobSummaries(
  all: Job[],
  limit: number = HOST_HISTORY_LIMIT,
): HostJobSummary[] {
  return [...all]
    .sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    )
    .slice(0, limit)
    .map(toJobSummary);
}

// Coordinates are grouped at ~11m so two geocodings of the same address
// stay one property while neighbouring buildings do not.
function propertyKey(job: Job): string {
  return `${job.latitude.toFixed(4)},${job.longitude.toFixed(4)}`;
}

// Exactly one distinct geocoded address across the host's jobs (02 decided
// address-per-job, no properties table). The label comes from the most
// recent job at that property.
export function findSingleProperty(all: Job[]): HostProperty | null {
  if (all.length === 0) return null;
  const keys = new Set(all.map(propertyKey));
  if (keys.size !== 1) return null;
  const latest = [...all].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  )[0];
  if (!latest) return null;
  return {
    address: latest.address,
    latitude: latest.latitude,
    longitude: latest.longitude,
  };
}

function lastCompleted(all: Job[]): Job[] {
  return all
    .filter((j) => j.status === "completed" && j.claimedByCleanerId !== null)
    .sort((a, b) =>
      a.windowStart < b.windowStart
        ? 1
        : a.windowStart > b.windowStart
          ? -1
          : 0,
    )
    .slice(0, USUAL_CLEANER_LAST_N);
}

// The cleaner id behind at least MIN_SAME of the last N completed jobs, or
// null. Ties break toward the most recent job; deterministic either way.
export function findUsualCleanerId(all: Job[]): string | null {
  const recent = lastCompleted(all);
  if (recent.length === 0) return null;
  const counts = new Map<string, number>();
  for (const job of recent) {
    const id = job.claimedByCleanerId;
    if (id === null) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const job of recent) {
    const id = job.claimedByCleanerId;
    if (id !== null && (counts.get(id) ?? 0) >= USUAL_CLEANER_MIN_SAME) {
      return id;
    }
  }
  return null;
}

// True when the host left the cleaner no review below MIN_STARS on the
// recent jobs they share. A missing review is not a bad review.
export async function hostRatesCleanerWell(
  reviews: Pick<ReviewsStore, "findReviewByJobAndAuthor">,
  args: { hostId: string; cleanerId: string; shared: Job[] },
): Promise<boolean> {
  for (const job of args.shared) {
    if (job.claimedByCleanerId !== args.cleanerId) continue;
    const review = await reviews.findReviewByJobAndAuthor(job.id, args.hostId);
    if (
      review !== null &&
      review.subjectId === args.cleanerId &&
      review.stars < USUAL_CLEANER_MIN_STARS
    ) {
      return false;
    }
  }
  return true;
}

// Fields the host corrects on the review form at least MIN_RATE of the
// times the model filled them (MIN_FILLS minimum), in canonical field
// order so the prompt is stable.
export function correctionHints(
  sessions: SessionCorrections[],
): JobDraftField[] {
  const filled = new Map<JobDraftField, number>();
  const changed = new Map<JobDraftField, number>();
  for (const session of sessions) {
    for (const field of new Set(session.modelFilled)) {
      filled.set(field, (filled.get(field) ?? 0) + 1);
    }
    for (const field of new Set(session.hostChanged)) {
      if (session.modelFilled.includes(field)) {
        changed.set(field, (changed.get(field) ?? 0) + 1);
      }
    }
  }
  return JOB_DRAFT_FIELDS.filter((field) => {
    const fills = filled.get(field) ?? 0;
    if (fills < CORRECTION_MIN_FILLS) return false;
    return (changed.get(field) ?? 0) / fills >= CORRECTION_MIN_RATE;
  });
}

export async function buildHostMemory(
  stores: HostMemoryStores,
  hostId: string,
): Promise<HostMemory> {
  const all = await stores.jobs.listJobsByHost(hostId);
  const cleanerId = findUsualCleanerId(all);
  let usualCleaner: HostMemory["usualCleaner"] = null;
  if (cleanerId !== null) {
    const recent = lastCompleted(all);
    const shared = recent.filter((j) => j.claimedByCleanerId === cleanerId);
    const [user, wellRated] = [
      await stores.users.findById(cleanerId),
      await hostRatesCleanerWell(stores.reviews, {
        hostId,
        cleanerId,
        shared,
      }),
    ];
    if (user !== null && user.role === "cleaner" && wellRated) {
      usualCleaner = { id: user.id, name: user.name };
    }
  }
  const finished = await stores.sessions.listFinishedByHost(hostId);
  return {
    recentJobs: recentJobSummaries(all),
    singleProperty: findSingleProperty(all),
    usualCleaner,
    correctionHints: correctionHints(finished),
  };
}

export const EMPTY_HOST_MEMORY: HostMemory = {
  recentJobs: [],
  singleProperty: null,
  usualCleaner: null,
  correctionHints: [],
};
