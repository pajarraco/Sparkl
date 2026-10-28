import { z } from "zod";
import { userIdSchema } from "./users";

// DB row: reviews(id, job_id, author_id, subject_id, stars, comment).
// Uniqueness on (jobId, authorId) is a DB constraint + service check
// (REVIEW_DUPLICATE), not expressible in a row schema.
export const reviewSchema = z
  .object({
    id: z.string().uuid(),
    jobId: z.string().uuid(),
    authorId: userIdSchema,
    subjectId: userIdSchema,
    stars: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(1000).nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type Review = z.infer<typeof reviewSchema>;

// reviews.create input: authorId comes from the session (service verifies
// author is a job party and job is completed); an absent comment is
// `undefined` here and stored as `null` per code-standard.
export const createReviewInputSchema = z
  .object({
    jobId: z.string().uuid(),
    subjectId: userIdSchema,
    stars: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;

// reviews.listBySubject input: paged newest-first history for one user.
export const listReviewsInputSchema = z
  .object({
    subjectId: userIdSchema,
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
  })
  .strict();

export type ListReviewsInput = z.infer<typeof listReviewsInputSchema>;

export const listReviewsOutputSchema = z
  .object({
    reviews: z.array(reviewSchema),
    total: z.number().int().min(0),
  })
  .strict();

export type ListReviewsOutput = z.infer<typeof listReviewsOutputSchema>;
