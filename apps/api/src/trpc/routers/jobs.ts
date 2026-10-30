import {
  cancelJobInput,
  claimJobInput,
  createJobInput,
  listOpenJobsInput,
  myJobsInput,
  rankJobsOutputSchema,
  transitionJobInput,
} from "@sparkl/shared";
import { TRPCError } from "@trpc/server";
import {
  drizzleJobRequestsStore,
  drizzleJobsStore,
  drizzleMessagesRead,
  drizzleUsersStore,
  systemClock,
} from "../../db/stores.js";
import * as jobRequestsService from "../../services/job-requests.js";
import * as jobsService from "../../services/jobs.js";
import * as matchingService from "../../services/matching.js";
import { authedProcedure, router } from "../trpc.js";
import { rankingFlags } from "./suggestions.js";

export const jobsRouter = router({
  create: authedProcedure
    .input(createJobInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.role)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Role missing from session.",
        });
      return jobsService.createJob(drizzleJobsStore(ctx.db), systemClock, {
        hostId: ctx.sessionUserId,
        hostRole: ctx.role,
        input,
      });
    }),

  listOpen: authedProcedure
    .input(listOpenJobsInput)
    .query(async ({ ctx, input }) => {
      return jobsService.listOpenJobs(drizzleJobsStore(ctx.db), input);
    }),

  myJobs: authedProcedure.input(myJobsInput).query(async ({ ctx, input }) => {
    return jobsService.listMyJobs(drizzleJobsStore(ctx.db), {
      hostId: ctx.sessionUserId,
      input,
    });
  }),

  // Cleaner My Jobs: jobs the caller claimed, newest first. The cleaner
  // role is re-checked inside the service.
  myClaimed: authedProcedure
    .input(myJobsInput)
    .query(async ({ ctx, input }) => {
      if (!ctx.role)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Role missing from session.",
        });
      return jobsService.listMyClaimedJobs(drizzleJobsStore(ctx.db), {
        cleanerId: ctx.sessionUserId,
        cleanerRole: ctx.role,
        input,
      });
    }),

  // Cleaners only; enforced again inside the service. Hosts and strangers fail.
  claim: authedProcedure
    .input(claimJobInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.role)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Role missing from session.",
        });
      return jobsService.claimJob(drizzleJobsStore(ctx.db), systemClock, {
        ...input,
        cleanerId: ctx.sessionUserId,
        cleanerRole: ctx.role,
      });
    }),

  // Right party enforced inside the service: cleaner starts, host completes.
  transition: authedProcedure
    .input(transitionJobInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.role)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Role missing from session.",
        });
      return jobsService.transitionJob(
        drizzleJobsStore(ctx.db),
        systemClock,
        {
          ...input,
          actorId: ctx.sessionUserId,
          actorRole: ctx.role,
        },
        drizzleUsersStore(ctx.db),
      );
    }),

  // Host only; enforced inside the service.
  cancel: authedProcedure
    .input(cancelJobInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.role)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Role missing from session.",
        });
      const job = await jobsService.cancelJob(
        drizzleJobsStore(ctx.db),
        systemClock,
        {
          ...input,
          actorId: ctx.sessionUserId,
          actorRole: ctx.role,
        },
        drizzleUsersStore(ctx.db),
      );
      // A cancelled job never reaches claimed, so any pending request or
      // offer on it is closed rather than left dangling.
      await jobRequestsService.closePendingForCancelledJob(
        { requests: drizzleJobRequestsStore(ctx.db) },
        job.id,
      );
      return job;
    }),

  // Cleaner board: ranked by match instead of newest-first. Scoring lives in
  // the matching service; the cleaner role is re-checked there.
  listRanked: authedProcedure
    .input(listOpenJobsInput)
    .output(rankJobsOutputSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.role)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Role missing from session.",
        });
      return matchingService.rankJobsForCleaner(
        {
          jobs: drizzleJobsStore(ctx.db),
          users: drizzleUsersStore(ctx.db),
          messages: drizzleMessagesRead(ctx.db),
        },
        rankingFlags(),
        {
          ...input,
          cleanerId: ctx.sessionUserId,
          cleanerRole: ctx.role,
        },
      );
    }),
});
