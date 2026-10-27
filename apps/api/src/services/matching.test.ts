import type {
  CleanerAvailability,
  Job,
  Message,
  SparklErrorCode,
  User,
} from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  type MatchingStores,
  type RankingFlags,
  MatchingError,
  acceptanceRate,
  availabilityOverlapFraction,
  rankJobsForCleaner,
  replyDelaysMinutes,
  resolveWeights,
  responseTimeScore,
  scoreCompletedJobs,
  scoreDistanceKm,
  scoreRating,
  suggestCleanersForJob,
} from "./matching.js";

const HOST = "11111111-1111-4111-8111-111111111111";
const OTHER_HOST = "99999999-9999-4999-8999-999999999999";
const CLEANER_A = "22222222-2222-4222-8222-222222222222";
const CLEANER_B = "33333333-3333-4333-8333-333333333333";

// 2026-02-06 is a Friday (getUTCDay() === 5), 10:00-13:00 UTC.
const WINDOW_START = "2026-02-06T10:00:00.000Z";
const WINDOW_END = "2026-02-06T13:00:00.000Z";

let seq = 0;
function uid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: CLEANER_A,
    role: "cleaner",
    name: "Ada Cleaner",
    photoUrl: null,
    serviceLat: 40.42,
    serviceLng: -3.7,
    serviceRadiusKm: 10,
    avgRating: 4.5,
    completedJobCount: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: uid(),
    hostId: HOST,
    address: "Calle Falsa 123",
    latitude: 40.4168,
    longitude: -3.7038,
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
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

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: uid(),
    jobId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    senderId: HOST,
    body: "Hello",
    createdAt: "2026-02-01T10:00:00.000Z",
    ...overrides,
  };
}

function coveringSlot(cleanerId: string): CleanerAvailability {
  return { cleanerId, weekday: 5, startTime: "09:00", endTime: "14:00" };
}

interface Seed {
  users: User[];
  availability: Record<string, CleanerAvailability[]>;
  jobs: Job[];
  messages: Message[];
}

function makeStores(seed: Seed): MatchingStores {
  return {
    jobs: {
      findJobById: async (jobId) =>
        seed.jobs.find((j) => j.id === jobId) ?? null,
      listOpenJobs: async () =>
        seed.jobs.filter((j) => j.status === "open"),
      listJobsByCleaner: async (cleanerId) =>
        seed.jobs.filter((j) => j.claimedByCleanerId === cleanerId),
      listJobsByHost: async (hostId) =>
        seed.jobs.filter((j) => j.hostId === hostId),
    },
    users: {
      findById: async (userId) =>
        seed.users.find((u) => u.id === userId) ?? null,
      listAvailability: async (cleanerId) => [
        ...(seed.availability[cleanerId] ?? []),
      ],
      listCleaners: async () => seed.users.filter((u) => u.role === "cleaner"),
    },
    messages: {
      listMessagesByJob: async (jobId) =>
        seed.messages.filter((m) => m.jobId === jobId),
    },
  };
}

const flagsOff: RankingFlags = { isEnabled: () => false };
const flagsOn: RankingFlags = { isEnabled: () => true };

function baseArgs(jobId: string) {
  return {
    jobId,
    limit: 20,
    offset: 0,
    hostId: HOST,
    hostRole: "host" as const,
  };
}

async function captureCode(
  promise: Promise<unknown>,
): Promise<SparklErrorCode | null> {
  try {
    await promise;
    return null;
  } catch (err) {
    expect(err).toBeInstanceOf(MatchingError);
    return (err as MatchingError).code;
  }
}

