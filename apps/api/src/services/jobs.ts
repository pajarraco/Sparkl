// Framework-free business logic: no drizzle/fastify imports allowed here.
// Persistence only goes through the narrow JobsStore port, implemented by
// the db adapter (which owns the claim transaction SQL).
import { randomUUID } from "node:crypto";
import { JOB_STATUS_TRANSITIONS } from "@sparkl/shared";
import type {
  CancelJobInput,
  ClaimJobInput,
  CreateJobInput,
  Job,
  JobStatus,
  ListOpenJobsInput,
  MyJobsInput,
  SparklErrorCode,
  TransitionJobInput,
  UserRole,
} from "@sparkl/shared";
import type { UsersStore } from "./users.js";

export class JobsServiceError extends Error {
  readonly code: SparklErrorCode;

  constructor(code: SparklErrorCode, message: string) {
    super(message);
    this.name = "JobsServiceError";
    this.code = code;
  }
}

export interface JobsStore {
  insertJob(job: Job): Promise<Job>;
  findJobById(jobId: string): Promise<Job | null>;
  listOpenJobs(): Promise<Job[]>;
  listJobsByHost(hostId: string): Promise<Job[]>;
  listJobsByCleaner(cleanerId: string): Promise<Job[]>;
  /**
   * Atomically claim an open job. MUST re-check `status = open` inside a
   * single transaction so exactly one concurrent claim wins. Throws
   * JOB_ALREADY_CLAIMED when the job is already claimed, JOB_NOT_OPEN when
   * it left the open state another way.
   */
  claimIfOpen(jobId: string, cleanerId: string, nowIso: string): Promise<Job>;
  saveJob(job: Job): Promise<Job>;
}

export interface Clock {
  nowIso(): string;
}

async function requireJob(store: JobsStore, jobId: string): Promise<Job> {
  const job = await store.findJobById(jobId);
  if (job === null) throw new JobsServiceError("NOT_FOUND", "Job not found.");
  return job;
}

export async function createJob(
  store: JobsStore,
  clock: Clock,
  args: { hostId: string; hostRole: UserRole; input: CreateJobInput },
): Promise<Job> {
  if (args.hostRole !== "host") {
    throw new JobsServiceError("FORBIDDEN", "Only hosts can post jobs.");
  }
  if (args.input.windowEnd <= args.input.windowStart) {
    throw new JobsServiceError(
      "VALIDATION_ERROR",
      "windowEnd must be after windowStart.",
    );
  }
  const now = clock.nowIso();
  return store.insertJob({
    id: randomUUID(),
    hostId: args.hostId,
    address: args.input.address,
    latitude: args.input.latitude,
    longitude: args.input.longitude,
    windowStart: args.input.windowStart,
    windowEnd: args.input.windowEnd,
    sizeSqm: args.input.sizeSqm ?? null,
    notes: args.input.notes ?? null,
    priceMinorUnits: args.input.priceMinorUnits,
    status: "open",
    claimedByCleanerId: null,
    createdAt: now,
    updatedAt: now,
  });
}

export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}

// Pure filter shared by listOpenJobs (newest-first board) and the ranked
// board: date, price, and distance predicates only — no sorting, no paging.
export function filterOpenJobs(all: Job[], filters: ListOpenJobsInput): Job[] {
  return all.filter((job) => {
    if (job.status !== "open") return false;
    if (filters.dateFrom !== undefined && job.windowStart < filters.dateFrom)
      return false;
    if (filters.dateTo !== undefined && job.windowStart > filters.dateTo)
      return false;
    if (
      filters.minPriceMinorUnits !== undefined &&
      job.priceMinorUnits < filters.minPriceMinorUnits
    ) {
      return false;
    }
    if (
      filters.maxPriceMinorUnits !== undefined &&
      job.priceMinorUnits > filters.maxPriceMinorUnits
    ) {
      return false;
    }
    if (
      filters.centerLat !== undefined &&
      filters.centerLng !== undefined &&
      filters.maxDistanceKm !== undefined &&
      haversineKm(
        filters.centerLat,
        filters.centerLng,
        job.latitude,
        job.longitude,
      ) > filters.maxDistanceKm
    ) {
      return false;
    }
    return true;
  });
}

export async function listOpenJobs(
  store: JobsStore,
  filters: ListOpenJobsInput,
): Promise<Job[]> {
  const kept = filterOpenJobs(await store.listOpenJobs(), filters);
  kept.sort((a, b) =>
    a.windowStart < b.windowStart ? -1 : a.windowStart > b.windowStart ? 1 : 0,
  );
  return kept.slice(filters.offset, filters.offset + filters.limit);
}

