import { z } from "zod";
import { jobStatusSchema } from "./lifecycle";
import { userIdSchema } from "./users";

// DB row: messages(id, job_id, sender_id, body, created_at).
export const messageSchema = z
  .object({
    id: z.string().uuid(),
    jobId: z.string().uuid(),
    senderId: userIdSchema,
    body: z.string().trim().min(1).max(2000),
    createdAt: z.string().datetime(),
  })
  .strict();

export type Message = z.infer<typeof messageSchema>;

// chat.send input: senderId comes from the session, never the client.
export const sendMessageInputSchema = z
  .object({
    jobId: z.string().uuid(),
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

// chat.list input: chronological history (oldest first) with paging.
export const listMessagesInputSchema = z
  .object({
    jobId: z.string().uuid(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .strict();

export type ListMessagesInput = z.infer<typeof listMessagesInputSchema>;

export const listMessagesOutputSchema = z
  .object({
    messages: z.array(messageSchema),
    total: z.number().int().min(0),
  })
  .strict();

export type ListMessagesOutput = z.infer<typeof listMessagesOutputSchema>;

// chat.onMessage input: lastEventId is the last tracked message id the
// client received; the server replays anything newer, then streams live.
export const onMessageInputSchema = z
  .object({
    jobId: z.string().uuid(),
    lastEventId: z.string().uuid().nullish(),
  })
  .strict();

export type OnMessageInput = z.infer<typeof onMessageInputSchema>;

// chat.listThreads (Messages tab): one row per job the caller is a party
// to, with the other party and a short preview of the latest message.
// Rows come newest activity first. lastMessage is null when nobody has
// written yet; lastActivityAt then falls back to the job's last update.
export const CHAT_PREVIEW_MAX = 80;

export const chatThreadSchema = z
  .object({
    jobId: z.string().uuid(),
    jobStatus: jobStatusSchema,
    address: z.string().min(1).max(500),
    windowStart: z.string().datetime(),
    otherParty: z
      .object({
        id: userIdSchema,
        name: z.string().min(1).max(100),
        photoUrl: z.string().url().max(2048).nullable(),
      })
      .strict(),
    lastMessage: z
      .object({
        senderId: userIdSchema,
        preview: z.string().min(1).max(CHAT_PREVIEW_MAX),
        createdAt: z.string().datetime(),
      })
      .strict()
      .nullable(),
    lastActivityAt: z.string().datetime(),
  })
  .strict();

export type ChatThread = z.infer<typeof chatThreadSchema>;

export const listThreadsOutputSchema = z
  .object({
    threads: z.array(chatThreadSchema),
  })
  .strict();

export type ListThreadsOutput = z.infer<typeof listThreadsOutputSchema>;