describe("matching service", () => {
  it("ranks the nearer highly-rated cleaner first", async () => {
    const job = makeJob();
    const done = makeJob({
      status: "completed",
      claimedByCleanerId: CLEANER_A,
    });
    const stores = makeStores({
      users: [
        makeUser({ id: CLEANER_A, avgRating: 4.9, completedJobCount: 12 }),
        makeUser({
          id: CLEANER_B,
          name: "Bo Cleaner",
          avgRating: 3.0,
          serviceLat: 41.3874,
          serviceLng: 2.1686,
          completedJobCount: 0,
        }),
      ],
      availability: { [CLEANER_A]: [coveringSlot(CLEANER_A)] },
      jobs: [job, done],
      messages: [],
    });
    const { suggestions, total } = await suggestCleanersForJob(
      stores,
      flagsOff,
      baseArgs(job.id),
    );
    expect(total).toBe(2);
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]?.cleaner.profile.id).toBe(CLEANER_A);
    expect(suggestions[1]?.cleaner.profile.id).toBe(CLEANER_B);
    expect(suggestions[0]?.score ?? 0).toBeGreaterThan(
      suggestions[1]?.score ?? 1,
    );
    for (const s of suggestions) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("availability overlap decides otherwise-tied cleaners", async () => {
    const job = makeJob();
    const stores = makeStores({
      users: [makeUser({ id: CLEANER_A }), makeUser({ id: CLEANER_B })],
      availability: {
        [CLEANER_A]: [coveringSlot(CLEANER_A)],
        [CLEANER_B]: [
          {
            cleanerId: CLEANER_B,
            weekday: 5,
            startTime: "00:00",
            endTime: "01:00",
          },
        ],
      },
      jobs: [job],
      messages: [],
    });
    const { suggestions } = await suggestCleanersForJob(
      stores,
      flagsOff,
      baseArgs(job.id),
    );
    expect(suggestions[0]?.cleaner.profile.id).toBe(CLEANER_A);
    expect(suggestions[0]?.breakdown.availability).toBe(1);
    expect(suggestions[1]?.breakdown.availability).toBe(0);
  });

  it("acceptance rate rewards completions over cancellations", async () => {
    const job = makeJob();
    const stores = makeStores({
      users: [makeUser({ id: CLEANER_A }), makeUser({ id: CLEANER_B })],
      availability: {
        [CLEANER_A]: [coveringSlot(CLEANER_A)],
        [CLEANER_B]: [coveringSlot(CLEANER_B)],
      },
      jobs: [
        job,
        makeJob({ status: "completed", claimedByCleanerId: CLEANER_A }),
        makeJob({ status: "completed", claimedByCleanerId: CLEANER_A }),
        makeJob({ status: "cancelled", claimedByCleanerId: CLEANER_B }),
        makeJob({ status: "cancelled", claimedByCleanerId: CLEANER_B }),
      ],
      messages: [],
    });
    const { suggestions } = await suggestCleanersForJob(
      stores,
      flagsOff,
      baseArgs(job.id),
    );
    expect(suggestions[0]?.cleaner.profile.id).toBe(CLEANER_A);
    expect(suggestions[0]?.breakdown.acceptanceRate).toBe(1);
    expect(suggestions[1]?.breakdown.acceptanceRate).toBe(0);
  });

  it("response time rewards the faster replier", async () => {
    const job = makeJob();
    const pastA = makeJob({
      status: "completed",
      claimedByCleanerId: CLEANER_A,
    });
    const pastB = makeJob({
      status: "completed",
      claimedByCleanerId: CLEANER_B,
    });
    const stores = makeStores({
      users: [
        makeUser({ id: CLEANER_A, completedJobCount: 6 }),
        makeUser({ id: CLEANER_B, completedJobCount: 6 }),
      ],
      availability: {
        [CLEANER_A]: [coveringSlot(CLEANER_A)],
        [CLEANER_B]: [coveringSlot(CLEANER_B)],
      },
      jobs: [job, pastA, pastB],
      messages: [
        makeMessage({ jobId: pastA.id, createdAt: "2026-02-01T10:00:00.000Z" }),
        makeMessage({
          jobId: pastA.id,
          senderId: CLEANER_A,
          createdAt: "2026-02-01T10:05:00.000Z",
        }),
        makeMessage({ jobId: pastB.id, createdAt: "2026-02-01T10:00:00.000Z" }),
        makeMessage({
          jobId: pastB.id,
          senderId: CLEANER_B,
          createdAt: "2026-02-01T20:00:00.000Z",
        }),
      ],
    });
    const { suggestions } = await suggestCleanersForJob(
      stores,
      flagsOff,
      baseArgs(job.id),
    );
    expect(suggestions[0]?.cleaner.profile.id).toBe(CLEANER_A);
    expect(suggestions[0]?.breakdown.responseTime ?? 0).toBeGreaterThan(
      suggestions[1]?.breakdown.responseTime ?? 1,
    );
  });

  it("scores every signal neutral for a brand-new cleaner", async () => {
    const job = makeJob();
    const stores = makeStores({
      users: [
        makeUser({
          serviceLat: null,
          serviceLng: null,
          serviceRadiusKm: null,
          avgRating: null,
          completedJobCount: 0,
        }),
      ],
      availability: {},
      jobs: [job],
      messages: [],
    });
    const { suggestions, total } = await suggestCleanersForJob(
      stores,
      flagsOff,
      baseArgs(job.id),
    );
    expect(total).toBe(1);
    const breakdown = suggestions[0]?.breakdown;
    expect(breakdown).toEqual({
      rating: 0.5,
      distance: 0.5,
      availability: 0.5,
      completedJobs: 0,
      acceptanceRate: 0.5,
      responseTime: 0.5,
    });
    expect(suggestions[0]?.score).toBeCloseTo(0.45);
  });

  it("resolveWeights switches on the ranking-weights-v2 flag", () => {
    expect(resolveWeights(flagsOff).rating).toBe(0.3);
    expect(resolveWeights(flagsOn).rating).toBe(0.35);
  });

  it("rejects non-hosts, strangers, and missing or non-open jobs", async () => {
    const open = makeJob();
    const claimed = makeJob({ status: "claimed", claimedByCleanerId: CLEANER_A });
    const stores = makeStores({
      users: [makeUser({ id: CLEANER_A })],
      availability: {},
      jobs: [open, claimed],
      messages: [],
    });
    expect(
      await captureCode(
        suggestCleanersForJob(stores, flagsOff, {
          ...baseArgs(open.id),
          hostRole: "cleaner",
          hostId: CLEANER_A,
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await captureCode(
        suggestCleanersForJob(stores, flagsOff, {
          ...baseArgs(open.id),
          hostId: OTHER_HOST,
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await captureCode(
        suggestCleanersForJob(stores, flagsOff, {
          ...baseArgs("99999999-9999-4999-8999-999999999999"),
        }),
      ),
    ).toBe("NOT_FOUND");
    expect(
      await captureCode(
        suggestCleanersForJob(stores, flagsOff, baseArgs(claimed.id)),
      ),
    ).toBe("JOB_NOT_OPEN");
  });

  it("pure signal helpers clamp and default as documented", () => {
    expect(scoreRating(null)).toBe(0.5);
    expect(scoreRating(5)).toBe(1);
    expect(scoreDistanceKm(null, 10)).toBe(0.5);
    expect(scoreDistanceKm(5, 10)).toBeCloseTo(0.5);
    expect(scoreDistanceKm(50, 10)).toBe(0);
    expect(scoreCompletedJobs(25)).toBe(1);
    expect(scoreCompletedJobs(0)).toBe(0);
    expect(acceptanceRate([])).toBe(0.5);
    expect(responseTimeScore([])).toBe(0.5);
    expect(responseTimeScore([1440 * 2])).toBe(0);
    const job = makeJob();
    expect(availabilityOverlapFraction(job, [])).toBe(0.5);
    expect(
      availabilityOverlapFraction(job, [coveringSlot(CLEANER_A)]),
    ).toBe(1);
    expect(
      replyDelaysMinutes(
        job,
        [
          makeMessage({
            jobId: job.id,
            createdAt: "2026-02-01T10:00:00.000Z",
          }),
          makeMessage({
            jobId: job.id,
            senderId: CLEANER_A,
            createdAt: "2026-02-01T10:30:00.000Z",
          }),
        ],
        CLEANER_A,
      ),
    ).toEqual([30]);
  });
});

describe("ranked board", () => {
  const HOST_A = "44444444-4444-4444-8444-444444444444";
  const HOST_B = "55555555-5555-5555-8555-555555555555";

  function makeHost(overrides: Partial<User> = {}): User {
    return makeUser({
      id: HOST_A,
      role: "host",
      name: "Dana Host",
      avgRating: 4.9,
      completedJobCount: 12,
      ...overrides,
    });
  }

  function boardArgs(extra: Partial<ListOpenJobsInput> = {}) {
    return {
      limit: 20,
      offset: 0,
      cleanerId: CLEANER_A,
      cleanerRole: "cleaner" as const,
      ...extra,
    };
  }

  it("ranks the nearer job from the higher-rated host first", async () => {
    const near = makeJob({ hostId: HOST_A });
    const far = makeJob({
      hostId: HOST_B,
      latitude: 41.3874,
      longitude: 2.1686,
    });
    const stores = makeStores({
      users: [
        makeUser({ id: CLEANER_A }),
        makeHost({ id: HOST_A }),
        makeHost({
          id: HOST_B,
          name: "Sam Host",
          avgRating: 3.0,
          completedJobCount: 0,
        }),
      ],
      availability: { [CLEANER_A]: [coveringSlot(CLEANER_A)] },
      jobs: [near, far],
      messages: [],
    });
    const { jobs, total } = await rankJobsForCleaner(
      stores,
      flagsOff,
      boardArgs(),
    );
    expect(total).toBe(2);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.job.id).toBe(near.id);
    expect(jobs[1]?.job.id).toBe(far.id);
    expect(jobs[0]?.score ?? 0).toBeGreaterThan(jobs[1]?.score ?? 1);
  });

  it("host acceptance rewards reliable hosts", async () => {
    const good = makeJob({ hostId: HOST_A });
    const flaky = makeJob({ hostId: HOST_B });
    const stores = makeStores({
      users: [
        makeUser({ id: CLEANER_A }),
        makeHost({ id: HOST_A, completedJobCount: 5 }),
        makeHost({ id: HOST_B, completedJobCount: 5 }),
      ],
      availability: {
        [CLEANER_A]: [coveringSlot(CLEANER_A)],
      },
      jobs: [
        good,
        flaky,
        makeJob({
          hostId: HOST_A,
          status: "completed",
          claimedByCleanerId: CLEANER_B,
        }),
        makeJob({
          hostId: HOST_A,
          status: "completed",
          claimedByCleanerId: CLEANER_B,
        }),
        makeJob({
          hostId: HOST_B,
          status: "cancelled",
          claimedByCleanerId: CLEANER_B,
        }),
        makeJob({
          hostId: HOST_B,
          status: "cancelled",
          claimedByCleanerId: CLEANER_B,
        }),
      ],
      messages: [],
    });
    const { jobs } = await rankJobsForCleaner(stores, flagsOff, boardArgs());
    expect(jobs[0]?.job.id).toBe(good.id);
    expect(jobs[0]?.breakdown.acceptanceRate).toBe(1);
    expect(jobs[1]?.breakdown.acceptanceRate).toBe(0);
  });

  it("response time rewards responsive hosts", async () => {
    const fromFast = makeJob({ hostId: HOST_A });
    const fromSlow = makeJob({ hostId: HOST_B });
    const pastFast = makeJob({
      hostId: HOST_A,
      status: "completed",
      claimedByCleanerId: CLEANER_A,
    });
    const pastSlow = makeJob({
      hostId: HOST_B,
      status: "completed",
      claimedByCleanerId: CLEANER_A,
    });
    const stores = makeStores({
      users: [
        makeUser({ id: CLEANER_A, completedJobCount: 6 }),
        makeHost({ id: HOST_A, completedJobCount: 5 }),
        makeHost({ id: HOST_B, completedJobCount: 5 }),
      ],
      availability: { [CLEANER_A]: [coveringSlot(CLEANER_A)] },
      jobs: [fromFast, fromSlow, pastFast, pastSlow],
      messages: [
        makeMessage({
          jobId: pastFast.id,
          senderId: HOST_A,
          createdAt: "2026-02-01T10:00:00.000Z",
        }),
        makeMessage({
          jobId: pastFast.id,
          senderId: CLEANER_A,
          createdAt: "2026-02-01T10:05:00.000Z",
        }),
        makeMessage({
          jobId: pastSlow.id,
          senderId: HOST_B,
          createdAt: "2026-02-01T10:00:00.000Z",
        }),
        makeMessage({
          jobId: pastSlow.id,
          senderId: CLEANER_A,
          createdAt: "2026-02-01T20:00:00.000Z",
        }),
      ],
    });
    const { jobs } = await rankJobsForCleaner(stores, flagsOff, boardArgs());
    expect(jobs[0]?.job.id).toBe(fromFast.id);
    expect(jobs[0]?.breakdown.responseTime ?? 0).toBeGreaterThan(
      jobs[1]?.breakdown.responseTime ?? 1,
    );
  });

  it("respects filters and paginates after ranking", async () => {
    const friday = makeJob({ hostId: HOST_A });
    const saturday = makeJob({
      hostId: HOST_A,
      windowStart: "2026-02-07T10:00:00.000Z",
      windowEnd: "2026-02-07T12:00:00.000Z",
    });
    const stores = makeStores({
      users: [makeUser({ id: CLEANER_A }), makeHost({ id: HOST_A })],
      availability: { [CLEANER_A]: [coveringSlot(CLEANER_A)] },
      jobs: [friday, saturday],
      messages: [],
    });
    const filtered = await rankJobsForCleaner(
      stores,
      flagsOff,
      boardArgs({ dateFrom: "2026-02-07T00:00:00.000Z" }),
    );
    expect(filtered.total).toBe(1);
    expect(filtered.jobs[0]?.job.id).toBe(saturday.id);
    const paged = await rankJobsForCleaner(
      stores,
      flagsOff,
      boardArgs({ limit: 1 }),
    );
    expect(paged.total).toBe(2);
    expect(paged.jobs).toHaveLength(1);
  });

  it("rejects hosts and unknown cleaners", async () => {
    const job = makeJob({ hostId: HOST_A });
    const stores = makeStores({
      users: [makeUser({ id: CLEANER_A }), makeHost({ id: HOST_A })],
      availability: {},
      jobs: [job],
      messages: [],
    });
    expect(
      await captureCode(
        rankJobsForCleaner(stores, flagsOff, {
          ...boardArgs(),
          cleanerRole: "host",
          cleanerId: HOST_A,
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await captureCode(
        rankJobsForCleaner(stores, flagsOff, {
          ...boardArgs(),
          cleanerId: "99999999-9999-4999-8999-999999999999",
        }),
      ),
    ).toBe("NOT_FOUND");
  });
});
