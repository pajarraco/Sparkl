import type { Job, Review, User } from "@sparkl/shared";
import { describe, expect, it, vi } from "vitest";
import type { SessionCorrections } from "./assistant-sessions.js";
import {
  buildHostMemory,
  correctionHints,
  findSingleProperty,
  findUsualCleanerId,
  hostRatesCleanerWell,
  recentJobSummaries,
} from "./host-memory.js";
import type { ReviewsStore } from "./reviews.js";

const HOST = "host-1";
const MARIA = "cleaner-maria";
const NOW = "2026-10-29T03:00:00.000Z";

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: `job-${Math.random().toString(36).slice(2)}`,
    hostId: HOST,
    address: "12 Ocean St, Bondi",
    latitude: -33.8909,
    longitude: 151.2633,
    windowStart: "2026-11-01T10:00:00.000Z",
    windowEnd: "2026-11-01T12:00:00.000Z",
    sizeSqm: 80,
    notes: "Change the sheets",
    priceMinorUnits: 5000,
    status: "completed",
    claimedByCleanerId: MARIA,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function cleaner(overrides: Partial<User> = {}): User {
  return {
    id: MARIA,
    role: "cleaner",
    name: "Maria",
    photoUrl: null,
    serviceLat: null,
    serviceLng: null,
    serviceRadiusKm: null,
    avgRating: 4.8,
    completedJobCount: 10,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("recentJobSummaries", () => {
  it("is newest-first and capped at five", () => {
    const all = Array.from({ length: 7 }, (_, i) =>
      job({
        id: `job-${i}`,
        address: `Place ${i}`,
        createdAt: `2026-10-2${i}T03:00:00.000Z`,
      }),
    );
    const summaries = recentJobSummaries(all);
    expect(summaries).toHaveLength(5);
    expect(summaries.map((s) => s.address)).toEqual([
      "Place 6",
      "Place 5",
      "Place 4",
      "Place 3",
      "Place 2",
    ]);
    expect(summaries[0]).toMatchObject({
      windowStart: "2026-11-01T10:00:00.000Z",
      sizeSqm: 80,
      notes: "Change the sheets",
      priceMinorUnits: 5000,
    });
  });
});

describe("findSingleProperty", () => {
  it("returns the latest label when every job shares one property", () => {
    const found = findSingleProperty([
      job({ address: "12 Ocean St, Bondi" }),
      job({
        address: "12 Ocean Street North, Bondi",
        createdAt: "2026-10-30T03:00:00.000Z",
      }),
    ]);
    expect(found).toEqual({
      address: "12 Ocean Street North, Bondi",
      latitude: -33.8909,
      longitude: 151.2633,
    });
  });

  it("returns null for two properties or no jobs", () => {
    expect(
      findSingleProperty([
        job({ latitude: -33.8909 }),
        job({ latitude: -33.9, longitude: 151.27 }),
      ]),
    ).toBeNull();
    expect(findSingleProperty([])).toBeNull();
  });
});

describe("findUsualCleanerId", () => {
  const completedBy = (cleanerId: string | null, day: string) =>
    job({
      id: `job-${cleanerId}-${day}`,
      status: "completed",
      claimedByCleanerId: cleanerId,
      windowStart: `2026-10-${day}T10:00:00.000Z`,
      windowEnd: `2026-10-${day}T12:00:00.000Z`,
    });

  it("picks the cleaner behind 3 of the last 5 completed jobs", () => {
    const all = [
      completedBy(MARIA, "25"),
      completedBy(MARIA, "24"),
      completedBy("cleaner-ana", "23"),
      completedBy(MARIA, "22"),
      completedBy("cleaner-ana", "21"),
      // Older than the last-5 window: must not count.
      completedBy("cleaner-ana", "10"),
      completedBy("cleaner-ana", "09"),
    ];
    expect(findUsualCleanerId(all)).toBe(MARIA);
  });

  it("returns null below the threshold or without completed jobs", () => {
    const all = [
      completedBy(MARIA, "25"),
      completedBy(MARIA, "24"),
      completedBy("cleaner-ana", "23"),
      completedBy("cleaner-ana", "22"),
      completedBy("cleaner-bob", "21"),
    ];
    expect(findUsualCleanerId(all)).toBeNull();
    expect(findUsualCleanerId([job({ status: "open" })])).toBeNull();
    expect(findUsualCleanerId([])).toBeNull();
  });
});

describe("hostRatesCleanerWell", () => {
  function reviewsWith(byJob: Record<string, Review | null>) {
    const findReviewByJobAndAuthor = vi.fn<
      ReviewsStore["findReviewByJobAndAuthor"]
    >(async (jobId) => byJob[jobId] ?? null);
    return { findReviewByJobAndAuthor };
  }

  function review(overrides: Partial<Review> = {}): Review {
    return {
      id: "review-1",
      jobId: "job-1",
      authorId: HOST,
      subjectId: MARIA,
      stars: 5,
      comment: null,
      createdAt: NOW,
      ...overrides,
    };
  }

  const shared = [job({ id: "job-1", claimedByCleanerId: MARIA })];

  it("vetoes on a host review below 4 stars", async () => {
    const reviews = reviewsWith({
      "job-1": review({ stars: 3 }),
    });
    await expect(
      hostRatesCleanerWell(reviews, {
        hostId: HOST,
        cleanerId: MARIA,
        shared,
      }),
    ).resolves.toBe(false);
  });

  it("passes on good or missing reviews, and ignores other subjects", async () => {
    const reviews = reviewsWith({
      "job-1": review({ stars: 4 }),
    });
    await expect(
      hostRatesCleanerWell(reviews, {
        hostId: HOST,
        cleanerId: MARIA,
        shared,
      }),
    ).resolves.toBe(true);
    await expect(
      hostRatesCleanerWell(reviewsWith({}), {
        hostId: HOST,
        cleanerId: MARIA,
        shared,
      }),
    ).resolves.toBe(true);
    const otherSubject = reviewsWith({
      "job-1": review({ stars: 2, subjectId: "cleaner-ana" }),
    });
    await expect(
      hostRatesCleanerWell(otherSubject, {
        hostId: HOST,
        cleanerId: MARIA,
        shared,
      }),
    ).resolves.toBe(true);
  });
});

describe("correctionHints", () => {
  const session = (
    modelFilled: SessionCorrections["modelFilled"],
    hostChanged: SessionCorrections["hostChanged"],
  ): SessionCorrections => ({ modelFilled, hostChanged });

  it("hints fields corrected at least half the time, with two fills minimum", () => {
    const hints = correctionHints([
      session(["windowEnd", "date"], ["windowEnd"]),
      session(["windowEnd", "date"], ["windowEnd", "date"]),
      session(["address"], ["address"]),
    ]);
    // windowEnd: changed 2/2. date: changed 1/2. address: one fill only.
    expect(hints).toEqual(["date", "windowEnd"]);
  });

  it("ignores host changes the model never filled", () => {
    expect(
      correctionHints([
        session(["date"], ["price", "price"]),
        session(["date"], []),
      ]),
    ).toEqual([]);
  });
});

describe("buildHostMemory", () => {
  function stores(args: {
    jobs: Job[];
    user: User | null;
    reviews: Record<string, Review | null>;
    sessions: SessionCorrections[];
  }) {
    return {
      jobs: { listJobsByHost: vi.fn(async () => args.jobs) },
      users: { findById: vi.fn(async () => args.user) },
      reviews: {
        findReviewByJobAndAuthor: vi.fn(
          async (jobId: string) => args.reviews[jobId] ?? null,
        ),
      },
      sessions: { listFinishedByHost: vi.fn(async () => args.sessions) },
    };
  }

  it("combines history, shortcuts and hints", async () => {
    const jobs = [
      job({ id: "job-1", createdAt: "2026-10-28T03:00:00.000Z" }),
      job({ id: "job-2", createdAt: "2026-10-27T03:00:00.000Z" }),
      job({ id: "job-3", createdAt: "2026-10-26T03:00:00.000Z" }),
    ];
    const memory = await buildHostMemory(
      stores({
        jobs,
        user: cleaner(),
        reviews: {},
        sessions: [
          { modelFilled: ["windowEnd"], hostChanged: ["windowEnd"] },
          { modelFilled: ["windowEnd"], hostChanged: ["windowEnd"] },
        ],
      }),
      HOST,
    );
    expect(memory.recentJobs.map((s) => s.address)).toEqual([
      "12 Ocean St, Bondi",
      "12 Ocean St, Bondi",
      "12 Ocean St, Bondi",
    ]);
    expect(memory.singleProperty?.address).toBe("12 Ocean St, Bondi");
    expect(memory.usualCleaner).toEqual({ id: MARIA, name: "Maria" });
    expect(memory.correctionHints).toEqual(["windowEnd"]);
  });

  it("drops the usual cleaner when the user is gone or badly rated", async () => {
    const jobs = [
      job({ id: "job-1" }),
      job({ id: "job-2" }),
      job({ id: "job-3" }),
    ];
    const gone = await buildHostMemory(
      stores({ jobs, user: null, reviews: {}, sessions: [] }),
      HOST,
    );
    expect(gone.usualCleaner).toBeNull();
    const badlyRated = await buildHostMemory(
      stores({
        jobs,
        user: cleaner(),
        reviews: {
          "job-1": {
            id: "r1",
            jobId: "job-1",
            authorId: HOST,
            subjectId: MARIA,
            stars: 2,
            comment: null,
            createdAt: NOW,
          },
        },
        sessions: [],
      }),
      HOST,
    );
    expect(badlyRated.usualCleaner).toBeNull();
  });
});
