import { assistantTurnInput, assistantTurnOutput } from "@sparkl/shared";
import { getJobAssistant } from "../../services/job-assistant.js";
import { roleProcedure, router } from "../trpc.js";

// Post-tab chat assistant. A mutation, so the transcript travels in the
// POST body and never in a logged URL. Logs carry turn metadata only.
export const jobAssistantRouter = router({
  turn: roleProcedure("host")
    .input(assistantTurnInput)
    .output(assistantTurnOutput)
    .mutation(({ ctx, input }) =>
      getJobAssistant().turn(ctx.sessionUserId, input, {
        onTurn: (event) =>
          ctx.req.log.info({ assistantTurn: event }, "assistant turn"),
      }),
    ),
});
