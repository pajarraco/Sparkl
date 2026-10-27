import type { Job, SparklErrorCode } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  type Clock,
  JobsServiceError,
  type JobsStore,
  cancelJob,
  claimJob,
  createJob,
  transitionJob,
} from "./jobs.js";

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
      [...jobs.values()].filter(
        (job) => job.claimedByCleanerId === cleanerId,
      ),
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

    expect(
      await captureCode(
        transitionJob(store, clock, {
          jobId,
          toStatus: "completed",
          actorId: HOST_ID,
          actorRole: "host",
        }),
      ),
    ).toBe("INVALID_TRANSITION");

    await claimJob(store, clock, {
      jobId,
      cleanerId: CLEANER_A,
      cleanerRole: "cleaner",
    });
    const started = await transitionJob(store, clock, {
      jobId,
      toStatus: "in_progress",
      actorId: CLEANER_A,
      actorRole: "cleaner",
    });
    expect(started.status).toBe("in_progress");

    const done = await transitionJob(store, clock, {
      jobId,
      toStatus: "completed",
      actorId: HOST_ID,
      actorRole: "host",
    });
    expect(done.status).toBe("completed");

    expect(
      await captureCode(
        transitionJob(store, clock, {
          jobId,
          toStatus: "in_progress",
          actorId: CLEANER_B,
          actorRole: "cleaner",
        }),
      ),
    ).toBe("NOT_JOB_PARTY");
  });

  it("cancelJob cancels for the host only, rejects terminal states", async () => {
    const store = makeFakeStore([makeJob()]);
    const jobId = (await store.listOpenJobs())[0]?.id as string;

    expect(
      await captureCode(
        cancelJob(store, clock, {
          jobId,
          actorId: CLEANER_A,
          actorRole: "cleaner",
        }),
      ),
    ).toBe("NOT_JOB_PARTY");

    const cancelled = await cancelJob(store, clock, {
      jobId,
      actorId: HOST_ID,
      actorRole: "host",
    });
    expect(cancelled.status).toBe("cancelled");

    expect(
      await captureCode(
        cancelJob(store, clock, { jobId, actorId: HOST_ID, actorRole: "host" }),
      ),
    ).toBe("INVALID_TRANSITION");
  });
});
