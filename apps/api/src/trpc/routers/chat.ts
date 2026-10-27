import {
  listMessagesInputSchema,
  listMessagesOutputSchema,
  messageSchema,
  onMessageInputSchema,
  sendMessageInputSchema,
} from "@sparkl/shared";
import { TRPCError } from "@trpc/server";
import {
  drizzleChatStore,
  drizzleJobsStore,
  systemClock,
} from "../../db/stores.js";
import * as chatService from "../../services/chat.js";
import { authedProcedure, router } from "../trpc.js";

// Single API instance in MVP: one in-process event hub. If the API ever
// scales horizontally, replace this with a Redis-backed ChatEvents.
const chatEvents = chatService.createChatEvents();

export const chatRouter = router({
  send: authedProcedure
    .input(sendMessageInputSchema)
    .output(messageSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.role)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Role missing from session.",
        });
      return chatService.sendMessage(
        {
          jobs: drizzleJobsStore(ctx.db),
          chat: drizzleChatStore(ctx.db),
        },
        systemClock,
        chatEvents,
        {
          ...input,
          senderId: ctx.sessionUserId,
          senderRole: ctx.role,
        },
      );
    }),

  list: authedProcedure
    .input(listMessagesInputSchema)
    .output(listMessagesOutputSchema)
    .query(async ({ ctx, input }) => {
      return chatService.listMessages(
        {
          jobs: drizzleJobsStore(ctx.db),
          chat: drizzleChatStore(ctx.db),
        },
        {
          ...input,
          userId: ctx.sessionUserId,
        },
      );
    }),

  // Server-sent events over the existing HTTP transport (no WebSocket
  // adapter needed): listen first, then verify the party and replay
  // anything missed since lastEventId, then stream live.
  //
  // Note: tRPC v11 types do not compose .output() with async-generator
  // resolvers (the output parser forces a MaybePromise return), so each
  // event is validated inline with messageSchema.parse instead — the
  // inferred subscription output is still Message.
  onMessage: authedProcedure
    .input(onMessageInputSchema)
    .subscription(async function* (opts) {
      if (!opts.ctx.role)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Role missing from session.",
        });
      const live = chatEvents.iterate(opts.input.jobId, opts.signal);
      await chatService.assertJobParty(
        { jobs: drizzleJobsStore(opts.ctx.db) },
        { jobId: opts.input.jobId, userId: opts.ctx.sessionUserId },
      );
      const missed = await chatService.listNewMessagesSince(
        drizzleChatStore(opts.ctx.db),
        {
          jobId: opts.input.jobId,
          lastEventId: opts.input.lastEventId ?? null,
        },
      );
      for (const message of missed) {
        yield messageSchema.parse(message);
      }
      for await (const message of live) {
        yield messageSchema.parse(message);
      }
    }),
});
