import {
  assistantFinishInput,
  assistantTurnInput,
  assistantTurnOutput,
} from "@sparkl/shared";
import {
  drizzleAssistantSessionsStore,
  drizzleJobsStore,
  drizzleReviewsStore,
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
    .mutation(({ ctx, input }) => {
      const sessions = drizzleAssistantSessionsStore(ctx.db);
      return getJobAssistant().turn(ctx.sessionUserId, input, {
        sessions,
        memory: {
          jobs: drizzleJobsStore(ctx.db),
          users: drizzleUsersStore(ctx.db),
          reviews: drizzleReviewsStore(ctx.db),
          sessions,
        },
        pricing: drizzleJobsStore(ctx.db),
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
