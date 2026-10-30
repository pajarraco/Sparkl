// Framework-free business logic: no drizzle/fastify imports allowed here.
// Two-way assignment (03 D): a cleaner's "request" and a host's "offer" are
// the same row shape (JobRequest), distinguished by initiatedBy. A job
// stays open while requests are pending and reaches claimed only when the
// other side accepts — the job lifecycle itself (JOB_STATUS_TRANSITIONS)
// is unchanged.
import { randomUUID } from "node:crypto";
import {
  JOB_REQUEST_CAPS,
  type Job,
  type JobRequest,
  type OfferJobInput,
  type RequestJobInput,
  type SparklErrorCode,
  type UserRole,
} from "@sparkl/shared";
import type { Clock, JobsStore } from "./jobs.js";
import type { UsersStore } from "./users.js";

export class JobRequestsError extends Error {
  readonly code: SparklErrorCode;

  constructor(code: SparklErrorCode, message: string) {
    super(message);
    this.name = "JobRequestsError";
    this.code = code;
  }
}

export interface JobRequestsStore {
  insertRequest(request: JobRequest): Promise<JobRequest>;
  findRequestById(id: string): Promise<JobRequest | null>;
  /** The pending row for this (job, cleaner) pair, if any — at most one. */
  findPendingByJobAndCleaner(
    jobId: string,
    cleanerId: string,
  ): Promise<JobRequest | null>;
  listByJob(jobId: string): Promise<JobRequest[]>;
  listByCleaner(cleanerId: string): Promise<JobRequest[]>;
  countPendingOffersForJob(jobId: string): Promise<number>;
  countPendingRequestsForCleaner(cleanerId: string): Promise<number>;
  /**
   * Accept a pending request/offer atomically: re-check the job is open
   * and the request is pending inside one transaction, set the job to
   * claimed with this cleaner, mark this request accepted, and close
   * every other pending request on the job. Throws JOB_ALREADY_CLAIMED /
   * JOB_NOT_OPEN / JOB_REQUEST_NOT_PENDING when the race is lost.
   */
  acceptRequest(args: {
    requestId: string;
    jobId: string;
    cleanerId: string;
    nowIso: string;
  }): Promise<{ job: Job; request: JobRequest }>;
  updateStatus(args: {
    requestId: string;
    status: "declined" | "withdrawn";
    respondedAt: string;
  }): Promise<JobRequest | null>;
  /** Closes every pending request on a job (e.g. the job was cancelled). */
  closeAllPendingForJob(jobId: string): Promise<void>;
}

export interface JobRequestsStores {
  jobs: Pick<JobsStore, "findJobById">;
  users: Pick<UsersStore, "findById">;
  requests: JobRequestsStore;
}

async function requireJob(
  stores: Pick<JobRequestsStores, "jobs">,
  jobId: string,
): Promise<Job> {
  const job = await stores.jobs.findJobById(jobId);
  if (job === null) throw new JobRequestsError("NOT_FOUND", "Job not found.");
  return job;
}

async function requireRequest(
  stores: Pick<JobRequestsStores, "requests">,
  requestId: string,
): Promise<JobRequest> {
  const request = await stores.requests.findRequestById(requestId);
  if (request === null)
    throw new JobRequestsError("NOT_FOUND", "Request not found.");
  return request;
}

// The counterpart's existing pending row, if any, lets requestJob/offerJob
// resolve mutual interest by accepting it instead of adding a second row
// for the same (job, cleaner) pair.
async function acceptExisting(
  stores: JobRequestsStores,
  clock: Clock,
  existing: JobRequest,
  job: Job,
): Promise<JobRequest> {
  if (job.status !== "open") {
    throw new JobRequestsError(
      "JOB_NOT_OPEN",
      `Job is ${job.status}, not open.`,
    );
  }
  const { request } = await stores.requests.acceptRequest({
    requestId: existing.id,
    jobId: job.id,
    cleanerId: existing.cleanerId,
    nowIso: clock.nowIso(),
  });
  return request;
}

