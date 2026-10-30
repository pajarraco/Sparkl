import {
  SOLUTION_RANKING_CONFIG,
  assistantFinishInput,
  assistantTurnInput,
  assistantTurnOutput,
} from "@sparkl/shared";
import {
  drizzleAssistantSessionsStore,
  drizzleJobsStore,
  drizzleReviewsStore,
  drizzleSolutionsStore,
  drizzleUsersStore,
  systemClock,
} from "../../db/stores.js";
import { finishAssistantSession } from "../../services/assistant-sessions.js";
import { getJobAssistant } from "../../services/job-assistant.js";
import { roleProcedure, router } from "../trpc.js";

// Post-tab chat assistant. Mutations, so the transcript travels in the
// POST body and never in a logged URL. Logs carry turn metadata only.
export const jobAssistantRouter = router({
  turn: roleProcedure("host")
    .input(assistantTurnInput)
    .output(assistantTurnOutput)
    .mutation(async ({ ctx, input }) => {
      const sessions = drizzleAssistantSessionsStore(ctx.db);
      const users = drizzleUsersStore(ctx.db);
      // A failed name read only drops one name from the personal-data check.
      const hostName = await users
        .findById(ctx.sessionUserId)
        .then((host) => host?.name ?? null)
        .catch(() => null);
      return getJobAssistant().turn(ctx.sessionUserId, input, {
        sessions,
        memory: {
          jobs: drizzleJobsStore(ctx.db),
          users,
          reviews: drizzleReviewsStore(ctx.db),
          sessions,
        },
        pricing: drizzleJobsStore(ctx.db),
        solutions: {
          store: drizzleSolutionsStore(ctx.db),
          hostName,
          // Session-wide cap, enforced by the database on each save.
          reserveSave: () =>
            sessions.reserveSolutionSave({
              id: input.sessionId,
              hostId: ctx.sessionUserId,
              max: SOLUTION_RANKING_CONFIG.maxSavesPerSession,
            }),
        },
        onTurn: (event) =>
          ctx.req.log.info({ assistantTurn: event }, "assistant turn"),
      });
    }),

  // Closes the session: outcome, the posted job, and the fields the host
  // changed on the review form.
  finish: roleProcedure("host")
    .input(assistantFinishInput)
    .mutation(({ ctx, input }) =>
      finishAssistantSession(
        {
          sessions: drizzleAssistantSessionsStore(ctx.db),
          jobs: drizzleJobsStore(ctx.db),
        },
        systemClock,
        { ...input, hostId: ctx.sessionUserId },
      ),
    ),
});
