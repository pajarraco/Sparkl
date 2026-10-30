import {
  createReviewInputSchema,
  listReviewsInputSchema,
  listReviewsOutputSchema,
  myReviewForJobInputSchema,
  myReviewForJobOutputSchema,
  reviewSchema,
} from "@sparkl/shared";
import { TRPCError } from "@trpc/server";
import {
  drizzleJobsStore,
  drizzleReviewsStore,
  drizzleUsersStore,
  systemClock,
} from "../../db/stores.js";
import * as reviewsService from "../../services/reviews.js";
import { authedProcedure, publicProcedure, router } from "../trpc.js";

export const reviewsRouter = router({
  // Mutual reviews once the job is completed; the service enforces
  // completed-only, one review per (job, author), and other-party subjects.
  create: authedProcedure
    .input(createReviewInputSchema)
    .output(reviewSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.role)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Role missing from session.",
        });
      return reviewsService.createReview(
        {
          jobs: drizzleJobsStore(ctx.db),
          users: drizzleUsersStore(ctx.db),
          reviews: drizzleReviewsStore(ctx.db),
        },
        systemClock,
        {
          ...input,
          authorId: ctx.sessionUserId,
          authorRole: ctx.role,
        },
      );
    }),

  // The caller's own review of a job, so Leave Review can show what was sent.
  mineForJob: authedProcedure
    .input(myReviewForJobInputSchema)
    .output(myReviewForJobOutputSchema)
    .query(async ({ ctx, input }) => {
      return reviewsService.getMyReviewForJob(
        { reviews: drizzleReviewsStore(ctx.db) },
        { ...input, authorId: ctx.sessionUserId },
      );
    }),

  // Public: reviews feed the trust rows on job cards and public profiles.
  listBySubject: publicProcedure
    .input(listReviewsInputSchema)
    .output(listReviewsOutputSchema)
    .query(async ({ ctx, input }) => {
      return reviewsService.listReviewsBySubject(
        { reviews: drizzleReviewsStore(ctx.db) },
        input,
      );
    }),
});
