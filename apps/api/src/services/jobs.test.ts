import type { Job, SparklErrorCode, User } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  type Clock,
  JobsServiceError,
  type JobsStore,
  cancelJob,
  claimJob,
  createJob,
  listMyClaimedJobs,
  transitionJob,
} from "./jobs.js";
import type { UsersStore } from "./users.js";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const CLEANER_A = "22222222-2222-4222-8222-222222222222";
const CLEANER_B = "33333333-3333-4333-8333-333333333333";

const clock: Clock = { nowIso: () => "2026-01-01T10:00:00.000Z" };

let seq = 0;

function makeJob(overrides: Partial<Job> = {}): Job {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    hostId: HOST_ID,
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

function makeFakeStore(seed: Job[] = []): JobsStore {
  const jobs = new Map(seed.map((job) => [job.id, { ...job }]));
  return {
    insertJob: async (job) => {
      jobs.set(job.id, { ...job });
      return { ...job };
    },
    findJobById: async (jobId) =>
      jobs.has(jobId) ? { ...(jobs.get(jobId) as Job) } : null,
    listOpenJobs: async () =>
      [...jobs.values()].filter((job) => job.status === "open"),
    listJobsByHost: async (hostId) =>
      [...jobs.values()].filter((job) => job.hostId === hostId),
    listJobsByCleaner: async (cleanerId) =>
      [...jobs.values()].filter((job) => job.claimedByCleanerId === cleanerId),
    listJobsForPricing: async () => [...jobs.values()],
    claimIfOpen: async (jobId, cleanerId, nowIso) => {
      const current = jobs.get(jobId);
      if (current === undefined)
        throw new JobsServiceError("NOT_FOUND", "Job not found.");
      if (current.status === "claimed") {
        throw new JobsServiceError(
          "JOB_ALREADY_CLAIMED",
          "Job was already claimed.",
        );
      }
      if (current.status !== "open") {
        throw new JobsServiceError(
          "JOB_NOT_OPEN",
          `Job is ${current.status}, not open.`,
        );
      }
      const claimed: Job = {
        ...current,
        status: "claimed",
        claimedByCleanerId: cleanerId,
        updatedAt: nowIso,
      };
      jobs.set(jobId, claimed);
      return { ...claimed };
    },
    saveJob: async (job) => {
      jobs.set(job.id, { ...job });
      return { ...job };
    },
  };
}

function makeStatsUser(id: string): User {
  return {
    id,
    role: "host",
    name: "Stats User",
    photoUrl: null,
    serviceLat: null,
    serviceLng: null,
    serviceRadiusKm: null,
    avgRating: null,
    completedJobCount: 0,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
  };
}

function makeStatsStub() {
  const counts = new Map<string, number>();
  const store: Pick<UsersStore, "incrementCompletedJobs"> = {
    incrementCompletedJobs: async (userId: string) => {
      counts.set(userId, (counts.get(userId) ?? 0) + 1);
      return makeStatsUser(userId);
    },
  };
  return { counts, store };
}

async function captureCode(
  promise: Promise<unknown>,
): Promise<SparklErrorCode | null> {
  try {
    await promise;
    return null;
  } catch (err) {
    expect(err).toBeInstanceOf(JobsServiceError);
    return (err as JobsServiceError).code;
  }
}

const createInput = {
  address: "Calle Falsa 123",
  latitude: 40.4168,
  longitude: -3.7038,
  windowStart: "2026-02-01T10:00:00.000Z",
  windowEnd: "2026-02-01T12:00:00.000Z",
  priceMinorUnits: 5000,
};

describe("jobs service", () => {
  it("createJob posts an open job for a host, rejects cleaners", async () => {
    const store = makeFakeStore();
    const job = await createJob(store, clock, {
      hostId: HOST_ID,
      hostRole: "host",
      input: createInput,
    });
    expect(job.status).toBe("open");
    expect(job.hostId).toBe(HOST_ID);
    expect(job.claimedByCleanerId).toBeNull();
    expect(
      await captureCode(
        createJob(store, clock, {
          hostId: CLEANER_A,
          hostRole: "cleaner",
          input: createInput,
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("createJob keeps a pin only for a cleaner the host has worked with", async () => {
    const worked = makeFakeStore([
      makeJob({ status: "completed", claimedByCleanerId: CLEANER_A }),
    ]);
    const job = await createJob(worked, clock, {
      hostId: HOST_ID,
      hostRole: "host",
      input: { ...createInput, preferredCleanerId: CLEANER_A },
    });
    expect(job.preferredCleanerId).toBe(CLEANER_A);

    expect(
      await captureCode(
        createJob(makeFakeStore(), clock, {
          hostId: HOST_ID,
          hostRole: "host",
          input: { ...createInput, preferredCleanerId: CLEANER_A },
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("claim race: winner claims, loser gets JOB_ALREADY_CLAIMED", async () => {
    const store = makeFakeStore([makeJob()]);
    const jobId = (await store.listOpenJobs())[0]?.id as string;

    const winner = await claimJob(store, clock, {
      jobId,
      cleanerId: CLEANER_A,
      cleanerRole: "cleaner",
    });
    expect(winner.status).toBe("claimed");
    expect(winner.claimedByCleanerId).toBe(CLEANER_A);

    expect(
      await captureCode(
        claimJob(store, clock, {
          jobId,
          cleanerId: CLEANER_B,
          cleanerRole: "cleaner",
        }),
      ),
    ).toBe("JOB_ALREADY_CLAIMED");
    expect(
      await captureCode(
        claimJob(store, clock, {
          jobId,
          cleanerId: HOST_ID,
          cleanerRole: "host",
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("claim on a non-open job throws JOB_NOT_OPEN, missing job throws NOT_FOUND", async () => {
    const seeded = makeJob({
      status: "in_progress",
      claimedByCleanerId: CLEANER_A,
    });
    const store = makeFakeStore([seeded]);
    expect(
      await captureCode(
        claimJob(store, clock, {
          jobId: seeded.id,
          cleanerId: CLEANER_B,
          cleanerRole: "cleaner",
        }),
      ),
    ).toBe("JOB_NOT_OPEN");
    expect(
      await captureCode(
        claimJob(store, clock, {
          jobId: "99999999-9999-4999-8999-999999999999",
          cleanerId: CLEANER_B,
          cleanerRole: "cleaner",
        }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("transitionJob enforces JOB_STATUS_TRANSITIONS and the right party", async () => {
    const store = makeFakeStore([makeJob()]);
    const jobId = (await store.listOpenJobs())[0]?.id as string;
    const stats = makeStatsStub();

    expect(
      await captureCode(
        transitionJob(
          store,
          clock,
          {
            jobId,
            toStatus: "completed",
            actorId: HOST_ID,
            actorRole: "host",
          },
          stats.store,
        ),
      ),
    ).toBe("INVALID_TRANSITION");

    await claimJob(store, clock, {
      jobId,
      cleanerId: CLEANER_A,
      cleanerRole: "cleaner",
    });
    const started = await transitionJob(
      store,
      clock,
      {
        jobId,
        toStatus: "in_progress",
        actorId: CLEANER_A,
        actorRole: "cleaner",
      },
      stats.store,
    );
    expect(started.status).toBe("in_progress");

    const done = await transitionJob(
      store,
      clock,
      {
        jobId,
        toStatus: "completed",
        actorId: HOST_ID,
        actorRole: "host",
      },
      stats.store,
    );
    expect(done.status).toBe("completed");

    expect(
      await captureCode(
        transitionJob(
          store,
          clock,
          {
            jobId,
            toStatus: "in_progress",
            actorId: CLEANER_B,
            actorRole: "cleaner",
          },
          stats.store,
        ),
      ),
    ).toBe("NOT_JOB_PARTY");
  });

  it("cancelJob cancels for the host only, rejects terminal states", async () => {
    const store = makeFakeStore([makeJob()]);
    const jobId = (await store.listOpenJobs())[0]?.id as string;
    const stats = makeStatsStub();

    expect(
      await captureCode(
        cancelJob(
          store,
          clock,
          {
            jobId,
            actorId: CLEANER_A,
            actorRole: "cleaner",
          },
          stats.store,
        ),
      ),
    ).toBe("NOT_JOB_PARTY");

    const cancelled = await cancelJob(
      store,
      clock,
      {
        jobId,
        actorId: HOST_ID,
        actorRole: "host",
      },
      stats.store,
    );
    expect(cancelled.status).toBe("cancelled");

    expect(
      await captureCode(
        cancelJob(
          store,
          clock,
          { jobId, actorId: HOST_ID, actorRole: "host" },
          stats.store,
        ),
      ),
    ).toBe("INVALID_TRANSITION");
  });

  it("completion increments both parties once; cancellation increments none", async () => {
    const store = makeFakeStore([makeJob()]);
    const jobId = (await store.listOpenJobs())[0]?.id as string;
    const stats = makeStatsStub();

    await claimJob(store, clock, {
      jobId,
      cleanerId: CLEANER_A,
      cleanerRole: "cleaner",
    });
    await transitionJob(
      store,
      clock,
      {
        jobId,
        toStatus: "in_progress",
        actorId: CLEANER_A,
        actorRole: "cleaner",
      },
      stats.store,
    );
    expect(stats.counts.size).toBe(0);
    await transitionJob(
      store,
      clock,
      {
        jobId,
        toStatus: "completed",
        actorId: HOST_ID,
        actorRole: "host",
      },
      stats.store,
    );
    expect(stats.counts.get(HOST_ID)).toBe(1);
    expect(stats.counts.get(CLEANER_A)).toBe(1);

    expect(
      await captureCode(
        transitionJob(
          store,
          clock,
          {
            jobId,
            toStatus: "in_progress",
            actorId: CLEANER_A,
            actorRole: "cleaner",
          },
          stats.store,
        ),
      ),
    ).toBe("INVALID_TRANSITION");
    expect(stats.counts.get(HOST_ID)).toBe(1);

    const cancelled = makeFakeStore([makeJob()]);
    const cancelledId = (await cancelled.listOpenJobs())[0]?.id as string;
    const cancelledStats = makeStatsStub();
    await cancelJob(
      cancelled,
      clock,
      { jobId: cancelledId, actorId: HOST_ID, actorRole: "host" },
      cancelledStats.store,
    );
    expect(cancelledStats.counts.size).toBe(0);
  });
});

describe("listMyClaimedJobs", () => {
  function claimedSeed(): JobsStore {
    return makeFakeStore([
      makeJob({
        status: "claimed",
        claimedByCleanerId: CLEANER_A,
        createdAt: "2026-01-03T10:00:00.000Z",
      }),
      makeJob({
        status: "in_progress",
        claimedByCleanerId: CLEANER_A,
        createdAt: "2026-01-02T10:00:00.000Z",
      }),
      makeJob({
        status: "claimed",
        claimedByCleanerId: CLEANER_B,
        createdAt: "2026-01-04T10:00:00.000Z",
      }),
      makeJob({ status: "open", createdAt: "2026-01-05T10:00:00.000Z" }),
    ]);
  }

  it("returns only the caller's claimed jobs, newest first", async () => {
    const mine = await listMyClaimedJobs(claimedSeed(), {
      cleanerId: CLEANER_A,
      cleanerRole: "cleaner",
      input: { limit: 20, offset: 0 },
    });
    expect(mine).toHaveLength(2);
    expect(mine.map((job) => job.createdAt)).toEqual([
      "2026-01-03T10:00:00.000Z",
      "2026-01-02T10:00:00.000Z",
    ]);
  });

  it("filters by status and paginates", async () => {
    const store = claimedSeed();
    const args = {
      cleanerId: CLEANER_A,
      cleanerRole: "cleaner" as const,
    };
    const claimed = await listMyClaimedJobs(store, {
      ...args,
      input: { status: "claimed", limit: 20, offset: 0 },
    });
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.status).toBe("claimed");

    const page = await listMyClaimedJobs(store, {
      ...args,
      input: { limit: 1, offset: 1 },
    });
    expect(page).toHaveLength(1);
    expect(page[0]?.createdAt).toBe("2026-01-02T10:00:00.000Z");
  });

  it("rejects non-cleaner roles", async () => {
    const code = await captureCode(
      listMyClaimedJobs(claimedSeed(), {
        cleanerId: HOST_ID,
        cleanerRole: "host",
        input: { limit: 20, offset: 0 },
      }),
    );
    expect(code).toBe("FORBIDDEN");
  });
});