export async function requestJob(
  stores: JobRequestsStores,
  clock: Clock,
  args: RequestJobInput & { cleanerId: string; cleanerRole: UserRole },
): Promise<JobRequest> {
  if (args.cleanerRole !== "cleaner") {
    throw new JobRequestsError("FORBIDDEN", "Only cleaners can request jobs.");
  }
  const job = await requireJob(stores, args.jobId);
  if (job.hostId === args.cleanerId) {
    throw new JobRequestsError("FORBIDDEN", "You cannot request your own job.");
  }
  if (job.status !== "open") {
    throw new JobRequestsError(
      "JOB_NOT_OPEN",
      `Job is ${job.status}, not open.`,
    );
  }
  const existing = await stores.requests.findPendingByJobAndCleaner(
    args.jobId,
    args.cleanerId,
  );
  if (existing !== null) {
    if (existing.initiatedBy === "host") {
      // The host already offered this job to the caller: requesting it
      // is the same as accepting that offer.
      return acceptExisting(stores, clock, existing, job);
    }
    throw new JobRequestsError(
      "JOB_REQUEST_EXISTS",
      "You already requested this job.",
    );
  }
  const pendingCount = await stores.requests.countPendingRequestsForCleaner(
    args.cleanerId,
  );
  if (pendingCount >= JOB_REQUEST_CAPS.MAX_PENDING_REQUESTS_PER_CLEANER) {
    throw new JobRequestsError(
      "REQUEST_CAP_REACHED",
      "You have too many pending requests. Withdraw one first.",
    );
  }
  return stores.requests.insertRequest({
    id: randomUUID(),
    jobId: args.jobId,
    cleanerId: args.cleanerId,
    initiatedBy: "cleaner",
    status: "pending",
    createdAt: clock.nowIso(),
    respondedAt: null,
  });
}

export async function offerJob(
  stores: JobRequestsStores,
  clock: Clock,
  args: OfferJobInput & { hostId: string; hostRole: UserRole },
): Promise<JobRequest> {
  if (args.hostRole !== "host") {
    throw new JobRequestsError("FORBIDDEN", "Only hosts can offer jobs.");
  }
  const job = await requireJob(stores, args.jobId);
  if (job.hostId !== args.hostId) {
    throw new JobRequestsError(
      "FORBIDDEN",
      "Only the job's host can offer it.",
    );
  }
  if (job.status !== "open") {
    throw new JobRequestsError(
      "JOB_NOT_OPEN",
      `Job is ${job.status}, not open.`,
    );
  }
  const cleaner = await stores.users.findById(args.cleanerId);
  if (cleaner === null || cleaner.role !== "cleaner") {
    throw new JobRequestsError("NOT_FOUND", "Cleaner not found.");
  }
  const existing = await stores.requests.findPendingByJobAndCleaner(
    args.jobId,
    args.cleanerId,
  );
  if (existing !== null) {
    if (existing.initiatedBy === "cleaner") {
      // The cleaner already requested this job: offering it is the same
      // as accepting that request.
      return acceptExisting(stores, clock, existing, job);
    }
    throw new JobRequestsError(
      "JOB_REQUEST_EXISTS",
      "You already offered this job to that cleaner.",
    );
  }
  const pendingOffers = await stores.requests.countPendingOffersForJob(
    args.jobId,
  );
  if (pendingOffers >= JOB_REQUEST_CAPS.MAX_PENDING_OFFERS_PER_JOB) {
    throw new JobRequestsError(
      "OFFER_CAP_REACHED",
      "This job already has the maximum number of pending offers.",
    );
  }
  return stores.requests.insertRequest({
    id: randomUUID(),
    jobId: args.jobId,
    cleanerId: args.cleanerId,
    initiatedBy: "host",
    status: "pending",
    createdAt: clock.nowIso(),
    respondedAt: null,
  });
}

// Only the side that did NOT initiate the row may accept it: the host
// accepts a cleaner's request, the offered cleaner accepts a host's offer.
function assertCanAccept(request: JobRequest, job: Job, actorId: string): void {
  const authorized =
    request.initiatedBy === "cleaner"
      ? actorId === job.hostId
      : actorId === request.cleanerId;
  if (!authorized) {
    throw new JobRequestsError(
      "NOT_REQUEST_PARTY",
      "Only the other party can accept this.",
    );
  }
}

// Decline is symmetric with accept: the same side that could have
// accepted can decline instead.
function assertCanDecline(
  request: JobRequest,
  job: Job,
  actorId: string,
): void {
  assertCanAccept(request, job, actorId);
}

export async function acceptJobRequest(
  stores: JobRequestsStores,
  clock: Clock,
  args: { requestId: string; actorId: string; actorRole: UserRole },
): Promise<{ job: Job; request: JobRequest }> {
  const request = await requireRequest(stores, args.requestId);
  const job = await requireJob(stores, request.jobId);
  assertCanAccept(request, job, args.actorId);
  if (request.status !== "pending") {
    throw new JobRequestsError(
      "JOB_REQUEST_NOT_PENDING",
      `Request is ${request.status}, not pending.`,
    );
  }
  if (job.status !== "open") {
    throw new JobRequestsError(
      "JOB_NOT_OPEN",
      `Job is ${job.status}, not open.`,
    );
  }
  // Race resolved in the store: acceptRequest re-checks job/request state
  // inside its transaction, so a losing concurrent accept throws there.
  return stores.requests.acceptRequest({
    requestId: request.id,
    jobId: job.id,
    cleanerId: request.cleanerId,
    nowIso: clock.nowIso(),
  });
}

