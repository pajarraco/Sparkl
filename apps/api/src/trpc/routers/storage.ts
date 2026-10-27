import {
  getUploadUrlInputSchema,
  getUploadUrlOutputSchema,
} from "@sparkl/shared";
import { requestUploadUrl } from "../../services/storage.js";
import { createS3PresignedUploader } from "../../storage/s3.js";
import { authedProcedure, router } from "../trpc.js";

export const storageRouter = router({
  getUploadUrl: authedProcedure
    .input(getUploadUrlInputSchema)
    .output(getUploadUrlOutputSchema)
    .mutation(async ({ ctx, input }) => {
      return requestUploadUrl(
        { uploader: createS3PresignedUploader() },
        { userId: ctx.sessionUserId },
        input,
      );
    }),
});