export async function listMyJobs(
  store: JobsStore,
  args: { hostId: string; input: MyJobsInput },
): Promise<Job[]> {
  const jobs = await store.listJobsByHost(args.hostId);
  const kept =
    args.input.status === undefined
      ? [...jobs]
      : jobs.filter((job) => job.status === args.input.status);
  kept.sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
  return kept.slice(args.input.offset, args.input.offset + args.input.limit);
}

export async function claimJob(
  store: JobsStore,
  clock: Clock,
  args: ClaimJobInput & { cleanerId: string; cleanerRole: UserRole },
): Promise<Job> {
  if (args.cleanerRole !== "cleaner") {
    throw new JobsServiceError("FORBIDDEN", "Only cleaners can claim jobs.");
  }
  const job = await requireJob(store, args.jobId);
  if (job.hostId === args.cleanerId) {
    throw new JobsServiceError("FORBIDDEN", "You cannot claim your own job.");
  }
  if (job.status === "claimed") {
    throw new JobsServiceError(
      "JOB_ALREADY_CLAIMED",
      "Job was already claimed.",
    );
  }
  if (job.status !== "open") {
    throw new JobsServiceError(
      "JOB_NOT_OPEN",
      `Job is ${job.status}, not open.`,
    );
  }
  // Race resolved here: claimIfOpen re-checks status inside its transaction,
  // so the loser fails with JOB_ALREADY_CLAIMED / JOB_NOT_OPEN.
  return store.claimIfOpen(args.jobId, args.cleanerId, clock.nowIso());
}

function checkTransitionActor(
  job: Job,
  actorId: string,
  toStatus: JobStatus,
): void {
  if (toStatus === "in_progress" && actorId !== job.claimedByCleanerId) {
    throw new JobsServiceError(
      "FORBIDDEN",
      "Only the claiming cleaner can start the job.",
    );
  }
  if (
    (toStatus === "completed" || toStatus === "cancelled") &&
    actorId !== job.hostId
  ) {
    throw new JobsServiceError(
      "FORBIDDEN",
      `Only the host can move a job to ${toStatus}.`,
    );
  }
}

export async function transitionJob(
  store: JobsStore,
  clock: Clock,
  args: TransitionJobInput & { actorId: string; actorRole: UserRole },
  users: Pick<UsersStore, "incrementCompletedJobs">,
): Promise<Job> {
  void args.actorRole;
  const job = await requireJob(store, args.jobId);
  if (args.actorId !== job.hostId && args.actorId !== job.claimedByCleanerId) {
    throw new JobsServiceError(
      "NOT_JOB_PARTY",
      "Only a party to the job can change its status.",
    );
  }
  if (args.toStatus === "claimed") {
    throw new JobsServiceError(
      "INVALID_TRANSITION",
      "Claim a job with claimJob, not transitionJob.",
    );
  }
  if (!JOB_STATUS_TRANSITIONS[job.status].includes(args.toStatus)) {
    throw new JobsServiceError(
      "INVALID_TRANSITION",
      `Cannot move job from ${job.status} to ${args.toStatus}.`,
    );
  }
  checkTransitionActor(job, args.actorId, args.toStatus);
  const saved = await store.saveJob({
    ...job,
    status: args.toStatus,
    updatedAt: clock.nowIso(),
  });
  if (args.toStatus === "completed") {
    // completed and cancelled are terminal (see JOB_STATUS_TRANSITIONS), so
    // this fires exactly once per job: both parties earn a completed job,
    // feeding the ranking's completed-jobs signal.
    const earners = [saved.hostId, saved.claimedByCleanerId].filter(
      (id): id is string => id !== null,
    );
    for (const userId of earners) {
      const updated = await users.incrementCompletedJobs(userId);
      if (updated === null) {
        throw new JobsServiceError("NOT_FOUND", "Job party not found.");
      }
    }
  }
  return saved;
}

export async function cancelJob(
  store: JobsStore,
  clock: Clock,
  args: CancelJobInput & { actorId: string; actorRole: UserRole },
  users: Pick<UsersStore, "incrementCompletedJobs">,
): Promise<Job> {
  // Host-only by construction: transitionJob rejects non-host cancellers
  // (cleaner party -> FORBIDDEN, stranger -> NOT_JOB_PARTY) and rejects
  // terminal states via JOB_STATUS_TRANSITIONS.
  return transitionJob(store, clock, { ...args, toStatus: "cancelled" }, users);
}
