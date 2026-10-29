// Framework-free business logic: no drizzle/fastify imports allowed here.
// On-read scoring for ranked cleaner suggestions (host view of one job).
// Scores are computed fresh on every call — no precompute pipeline in MVP.
// Every signal scores 0..1; missing data scores a neutral 0.5.
import {
  type CleanerAvailability,
  type Job,
  type ListOpenJobsInput,
  type MatchBreakdown,
  type Message,
  type PublicCleanerProfile,
  RANKING_WEIGHTS_FLAG,
  RANKING_WEIGHTS_V1,
  RANKING_WEIGHTS_V2,
  type RankedCleaner,
  type RankedJob,
  type RankingWeights,
  type SparklErrorCode,
  type SuggestCleanersInput,
  type User,
  type UserRole,
} from "@sparkl/shared";
import { type JobsStore, filterOpenJobs, haversineKm } from "./jobs.js";
import type { UsersStore } from "./users.js";

export class MatchingError extends Error {
  readonly code: SparklErrorCode;

  constructor(code: SparklErrorCode, message: string) {
    super(message);
    this.name = "MatchingError";
    this.code = code;
  }
}

export interface MessagesRead {
  listMessagesByJob(jobId: string): Promise<Message[]>;
}

export interface MatchingStores {
  jobs: Pick<
    JobsStore,
    "findJobById" | "listJobsByCleaner" | "listJobsByHost" | "listOpenJobs"
  >;
  users: Pick<UsersStore, "findById" | "listAvailability" | "listCleaners">;
  messages: MessagesRead;
}

/** Flag provider (Unleash in production, env-backed locally). */
export interface RankingFlags {
  isEnabled(flag: string): boolean;
}

export function resolveWeights(flags: RankingFlags): RankingWeights {
  return flags.isEnabled(RANKING_WEIGHTS_FLAG)
    ? { ...RANKING_WEIGHTS_V2 }
    : { ...RANKING_WEIGHTS_V1 };
}

const NEUTRAL = 0.5;
/** Fallback search radius when a cleaner set no service area. */
export const DEFAULT_SERVICE_RADIUS_KM = 25;
/** completedJobCount that earns a full completed-jobs signal. */
export const COMPLETED_JOBS_CAP = 25;
/** Reply delays beyond this cap score zero on response time. */
export const RESPONSE_TIME_CAP_MINUTES = 1440;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function scoreRating(avgRating: number | null): number {
  if (avgRating === null) return NEUTRAL;
  return clamp01(avgRating / 5);
}

export function scoreDistanceKm(
  distanceKm: number | null,
  radiusKm: number | null,
): number {
  if (distanceKm === null) return NEUTRAL;
  const radius = radiusKm ?? DEFAULT_SERVICE_RADIUS_KM;
  if (!(radius > 0)) return NEUTRAL;
  return clamp01(1 - distanceKm / radius);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const MINUTES_PER_DAY = 1440;

// Fraction of the job window covered by the cleaner's slots on the job's
// (start) weekday. Weekdays follow Date.getUTCDay (0 = Sunday). Multi-day
// windows score against the start day only — MVP windows are same-day.
export function availabilityOverlapFraction(
  job: Job,
  slots: CleanerAvailability[],
): number {
  if (slots.length === 0) return NEUTRAL;
  const start = new Date(job.windowStart);
  const end = new Date(job.windowEnd);
  const jobMinutes = (end.getTime() - start.getTime()) / 60000;
  if (!(jobMinutes > 0)) return NEUTRAL;
  const weekday = start.getUTCDay();
  const windowStartMin = start.getUTCHours() * 60 + start.getUTCMinutes();
  const dayMinutes = Math.min(jobMinutes, MINUTES_PER_DAY - windowStartMin);
  const windowEndMin = Math.min(windowStartMin + jobMinutes, MINUTES_PER_DAY);
  let overlap = 0;
  for (const slot of slots) {
    if (slot.weekday !== weekday) continue;
    const s = Math.max(toMinutes(slot.startTime), windowStartMin);
    const e = Math.min(toMinutes(slot.endTime), windowEndMin);
    if (e > s) overlap += e - s;
  }
  return clamp01(overlap / dayMinutes);
}

export function scoreCompletedJobs(completedJobCount: number): number {
  return clamp01(completedJobCount / COMPLETED_JOBS_CAP);
}

// Share of the cleaner's claimed jobs that reached completed. A cleaner with
// no claims yet scores neutral — they have not failed, just unproven.
export function acceptanceRate(claimedJobs: Job[]): number {
  if (claimedJobs.length === 0) return NEUTRAL;
  const completed = claimedJobs.filter((j) => j.status === "completed").length;
  return completed / claimedJobs.length;
}

export function responseTimeScore(delaysMinutes: number[]): number {
  if (delaysMinutes.length === 0) return NEUTRAL;
  const avg = delaysMinutes.reduce((a, b) => a + b, 0) / delaysMinutes.length;
  return clamp01(
    1 - Math.min(avg, RESPONSE_TIME_CAP_MINUTES) / RESPONSE_TIME_CAP_MINUTES,
  );
}

// For each host message on the job, the delay to the cleaner's next reply.
export function replyDelaysMinutes(
  job: Job,
  messages: Message[],
  cleanerId: string,
): number[] {
  const sorted = [...messages].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
  const delays: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const msg = sorted[i];
    if (msg === undefined || msg.senderId !== job.hostId) continue;
    const reply = sorted.slice(i + 1).find((m) => m.senderId === cleanerId);
    if (reply !== undefined) {
      delays.push(
        (new Date(reply.createdAt).getTime() -
          new Date(msg.createdAt).getTime()) /
          60000,
      );
    }
  }
  return delays;
}

