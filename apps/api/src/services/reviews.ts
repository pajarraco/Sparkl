// Framework-free business logic: no drizzle/fastify imports allowed here.
// Mutual reviews once a job is completed: each party rates the other once
// per job. Creating a review recomputes the subject's average rating.
import { randomUUID } from "node:crypto";
import type {
  CreateReviewInput,
  ListReviewsInput,
  MyReviewForJobInput,
  Review,
  SparklErrorCode,
  UserRole,
} from "@sparkl/shared";
import type { Clock, JobsStore } from "./jobs.js";
import type { UsersStore } from "./users.js";

export class ReviewsError extends Error {
  readonly code: SparklErrorCode;

  constructor(code: SparklErrorCode, message: string) {
    super(message);
    this.name = "ReviewsError";
    this.code = code;
  }
}

export interface ReviewsStore {
  findReviewByJobAndAuthor(
    jobId: string,
    authorId: string,
  ): Promise<Review | null>;
  insertReview(review: Review): Promise<Review>;
  listReviewsBySubject(subjectId: string): Promise<Review[]>;
}

export interface ReviewStores {
  jobs: Pick<JobsStore, "findJobById">;
  users: Pick<UsersStore, "update">;
  reviews: ReviewsStore;
}

export async function createReview(
  stores: ReviewStores,
  clock: Clock,
  args: CreateReviewInput & { authorId: string; authorRole: UserRole },
): Promise<Review> {
  if (args.authorRole !== "host" && args.authorRole !== "cleaner") {
    throw new ReviewsError("FORBIDDEN", "Only hosts and cleaners can review.");
  }
  const job = await stores.jobs.findJobById(args.jobId);
  if (job === null) throw new ReviewsError("NOT_FOUND", "Job not found.");
  if (job.status !== "completed") {
    throw new ReviewsError(
      "REVIEW_NOT_ALLOWED",
      "Reviews are only allowed on completed jobs.",
    );
  }
  const parties = [job.hostId, job.claimedByCleanerId];
  if (!parties.includes(args.authorId)) {
    throw new ReviewsError(
      "NOT_JOB_PARTY",
      "Only a party to the job can review it.",
    );
  }
  if (args.subjectId === args.authorId || !parties.includes(args.subjectId)) {
    throw new ReviewsError(
      "FORBIDDEN",
      "You can only review the other party to the job.",
    );
  }
  const existing = await stores.reviews.findReviewByJobAndAuthor(
    args.jobId,
    args.authorId,
  );
  if (existing !== null) {
    throw new ReviewsError(
      "REVIEW_DUPLICATE",
      "You have already reviewed this job.",
    );
  }
  const saved = await stores.reviews.insertReview({
    id: randomUUID(),
    jobId: args.jobId,
    authorId: args.authorId,
    subjectId: args.subjectId,
    stars: args.stars,
    comment: args.comment ?? null,
    createdAt: clock.nowIso(),
  });
  const received = await stores.reviews.listReviewsBySubject(args.subjectId);
  const total = received.reduce((sum, r) => sum + r.stars, 0);
  const updated = await stores.users.update(args.subjectId, {
    avgRating: Math.round((total / Math.max(1, received.length)) * 100) / 100,
  });
  if (updated === null)
    throw new ReviewsError("NOT_FOUND", "Review subject not found.");
  return saved;
}

export async function listReviewsBySubject(
  stores: Pick<ReviewStores, "reviews">,
  args: ListReviewsInput,
): Promise<{ reviews: Review[]; total: number }> {
  const all = [
    ...(await stores.reviews.listReviewsBySubject(args.subjectId)),
  ].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
  return {
    reviews: all.slice(args.offset, args.offset + args.limit),
    total: all.length,
  };
}

// The caller's own review of a job (author = session user), or null before
// they have reviewed it.
export async function getMyReviewForJob(
  stores: Pick<ReviewStores, "reviews">,
  args: MyReviewForJobInput & { authorId: string },
): Promise<{ review: Review | null }> {
  const review = await stores.reviews.findReviewByJobAndAuthor(
    args.jobId,
    args.authorId,
  );
  return { review };
}
