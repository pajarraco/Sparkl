import type { Job, Review, SparklErrorCode, User } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import type { Clock, JobsStore } from "./jobs.js";
import {
  type ReviewStores,
  ReviewsError,
  createReview,
  listReviewsBySubject,
} from "./reviews.js";
import type { ProfilePatch } from "./users.js";

const HOST = "11111111-1111-4111-8111-111111111111";
const CLEANER = "22222222-2222-4222-8222-222222222222";
const STRANGER = "33333333-3333-4333-8333-333333333333";

const clock: Clock = { nowIso: () => "2026-01-01T10:00:00.000Z" };

let seq = 0;
function uid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: HOST,
    role: "host",
    name: "Dana Host",
    photoUrl: null,
    serviceLat: null,
    serviceLng: null,
    serviceRadiusKm: null,
    avgRating: null,
    completedJobCount: 12,
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
    windowStart: "2026-02-01T10:00:00.000Z",
    windowEnd: "2026-02-01T12:00:00.000Z",
    sizeSqm: 80,
    notes: null,
    priceMinorUnits: 5000,
    status: "completed",
    claimedByCleanerId: CLEANER,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: uid(),
    jobId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    authorId: HOST,
    subjectId: CLEANER,
    stars: 5,
    comment: null,
    createdAt: "2026-02-01T10:00:00.000Z",
    ...overrides,
  };
}

interface Fakes {
  stores: ReviewStores;
  users: Map<string, User>;
}

function makeFakes(jobs: Job[], users: User[], seed: Review[] = []): Fakes {
  const jobMap = new Map(jobs.map((j) => [j.id, { ...j }]));
  const userMap = new Map(users.map((u) => [u.id, { ...u }]));
  const reviews = seed.map((r) => ({ ...r }));
  return {
    stores: {
      jobs: {
        findJobById: async (jobId: string) =>
          jobMap.has(jobId) ? { ...(jobMap.get(jobId) as Job) } : null,
      } satisfies Pick<JobsStore, "findJobById">,
      users: {
        update: async (userId: string, patch: ProfilePatch) => {
          const existing = userMap.get(userId);
          if (!existing) return null;
          const updated = { ...existing };
          if (patch.avgRating !== undefined)
            updated.avgRating = patch.avgRating;
          userMap.set(userId, updated);
          return { ...updated };
        },
      },
      reviews: {
        findReviewByJobAndAuthor: async (jobId, authorId) =>
          reviews.find((r) => r.jobId === jobId && r.authorId === authorId) ??
          null,
        insertReview: async (review) => {
          reviews.push({ ...review });
          return { ...review };
        },
        listReviewsBySubject: async (subjectId) =>
          reviews.filter((r) => r.subjectId === subjectId),
      },
    },
    users: userMap,
  };
}

async function captureCode(
  promise: Promise<unknown>,
): Promise<SparklErrorCode | null> {
  try {
    await promise;
    return null;
  } catch (err) {
    expect(err).toBeInstanceOf(ReviewsError);
    return (err as ReviewsError).code;
  }
}

const hostArgs = {
  authorId: HOST,
  authorRole: "host" as const,
};

describe("reviews service", () => {
  it("creates a review and sets the subject average", async () => {
    const job = makeJob();
    const fakes = makeFakes(
      [job],
      [makeUser({ id: HOST }), makeUser({ id: CLEANER, role: "cleaner" })],
    );
    const saved = await createReview(fakes.stores, clock, {
      jobId: job.id,
      subjectId: CLEANER,
      stars: 5,
      ...hostArgs,
    });
    expect(saved.comment).toBeNull();
    expect(saved.createdAt).toBe("2026-01-01T10:00:00.000Z");
    expect(fakes.users.get(CLEANER)?.avgRating).toBe(5);
  });

  it("averages across the subject's received reviews", async () => {
    const first = makeJob();
    const second = makeJob();
    const fakes = makeFakes(
      [first, second],
      [makeUser({ id: HOST }), makeUser({ id: CLEANER, role: "cleaner" })],
      [makeReview({ jobId: second.id, stars: 3 })],
    );
    await createReview(fakes.stores, clock, {
      jobId: first.id,
      subjectId: CLEANER,
      stars: 5,
      comment: "Spotless.",
      ...hostArgs,
    });
    expect(fakes.users.get(CLEANER)?.avgRating).toBe(4);
  });

  it("rejects duplicates, non-completed jobs, and missing jobs", async () => {
    const done = makeJob();
    const active = makeJob({ status: "in_progress" });
    const fakes = makeFakes(
      [done, active],
      [makeUser({ id: HOST }), makeUser({ id: CLEANER, role: "cleaner" })],
    );
    await createReview(fakes.stores, clock, {
      jobId: done.id,
      subjectId: CLEANER,
      stars: 5,
      ...hostArgs,
    });
    expect(
      await captureCode(
        createReview(fakes.stores, clock, {
          jobId: done.id,
          subjectId: CLEANER,
          stars: 4,
          ...hostArgs,
        }),
      ),
    ).toBe("REVIEW_DUPLICATE");
    expect(
      await captureCode(
        createReview(fakes.stores, clock, {
          jobId: active.id,
          subjectId: CLEANER,
          stars: 5,
          ...hostArgs,
        }),
      ),
    ).toBe("REVIEW_NOT_ALLOWED");
    expect(
      await captureCode(
        createReview(fakes.stores, clock, {
          jobId: "99999999-9999-4999-8999-999999999999",
          subjectId: CLEANER,
          stars: 5,
          ...hostArgs,
        }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("only the other party can be reviewed, by a party", async () => {
    const job = makeJob();
    const fakes = makeFakes(
      [job],
      [
        makeUser({ id: HOST }),
        makeUser({ id: CLEANER, role: "cleaner" }),
        makeUser({ id: STRANGER, role: "cleaner" }),
      ],
    );
    expect(
      await captureCode(
        createReview(fakes.stores, clock, {
          jobId: job.id,
          subjectId: STRANGER,
          stars: 5,
          ...hostArgs,
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await captureCode(
        createReview(fakes.stores, clock, {
          jobId: job.id,
          subjectId: HOST,
          stars: 5,
          ...hostArgs,
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await captureCode(
        createReview(fakes.stores, clock, {
          jobId: job.id,
          subjectId: CLEANER,
          stars: 5,
          authorId: STRANGER,
          authorRole: "cleaner",
        }),
      ),
    ).toBe("NOT_JOB_PARTY");
  });

  it("lists newest-first with totals", async () => {
    const job = makeJob();
    const fakes = makeFakes(
      [job],
      [makeUser({ id: HOST }), makeUser({ id: CLEANER, role: "cleaner" })],
      [
        makeReview({ jobId: job.id, createdAt: "2026-02-01T10:00:00.000Z" }),
        makeReview({ jobId: job.id, createdAt: "2026-02-03T10:00:00.000Z" }),
        makeReview({ jobId: job.id, createdAt: "2026-02-02T10:00:00.000Z" }),
      ],
    );
    const page = await listReviewsBySubject(fakes.stores, {
      subjectId: CLEANER,
      limit: 2,
      offset: 0,
    });
    expect(page.total).toBe(3);
    expect(page.reviews.map((r) => r.createdAt)).toEqual([
      "2026-02-03T10:00:00.000Z",
      "2026-02-02T10:00:00.000Z",
    ]);
  });
});
