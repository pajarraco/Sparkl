import {
  RANKING_WEIGHTS_FLAG,
  suggestCleanersInput,
  suggestCleanersOutputSchema,
} from "@sparkl/shared";
import { TRPCError } from "@trpc/server";
import {
  drizzleJobsStore,
  drizzleMessagesRead,
  drizzleUsersStore,
} from "../../db/stores.js";
import * as matchingService from "../../services/matching.js";
import { authedProcedure, router } from "../trpc.js";

// Ranking weights live in one shared config object, switched by this flag
// (Unleash in production; RANKING_WEIGHTS_V2=1 locally) — no deploy to tune.
export function rankingFlags(): matchingService.RankingFlags {
  return {
    isEnabled: (flag: string) =>
      flag === RANKING_WEIGHTS_FLAG &&
      process.env.RANKING_WEIGHTS_V2 === "1",
  };
}

export const suggestionsRouter = router({
  // Host-only view; the service re-checks the caller owns the job.
  forJob: authedProcedure
    .input(suggestCleanersInput)
    .output(suggestCleanersOutputSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.role)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Role missing from session.",
        });
      return matchingService.suggestCleanersForJob(
        {
          jobs: drizzleJobsStore(ctx.db),
          users: drizzleUsersStore(ctx.db),
          messages: drizzleMessagesRead(ctx.db),
        },
        rankingFlags(),
        {
          ...input,
          hostId: ctx.sessionUserId,
          hostRole: ctx.role,
        },
      );
    }),
});
