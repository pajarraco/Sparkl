import { z } from "zod";

// DB row: messages(id, job_id, sender_id, body, created_at).
export const messageSchema = z
  .object({
    id: z.string().uuid(),
    jobId: z.string().uuid(),
    senderId: z.string().uuid(),
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