function toPublicProfile(
  cleaner: User,
  availability: CleanerAvailability[],
): PublicCleanerProfile {
  return {
    profile: {
      id: cleaner.id,
      role: cleaner.role,
      name: cleaner.name,
      photoUrl: cleaner.photoUrl,
      serviceLat: cleaner.serviceLat,
      serviceLng: cleaner.serviceLng,
      serviceRadiusKm: cleaner.serviceRadiusKm,
      avgRating: cleaner.avgRating,
      completedJobCount: cleaner.completedJobCount,
    },
    availability: availability.map((s) => ({
      weekday: s.weekday,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  };
}

export function scoreCleaner(
  breakdown: MatchBreakdown,
  weights: RankingWeights,
): number {
  return clamp01(
    weights.rating * breakdown.rating +
      weights.distance * breakdown.distance +
      weights.availability * breakdown.availability +
      weights.completedJobs * breakdown.completedJobs +
      weights.acceptanceRate * breakdown.acceptanceRate +
      weights.responseTime * breakdown.responseTime,
  );
}

// The host's pinned (usual) cleaner sorts ahead of every score. A pin is a
// suggestion order only; it never assigns the job (two-way assignment, 03).
function pinRank(cleanerId: string, pinned: string | null): number {
  return cleanerId === pinned ? 0 : 1;
}

export async function suggestCleanersForJob(
  stores: MatchingStores,
  flags: RankingFlags,
  args: SuggestCleanersInput & { hostId: string; hostRole: UserRole },
): Promise<{ suggestions: RankedCleaner[]; total: number }> {
  if (args.hostRole !== "host") {
    throw new MatchingError(
      "FORBIDDEN",
      "Only hosts can view cleaner suggestions.",
    );
  }
  const job = await stores.jobs.findJobById(args.jobId);
  if (job === null) throw new MatchingError("NOT_FOUND", "Job not found.");
  if (job.hostId !== args.hostId) {
    throw new MatchingError(
      "FORBIDDEN",
      "Only the job's host can view its suggestions.",
    );
  }
  if (job.status !== "open") {
    throw new MatchingError("JOB_NOT_OPEN", `Job is ${job.status}, not open.`);
  }
  const weights = resolveWeights(flags);
  const cleaners = await stores.users.listCleaners();
  const ranked: RankedCleaner[] = [];
  for (const cleaner of cleaners) {
    const availability = await stores.users.listAvailability(cleaner.id);
    const claimed = await stores.jobs.listJobsByCleaner(cleaner.id);
    const delays: number[] = [];
    for (const claimedJob of claimed) {
      const messages = await stores.messages.listMessagesByJob(claimedJob.id);
      delays.push(...replyDelaysMinutes(claimedJob, messages, cleaner.id));
    }
    const distanceKm =
      cleaner.serviceLat === null || cleaner.serviceLng === null
        ? null
        : haversineKm(
            cleaner.serviceLat,
            cleaner.serviceLng,
            job.latitude,
            job.longitude,
          );
    const breakdown: MatchBreakdown = {
      rating: scoreRating(cleaner.avgRating),
      distance: scoreDistanceKm(distanceKm, cleaner.serviceRadiusKm),
      availability: availabilityOverlapFraction(job, availability),
      completedJobs: scoreCompletedJobs(cleaner.completedJobCount),
      acceptanceRate: acceptanceRate(claimed),
      responseTime: responseTimeScore(delays),
    };
    ranked.push({
      cleaner: toPublicProfile(cleaner, availability),
      score: scoreCleaner(breakdown, weights),
      breakdown,
    });
  }
  const pinned = job.preferredCleanerId ?? null;
  ranked.sort(
    (a, b) =>
      pinRank(a.cleaner.profile.id, pinned) -
        pinRank(b.cleaner.profile.id, pinned) ||
      b.score - a.score ||
      b.cleaner.profile.completedJobCount -
        a.cleaner.profile.completedJobCount ||
      (a.cleaner.profile.id < b.cleaner.profile.id ? -1 : 1),
  );
  const total = ranked.length;
  return {
    suggestions: ranked.slice(args.offset, args.offset + args.limit),
    total,
  };
}

// Ranked board (cleaner view): every open job scored for one cleaner with the
// same weights object. Host-side signals (host trust, host acceptance, host
// responsiveness) vary per job; a cleaner with no shared history with a host
// scores neutral on response time for that host's jobs.
export async function rankJobsForCleaner(
  stores: MatchingStores,
  flags: RankingFlags,
  args: ListOpenJobsInput & { cleanerId: string; cleanerRole: UserRole },
): Promise<{ jobs: RankedJob[]; total: number }> {
  if (args.cleanerRole !== "cleaner") {
    throw new MatchingError(
      "FORBIDDEN",
      "Only cleaners can view the ranked board.",
    );
  }
  const cleaner = await stores.users.findById(args.cleanerId);
  if (cleaner === null || cleaner.role !== "cleaner") {
    throw new MatchingError("NOT_FOUND", "Cleaner not found.");
  }
  const weights = resolveWeights(flags);
  const availability = await stores.users.listAvailability(cleaner.id);
  const myClaimed = await stores.jobs.listJobsByCleaner(cleaner.id);
  const messagesByJob = new Map<string, Message[]>();
  async function messagesOf(jobId: string): Promise<Message[]> {
    const cached = messagesByJob.get(jobId);
    if (cached !== undefined) return cached;
    const found = await stores.messages.listMessagesByJob(jobId);
    messagesByJob.set(jobId, found);
    return found;
  }
  const hosts = new Map<string, { host: User; hostJobs: Job[] }>();
  async function hostOf(
    hostId: string,
  ): Promise<{ host: User; hostJobs: Job[] } | null> {
    const cached = hosts.get(hostId);
    if (cached !== undefined) return cached;
    const host = await stores.users.findById(hostId);
    if (host === null) return null;
    const entry = { host, hostJobs: await stores.jobs.listJobsByHost(hostId) };
    hosts.set(hostId, entry);
    return entry;
  }
  const filtered = filterOpenJobs(await stores.jobs.listOpenJobs(), args);
  const ranked: RankedJob[] = [];
  for (const job of filtered) {
    const entry = await hostOf(job.hostId);
    if (entry === null) continue; // orphaned job row; never surface it
    const { host, hostJobs } = entry;
    const shared = myClaimed.filter((j) => j.hostId === host.id);
    const delays: number[] = [];
    for (const past of shared) {
      delays.push(
        ...replyDelaysMinutes(past, await messagesOf(past.id), cleaner.id),
      );
    }
    const distanceKm =
      cleaner.serviceLat === null || cleaner.serviceLng === null
        ? null
        : haversineKm(
            cleaner.serviceLat,
            cleaner.serviceLng,
            job.latitude,
            job.longitude,
          );
    const breakdown: MatchBreakdown = {
      rating: scoreRating(host.avgRating),
      distance: scoreDistanceKm(distanceKm, cleaner.serviceRadiusKm),
      availability: availabilityOverlapFraction(job, availability),
      completedJobs: scoreCompletedJobs(host.completedJobCount),
      acceptanceRate: acceptanceRate(
        hostJobs.filter((j) => j.status !== "open"),
      ),
      responseTime: responseTimeScore(delays),
    };
    ranked.push({
      job,
      score: scoreCleaner(breakdown, weights),
      breakdown,
    });
  }
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      (a.job.windowStart < b.job.windowStart
        ? -1
        : a.job.windowStart > b.job.windowStart
          ? 1
          : 0) ||
      (a.job.id < b.job.id ? -1 : 1),
  );
  return {
    jobs: ranked.slice(args.offset, args.offset + args.limit),
    total: ranked.length,
  };
}
