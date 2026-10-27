import type { Message } from "@sparkl/shared";
import { getStrings } from "./i18n";

// Pure helpers for the per-job chat thread (rules.md: no logic in
// components). History arrives from chat.list while live messages stream
// in over the chat.onMessage SSE subscription; the two overlap whenever
// the socket reconnects, so rendering merges by id and sorts
// oldest-first. Timestamps render in UTC like the other job formatters
// in my-jobs.ts.

export const CHAT_DRAFT_MAX_LENGTH = 2000;

export function validateChatDraft(body: unknown): string | null {
  const strings = getStrings();
  if (typeof body !== "string" || body.trim() === "") {
    return strings.errors.requiredField;
  }
  if (body.trim().length > CHAT_DRAFT_MAX_LENGTH) {
    return strings.errors.generic;
  }
  return null;
}

export function isOwnMessage(
  message: Pick<Message, "senderId">,
  currentUserId: string | null | undefined,
): boolean {
  if (currentUserId === null || currentUserId === undefined) return false;
  return message.senderId === currentUserId;
}

export function mergeChatMessages(
  history: Message[],
  live: Message[],
): Message[] {
  const byId = new Map<string, Message>();
  for (const message of history) byId.set(message.id, message);
  for (const message of live) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
}

const chatTimeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatChatTime(iso: string): string {
  return chatTimeFormat.format(new Date(iso));
}
