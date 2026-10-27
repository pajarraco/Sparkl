import {
  cancelJobInput,
  claimJobInput,
  createJobInput,
  listOpenJobsInput,
  myJobsInput,
  transitionJobInput,
} from "@sparkl/shared";
import { TRPCError } from "@trpc/server";
import { drizzleJobsStore, systemClock } from "../../db/stores.js";
import * as jobsService from "../../services/jobs.js";
import { authedProcedure, router } from "../trpc.js";

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
      return jobsService.transitionJob(drizzleJobsStore(ctx.db), systemClock, {
        ...input,
        actorId: ctx.sessionUserId,
        actorRole: ctx.role,
      });
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
      return jobsService.cancelJob(drizzleJobsStore(ctx.db), systemClock, {
        ...input,
        actorId: ctx.sessionUserId,
        actorRole: ctx.role,
      });
    }),
});
