import { transcribeInput, transcribeOutput } from "@sparkl/shared";
import { getVoiceService } from "../../services/voice.js";
import { authedProcedure, router } from "../trpc.js";

// Voice transcription for the Post-tab assistant's mic button. Audio is
// never stored; this router only forwards to the service.
export const voiceRouter = router({
  transcribe: authedProcedure
    .input(transcribeInput)
    .output(transcribeOutput)
    .mutation(({ ctx, input }) =>
      getVoiceService().transcribe(ctx.sessionUserId, input),
    ),
});
