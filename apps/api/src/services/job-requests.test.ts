import type { Job, JobRequest, User } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  JobRequestsError,
  type JobRequestsStore,
  type JobRequestsStores,
  acceptJobRequest,
  closePendingForCancelledJob,
  declineJobRequest,
  listMyJobRequests,
  listRequestsForJob,
  offerJob,
  requestJob,
  withdrawJobRequest,
} from "./job-requests.js";
import type { Clock, JobsStore } from "./jobs.js";
import type { UsersStore } from "./users.js";

const HOST = "11111111-1111-4111-8111-111111111111";
const CLEANER = "22222222-2222-4222-8222-222222222222";
const OTHER_CLEANER = "33333333-3333-4333-8333-333333333333";
const STRANGER = "44444444-4444-4444-8444-444444444444";

const clock: Clock = { nowIso: () => "2026-01-01T10:00:00.000Z" };

let seq = 0;
function uid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: uid(),
    hostId: HOST,
    address: "Calle Falsa 123",
    latitude: 40.4168,
    longitude: -3.7038,
    windowStart: "2026-02-01T10:00:00.000Z",
    windowEnd: "2026-02-01T12:00:00.000Z",
    sizeSqm: 80,
    notes: null,
    priceMinorUnits: 5000,
    status: "open",
    claimedByCleanerId: null,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: CLEANER,
    role: "cleaner",
    name: "Ada Cleaner",
    photoUrl: null,
    serviceLat: null,
    serviceLng: null,
    serviceRadiusKm: null,
    avgRating: 4.8,
    completedJobCount: 12,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// In-memory fake mirroring the real drizzleJobRequestsStore transaction:
// acceptRequest re-checks job/request state before mutating either.
function makeFakes(
  jobs: Job[],
  users: User[] = [],
): {
  stores: JobRequestsStores;
  jobs: Map<string, Job>;
  requests: Map<string, JobRequest>;
} {
  const jobsById = new Map(jobs.map((j) => [j.id, { ...j }]));
  const usersById = new Map(users.map((u) => [u.id, { ...u }]));
  const requestsById = new Map<string, JobRequest>();

  const jobsStore: Pick<JobsStore, "findJobById"> = {
    findJobById: async (jobId) =>
      jobsById.has(jobId) ? { ...(jobsById.get(jobId) as Job) } : null,
  };
  const usersStore: Pick<UsersStore, "findById"> = {
    findById: async (id) =>
      usersById.has(id) ? { ...(usersById.get(id) as User) } : null,
  };
  const requestsStore: JobRequestsStore = {
    async insertRequest(request) {
      requestsById.set(request.id, { ...request });
      return { ...request };
    },
    async findRequestById(id) {
      const r = requestsById.get(id);
      return r ? { ...r } : null;
    },
    async findPendingByJobAndCleaner(jobId, cleanerId) {
      for (const r of requestsById.values()) {
        if (
          r.jobId === jobId &&
          r.cleanerId === cleanerId &&
          r.status === "pending"
        ) {
          return { ...r };
        }
      }
      return null;
    },
    async listByJob(jobId) {
      return [...requestsById.values()]
        .filter((r) => r.jobId === jobId)
        .map((r) => ({ ...r }));
    },
    async listByCleaner(cleanerId) {
      return [...requestsById.values()]
        .filter((r) => r.cleanerId === cleanerId)
        .map((r) => ({ ...r }));
    },
    async countPendingOffersForJob(jobId) {
      return [...requestsById.values()].filter(
        (r) =>
          r.jobId === jobId &&
          r.initiatedBy === "host" &&
          r.status === "pending",
      ).length;
    },
    async countPendingRequestsForCleaner(cleanerId) {
      return [...requestsById.values()].filter(
        (r) =>
          r.cleanerId === cleanerId &&
          r.initiatedBy === "cleaner" &&
          r.status === "pending",
      ).length;
    },
    async acceptRequest({ requestId, jobId, cleanerId, nowIso }) {
      const job = jobsById.get(jobId);
      const request = requestsById.get(requestId);
      if (!job) throw new JobRequestsError("NOT_FOUND", "Job not found.");
      if (job.status !== "open") {
        throw new JobRequestsError(
          "JOB_ALREADY_CLAIMED",
          "Job was already claimed.",
        );
      }
      if (!request || request.status !== "pending") {
        throw new JobRequestsError(
          "JOB_REQUEST_NOT_PENDING",
          "Request is no longer pending.",
        );
      }
      const claimed: Job = {
        ...job,
        status: "claimed",
        claimedByCleanerId: cleanerId,
        updatedAt: nowIso,
      };
      jobsById.set(jobId, claimed);
      const accepted: JobRequest = {
        ...request,
        status: "accepted",
        respondedAt: nowIso,
      };
      requestsById.set(requestId, accepted);
      for (const r of requestsById.values()) {
        if (r.jobId === jobId && r.status === "pending") {
          requestsById.set(r.id, {
            ...r,
            status: "closed",
            respondedAt: nowIso,
          });
        }
      }
      return { job: claimed, request: accepted };
    },
    async updateStatus({ requestId, status, respondedAt }) {
      const r = requestsById.get(requestId);
      if (!r || r.status !== "pending") return null;
      const updated: JobRequest = { ...r, status, respondedAt };
      requestsById.set(requestId, updated);
      return { ...updated };
    },
    async closeAllPendingForJob(jobId) {
      for (const r of requestsById.values()) {
        if (r.jobId === jobId && r.status === "pending") {
          requestsById.set(r.id, {
            ...r,
            status: "closed",
            respondedAt: clock.nowIso(),
          });
        }
      }
    },
  };

  return {
    stores: { jobs: jobsStore, users: usersStore, requests: requestsStore },
    jobs: jobsById,
    requests: requestsById,
  };
}

