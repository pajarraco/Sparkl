import {
  jobRequestActionInput,
  jobRequestSchema,
  jobSchema,
  listJobRequestsForJobInput,
  listJobRequestsForJobOutput,
  listMyJobRequestsOutput,
  offerJobInput,
  requestJobInput,
} from "@sparkl/shared";
import type { UserRole } from "@sparkl/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  drizzleJobRequestsStore,
  drizzleJobsStore,
  drizzleUsersStore,
  systemClock,
} from "../../db/stores.js";
import * as jobRequestsService from "../../services/job-requests.js";
import { authedProcedure, router } from "../trpc.js";

function requireRole(role: UserRole | null): asserts role is UserRole {
  if (!role) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Role missing from session.",
    });
  }
}

export const jobRequestsRouter = router({
  request: authedProcedure
    .input(requestJobInput)
    .output(jobRequestSchema)
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.role);
      return jobRequestsService.requestJob(
        {
          jobs: drizzleJobsStore(ctx.db),
          users: drizzleUsersStore(ctx.db),
          requests: drizzleJobRequestsStore(ctx.db),
        },
        systemClock,
        { ...input, cleanerId: ctx.sessionUserId, cleanerRole: ctx.role },
      );
    }),

  offer: authedProcedure
    .input(offerJobInput)
    .output(jobRequestSchema)
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.role);
      return jobRequestsService.offerJob(
        {
          jobs: drizzleJobsStore(ctx.db),
          users: drizzleUsersStore(ctx.db),
          requests: drizzleJobRequestsStore(ctx.db),
        },
        systemClock,
        { ...input, hostId: ctx.sessionUserId, hostRole: ctx.role },
      );
    }),

  accept: authedProcedure
    .input(jobRequestActionInput)
    .output(z.object({ job: jobSchema, request: jobRequestSchema }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.role);
      return jobRequestsService.acceptJobRequest(
        {
          jobs: drizzleJobsStore(ctx.db),
          users: drizzleUsersStore(ctx.db),
          requests: drizzleJobRequestsStore(ctx.db),
        },
        systemClock,
        {
          requestId: input.requestId,
          actorId: ctx.sessionUserId,
          actorRole: ctx.role,
        },
      );
    }),

  decline: authedProcedure
    .input(jobRequestActionInput)
    .output(jobRequestSchema)
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.role);
      return jobRequestsService.declineJobRequest(
        {
          jobs: drizzleJobsStore(ctx.db),
          users: drizzleUsersStore(ctx.db),
          requests: drizzleJobRequestsStore(ctx.db),
        },
        systemClock,
        {
          requestId: input.requestId,
          actorId: ctx.sessionUserId,
          actorRole: ctx.role,
        },
      );
    }),

  withdraw: authedProcedure
    .input(jobRequestActionInput)
    .output(jobRequestSchema)
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.role);
      return jobRequestsService.withdrawJobRequest(
        {
          jobs: drizzleJobsStore(ctx.db),
          users: drizzleUsersStore(ctx.db),
          requests: drizzleJobRequestsStore(ctx.db),
        },
        systemClock,
        {
          requestId: input.requestId,
          actorId: ctx.sessionUserId,
          actorRole: ctx.role,
        },
      );
    }),

  // Host's Requests section on Job Detail: pending requests and offers on
  // one job, each with the cleaner's public summary.
  listForJob: authedProcedure
    .input(listJobRequestsForJobInput)
    .output(listJobRequestsForJobOutput)
    .query(async ({ ctx, input }) => {
      return jobRequestsService.listRequestsForJob(
        {
          jobs: drizzleJobsStore(ctx.db),
          users: drizzleUsersStore(ctx.db),
          requests: drizzleJobRequestsStore(ctx.db),
        },
        { jobId: input.jobId, hostId: ctx.sessionUserId },
      );
    }),

  // Cleaner's own pending requests/offers (My Jobs "Offers" section).
  listMine: authedProcedure
    .output(listMyJobRequestsOutput)
    .query(async ({ ctx }) => {
      requireRole(ctx.role);
      return jobRequestsService.listMyJobRequests(
        {
          jobs: drizzleJobsStore(ctx.db),
          requests: drizzleJobRequestsStore(ctx.db),
        },
        { cleanerId: ctx.sessionUserId, cleanerRole: ctx.role },
      );
    }),
});