export async function declineJobRequest(
  stores: JobRequestsStores,
  clock: Clock,
  args: { requestId: string; actorId: string; actorRole: UserRole },
): Promise<JobRequest> {
  const request = await requireRequest(stores, args.requestId);
  const job = await requireJob(stores, request.jobId);
  assertCanDecline(request, job, args.actorId);
  if (request.status !== "pending") {
    throw new JobRequestsError(
      "JOB_REQUEST_NOT_PENDING",
      `Request is ${request.status}, not pending.`,
    );
  }
  const updated = await stores.requests.updateStatus({
    requestId: request.id,
    status: "declined",
    respondedAt: clock.nowIso(),
  });
  if (updated === null) {
    throw new JobRequestsError("NOT_FOUND", "Request not found.");
  }
  return updated;
}

export async function withdrawJobRequest(
  stores: JobRequestsStores,
  clock: Clock,
  args: { requestId: string; actorId: string; actorRole: UserRole },
): Promise<JobRequest> {
  const request = await requireRequest(stores, args.requestId);
  const job = await requireJob(stores, request.jobId);
  const isInitiator =
    request.initiatedBy === "cleaner"
      ? args.actorId === request.cleanerId
      : args.actorId === job.hostId;
  if (!isInitiator) {
    throw new JobRequestsError(
      "NOT_REQUEST_PARTY",
      "Only the one who sent this can withdraw it.",
    );
  }
  if (request.status !== "pending") {
    throw new JobRequestsError(
      "JOB_REQUEST_NOT_PENDING",
      `Request is ${request.status}, not pending.`,
    );
  }
  const updated = await stores.requests.updateStatus({
    requestId: request.id,
    status: "withdrawn",
    respondedAt: clock.nowIso(),
  });
  if (updated === null) {
    throw new JobRequestsError("NOT_FOUND", "Request not found.");
  }
  return updated;
}

export interface RequestCleanerSummary {
  id: string;
  name: string;
  photoUrl: string | null;
  avgRating: number | null;
  completedJobCount: number;
}

export async function listRequestsForJob(
  stores: Pick<JobRequestsStores, "jobs" | "requests" | "users">,
  args: { jobId: string; hostId: string },
): Promise<Array<{ request: JobRequest; cleaner: RequestCleanerSummary }>> {
  const job = await requireJob(stores, args.jobId);
  if (job.hostId !== args.hostId) {
    throw new JobRequestsError(
      "FORBIDDEN",
      "Only the job's host can list its requests.",
    );
  }
  const all = (await stores.requests.listByJob(args.jobId)).filter(
    (r) => r.status === "pending",
  );
  all.sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
  const cleaners = new Map(
    await Promise.all(
      [...new Set(all.map((r) => r.cleanerId))].map(
        async (id) => [id, await stores.users.findById(id)] as const,
      ),
    ),
  );
  return all.flatMap((request) => {
    const cleaner = cleaners.get(request.cleanerId);
    if (cleaner === null || cleaner === undefined) return [];
    return [
      {
        request,
        cleaner: {
          id: cleaner.id,
          name: cleaner.name,
          photoUrl: cleaner.photoUrl,
          avgRating: cleaner.avgRating,
          completedJobCount: cleaner.completedJobCount,
        },
      },
    ];
  });
}

export async function listMyJobRequests(
  stores: Pick<JobRequestsStores, "jobs" | "requests">,
  args: { cleanerId: string; cleanerRole: UserRole },
): Promise<Array<{ request: JobRequest; job: Job }>> {
  if (args.cleanerRole !== "cleaner") {
    throw new JobRequestsError(
      "FORBIDDEN",
      "Only cleaners have their own requests.",
    );
  }
  const all = (await stores.requests.listByCleaner(args.cleanerId)).filter(
    (r) => r.status === "pending",
  );
  const jobsById = new Map(
    await Promise.all(
      [...new Set(all.map((r) => r.jobId))].map(
        async (id) => [id, await stores.jobs.findJobById(id)] as const,
      ),
    ),
  );
  const withJobs = all.flatMap((request) => {
    const job = jobsById.get(request.jobId);
    if (job === null || job === undefined) return [];
    return [{ request, job }];
  });
  withJobs.sort((a, b) =>
    a.request.createdAt < b.request.createdAt
      ? 1
      : a.request.createdAt > b.request.createdAt
        ? -1
        : 0,
  );
  return withJobs;
}

// Called by the jobs router after a job is cancelled, so no pending
// request or offer survives a job that will never be claimed.
export async function closePendingForCancelledJob(
  stores: Pick<JobRequestsStores, "requests">,
  jobId: string,
): Promise<void> {
  await stores.requests.closeAllPendingForJob(jobId);
}