async function captureCode(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (err) {
    expect(err).toBeInstanceOf(JobRequestsError);
    return (err as JobRequestsError).code;
  }
}

describe("job-requests service", () => {
  it("a cleaner can request an open job, and a stranger/host cannot", async () => {
    const job = makeJob();
    const { stores } = makeFakes([job]);
    const request = await requestJob(stores, clock, {
      jobId: job.id,
      cleanerId: CLEANER,
      cleanerRole: "cleaner",
    });
    expect(request.initiatedBy).toBe("cleaner");
    expect(request.status).toBe("pending");

    expect(
      await captureCode(
        requestJob(stores, clock, {
          jobId: job.id,
          cleanerId: HOST,
          cleanerRole: "host",
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("rejects requesting a job that is not open", async () => {
    const job = makeJob({
      status: "claimed",
      claimedByCleanerId: OTHER_CLEANER,
    });
    const { stores } = makeFakes([job]);
    expect(
      await captureCode(
        requestJob(stores, clock, {
          jobId: job.id,
          cleanerId: CLEANER,
          cleanerRole: "cleaner",
        }),
      ),
    ).toBe("JOB_NOT_OPEN");
  });

  it("a duplicate request is rejected, but the request cap is enforced before that", async () => {
    const job = makeJob();
    const { stores } = makeFakes([job]);
    await requestJob(stores, clock, {
      jobId: job.id,
      cleanerId: CLEANER,
      cleanerRole: "cleaner",
    });
    expect(
      await captureCode(
        requestJob(stores, clock, {
          jobId: job.id,
          cleanerId: CLEANER,
          cleanerRole: "cleaner",
        }),
      ),
    ).toBe("JOB_REQUEST_EXISTS");
  });

  it("enforces the per-cleaner pending-request cap", async () => {
    const jobs = Array.from({ length: 11 }, () => makeJob());
    const { stores } = makeFakes(jobs);
    for (const job of jobs.slice(0, 10)) {
      await requestJob(stores, clock, {
        jobId: job.id,
        cleanerId: CLEANER,
        cleanerRole: "cleaner",
      });
    }
    const lastJob = jobs[10] as Job;
    expect(
      await captureCode(
        requestJob(stores, clock, {
          jobId: lastJob.id,
          cleanerId: CLEANER,
          cleanerRole: "cleaner",
        }),
      ),
    ).toBe("REQUEST_CAP_REACHED");
  });

  it("a host can offer an open job to a known cleaner, enforcing the role, ownership and cap", async () => {
    const job = makeJob();
    const cleaner = makeUser();
    const { stores } = makeFakes([job], [cleaner]);
    const offer = await offerJob(stores, clock, {
      jobId: job.id,
      cleanerId: cleaner.id,
      hostId: HOST,
      hostRole: "host",
    });
    expect(offer.initiatedBy).toBe("host");

    expect(
      await captureCode(
        offerJob(stores, clock, {
          jobId: job.id,
          cleanerId: cleaner.id,
          hostId: HOST,
          hostRole: "cleaner",
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await captureCode(
        offerJob(stores, clock, {
          jobId: job.id,
          cleanerId: cleaner.id,
          hostId: STRANGER,
          hostRole: "host",
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await captureCode(
        offerJob(stores, clock, {
          jobId: job.id,
          cleanerId: STRANGER,
          hostId: HOST,
          hostRole: "host",
        }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("enforces the per-job pending-offer cap", async () => {
    const job = makeJob();
    const cleaners = Array.from({ length: 4 }, (_, i) =>
      makeUser({ id: `cleaner-${i}` }),
    );
    const { stores } = makeFakes([job], cleaners);
    for (const cleaner of cleaners.slice(0, 3)) {
      await offerJob(stores, clock, {
        jobId: job.id,
        cleanerId: cleaner.id,
        hostId: HOST,
        hostRole: "host",
      });
    }
    expect(
      await captureCode(
        offerJob(stores, clock, {
          jobId: job.id,
          cleanerId: cleaners[3]?.id as string,
          hostId: HOST,
          hostRole: "host",
        }),
      ),
    ).toBe("OFFER_CAP_REACHED");
  });

  it("mutual interest: a cleaner requesting a job they were already offered accepts it instead of adding a row", async () => {
    const job = makeJob();
    const cleaner = makeUser();
    const { stores, requests } = makeFakes([job], [cleaner]);
    const offer = await offerJob(stores, clock, {
      jobId: job.id,
      cleanerId: cleaner.id,
      hostId: HOST,
      hostRole: "host",
    });
    const result = await requestJob(stores, clock, {
      jobId: job.id,
      cleanerId: cleaner.id,
      cleanerRole: "cleaner",
    });
    expect(result.id).toBe(offer.id);
    expect(result.status).toBe("accepted");
    expect(requests.size).toBe(1);
  });

  it("mutual interest: a host offering a job a cleaner already requested accepts it instead of adding a row", async () => {
    const job = makeJob();
    const cleaner = makeUser();
    const { stores, requests } = makeFakes([job], [cleaner]);
    const req = await requestJob(stores, clock, {
      jobId: job.id,
      cleanerId: cleaner.id,
      cleanerRole: "cleaner",
    });
    const result = await offerJob(stores, clock, {
      jobId: job.id,
      cleanerId: cleaner.id,
      hostId: HOST,
      hostRole: "host",
    });
    expect(result.id).toBe(req.id);
    expect(result.status).toBe("accepted");
    expect(requests.size).toBe(1);
  });

  it("accept: the host accepts a cleaner's request, claims the job, and closes every other pending row", async () => {
    const job = makeJob();
    const cleaner = makeUser({ id: CLEANER });
    const other = makeUser({ id: OTHER_CLEANER });
    const { stores, jobs } = makeFakes([job], [cleaner, other]);
    const request = await requestJob(stores, clock, {
      jobId: job.id,
      cleanerId: CLEANER,
      cleanerRole: "cleaner",
    });
    const otherOffer = await offerJob(stores, clock, {
      jobId: job.id,
      cleanerId: OTHER_CLEANER,
      hostId: HOST,
      hostRole: "host",
    });

    const { job: claimedJob, request: accepted } = await acceptJobRequest(
      stores,
      clock,
      {
        requestId: request.id,
        actorId: HOST,
        actorRole: "host",
      },
    );
    expect(claimedJob.status).toBe("claimed");
    expect(claimedJob.claimedByCleanerId).toBe(CLEANER);
    expect(accepted.status).toBe("accepted");
    expect(jobs.get(job.id)?.status).toBe("claimed");

    const closedOffer = await stores.requests.findRequestById(otherOffer.id);
    expect(closedOffer?.status).toBe("closed");
  });

  it("accept: only the other side can accept — a cleaner cannot accept their own request, a stranger cannot accept an offer", async () => {
    const requestJobFixture = makeJob();
    const cleaner = makeUser({ id: CLEANER });
    const { stores: requestStores } = makeFakes([requestJobFixture], [cleaner]);
    const request = await requestJob(requestStores, clock, {
      jobId: requestJobFixture.id,
      cleanerId: CLEANER,
      cleanerRole: "cleaner",
    });
    expect(
      await captureCode(
        acceptJobRequest(requestStores, clock, {
          requestId: request.id,
          actorId: CLEANER,
          actorRole: "cleaner",
        }),
      ),
    ).toBe("NOT_REQUEST_PARTY");

    const offerJobFixture = makeJob();
    const { stores: offerStores } = makeFakes([offerJobFixture], [cleaner]);
    const offer = await offerJob(offerStores, clock, {
      jobId: offerJobFixture.id,
      cleanerId: CLEANER,
      hostId: HOST,
      hostRole: "host",
    });
    expect(
      await captureCode(
        acceptJobRequest(offerStores, clock, {
          requestId: offer.id,
          actorId: STRANGER,
          actorRole: "cleaner",
        }),
      ),
    ).toBe("NOT_REQUEST_PARTY");
  });

  it("accept loses the race when another request already claimed the job", async () => {
    const job = makeJob();
    const a = makeUser({ id: CLEANER });
    const b = makeUser({ id: OTHER_CLEANER });
    const { stores } = makeFakes([job], [a, b]);
    const reqA = await requestJob(stores, clock, {
      jobId: job.id,
      cleanerId: CLEANER,
      cleanerRole: "cleaner",
    });
    const reqB = await requestJob(stores, clock, {
      jobId: job.id,
      cleanerId: OTHER_CLEANER,
      cleanerRole: "cleaner",
    });
    await acceptJobRequest(stores, clock, {
      requestId: reqA.id,
      actorId: HOST,
      actorRole: "host",
    });
    expect(
      await captureCode(
        acceptJobRequest(stores, clock, {
          requestId: reqB.id,
          actorId: HOST,
          actorRole: "host",
        }),
      ),
    ).toBe("JOB_REQUEST_NOT_PENDING");
  });

  it("decline: the other side declines, and it cannot be accepted afterwards", async () => {
    const job = makeJob();
    const cleaner = makeUser();
    const { stores } = makeFakes([job], [cleaner]);
    const request = await requestJob(stores, clock, {
      jobId: job.id,
      cleanerId: CLEANER,
      cleanerRole: "cleaner",
    });
    const declined = await declineJobRequest(stores, clock, {
      requestId: request.id,
      actorId: HOST,
      actorRole: "host",
    });
    expect(declined.status).toBe("declined");
    expect(
      await captureCode(
        acceptJobRequest(stores, clock, {
          requestId: request.id,
          actorId: HOST,
          actorRole: "host",
        }),
      ),
    ).toBe("JOB_REQUEST_NOT_PENDING");
  });

  it("withdraw: only the initiator can withdraw their own pending row", async () => {
    const job = makeJob();
    const cleaner = makeUser();
    const { stores } = makeFakes([job], [cleaner]);
    const request = await requestJob(stores, clock, {
      jobId: job.id,
      cleanerId: CLEANER,
      cleanerRole: "cleaner",
    });
    expect(
      await captureCode(
        withdrawJobRequest(stores, clock, {
          requestId: request.id,
          actorId: HOST,
          actorRole: "host",
        }),
      ),
    ).toBe("NOT_REQUEST_PARTY");
    const withdrawn = await withdrawJobRequest(stores, clock, {
      requestId: request.id,
      actorId: CLEANER,
      actorRole: "cleaner",
    });
    expect(withdrawn.status).toBe("withdrawn");
  });

  it("withdraw: only the offering host can withdraw their own offer", async () => {
    const job = makeJob();
    const cleaner = makeUser();
    const { stores } = makeFakes([job], [cleaner]);
    const offer = await offerJob(stores, clock, {
      jobId: job.id,
      cleanerId: CLEANER,
      hostId: HOST,
      hostRole: "host",
    });
    expect(
      await captureCode(
        withdrawJobRequest(stores, clock, {
          requestId: offer.id,
          actorId: CLEANER,
          actorRole: "cleaner",
        }),
      ),
    ).toBe("NOT_REQUEST_PARTY");
    const withdrawn = await withdrawJobRequest(stores, clock, {
      requestId: offer.id,
      actorId: HOST,
      actorRole: "host",
    });
    expect(withdrawn.status).toBe("withdrawn");
  });

  it("listRequestsForJob: only the job's host sees pending rows, each with the cleaner summary", async () => {
    const job = makeJob();
    const cleaner = makeUser({ id: CLEANER, name: "Ada" });
    const { stores } = makeFakes([job], [cleaner]);
    await requestJob(stores, clock, {
      jobId: job.id,
      cleanerId: CLEANER,
      cleanerRole: "cleaner",
    });
    const rows = await listRequestsForJob(stores, {
      jobId: job.id,
      hostId: HOST,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cleaner.name).toBe("Ada");

    expect(
      await captureCode(
        listRequestsForJob(stores, { jobId: job.id, hostId: STRANGER }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("listMyJobRequests: only pending rows for the caller, newest first, each with its job", async () => {
    const jobA = makeJob();
    const jobB = makeJob();
    const cleaner = makeUser();
    const { stores } = makeFakes([jobA, jobB], [cleaner]);
    await requestJob(stores, clock, {
      jobId: jobA.id,
      cleanerId: CLEANER,
      cleanerRole: "cleaner",
    });
    const declined = await requestJob(stores, clock, {
      jobId: jobB.id,
      cleanerId: CLEANER,
      cleanerRole: "cleaner",
    });
    await declineJobRequest(stores, clock, {
      requestId: declined.id,
      actorId: HOST,
      actorRole: "host",
    });

    const rows = await listMyJobRequests(stores, {
      cleanerId: CLEANER,
      cleanerRole: "cleaner",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.job.id).toBe(jobA.id);

    expect(
      await captureCode(
        listMyJobRequests(stores, { cleanerId: HOST, cleanerRole: "host" }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("closePendingForCancelledJob closes every pending row on the job", async () => {
    const job = makeJob();
    const cleaner = makeUser();
    const { stores, requests } = makeFakes([job], [cleaner]);
    const request = await requestJob(stores, clock, {
      jobId: job.id,
      cleanerId: CLEANER,
      cleanerRole: "cleaner",
    });
    await closePendingForCancelledJob(stores, job.id);
    expect(requests.get(request.id)?.status).toBe("closed");
  });
});
