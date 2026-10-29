import type { ChatThread } from "@sparkl/shared";
import { formatChatTime } from "./chat-thread";
import { getStrings } from "./i18n";

// Pure helpers for the Messages tab thread list (rules.md: no logic in
// components). Times use UTC like the chat thread, so rows and bubbles
// agree.

export function threadPreviewLine(
  thread: ChatThread,
  viewerId: string,
): string {
  const strings = getStrings().messages;
  const last = thread.lastMessage;
  if (last === null) return strings.noMessageYet;
  return last.senderId === viewerId
    ? `${strings.you}: ${last.preview}`
    : last.preview;
}

const threadDayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

// Today: the time ("9:05 AM"). Earlier: the day ("Jan 28").
export function formatThreadTime(iso: string, nowIso: string): string {
  if (iso.slice(0, 10) === nowIso.slice(0, 10)) return formatChatTime(iso);
  return threadDayFormat.format(new Date(iso));
}
