import type { Message } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  formatChatTime,
  isOwnMessage,
  mergeChatMessages,
  validateChatDraft,
} from "./chat-thread";

const JOB_ID = "22222222-2222-2222-2222-222222222222";
const HOST_ID = "11111111-1111-1111-1111-111111111111";
const CLEANER_ID = "33333333-3333-3333-3333-333333333333";

function makeMessage(overrides: Partial<Message> & { id: string }): Message {
  return {
    jobId: JOB_ID,
    senderId: HOST_ID,
    body: "Hello",
    createdAt: "2026-11-07T14:05:00.000Z",
    ...overrides,
  };
}

describe("validateChatDraft", () => {
  it("rejects empty and blank drafts", () => {
    expect(validateChatDraft("")).toBe("This field is required.");
    expect(validateChatDraft("   ")).toBe("This field is required.");
    expect(validateChatDraft(undefined)).toBe("This field is required.");
  });

  it("accepts a normal draft", () => {
    expect(validateChatDraft("Running 10 minutes late")).toBe(null);
  });

  it("rejects drafts over the shared 2000-character limit", () => {
    expect(validateChatDraft(`x${"y".repeat(2000)}`)).not.toBe(null);
    expect(validateChatDraft("ok")).toBe(null);
  });
});

describe("isOwnMessage", () => {
  it("matches the sender against the session user", () => {
    const message = makeMessage({ id: "a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1" });
    expect(isOwnMessage(message, HOST_ID)).toBe(true);
    expect(isOwnMessage(message, CLEANER_ID)).toBe(false);
  });

  it("is never own without a session user", () => {
    const message = makeMessage({ id: "b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2" });
    expect(isOwnMessage(message, null)).toBe(false);
    expect(isOwnMessage(message, undefined)).toBe(false);
  });
});

describe("mergeChatMessages", () => {
  it("dedupes reconnect replays and sorts oldest-first", () => {
    const first = makeMessage({
      id: "c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3",
      createdAt: "2026-11-07T14:05:00.000Z",
    });
    const second = makeMessage({
      id: "d4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4",
      senderId: CLEANER_ID,
      body: "On my way",
      createdAt: "2026-11-07T14:06:00.000Z",
    });
    const merged = mergeChatMessages([second, first], [first, second]);
    expect(merged.map((message) => message.id)).toEqual([first.id, second.id]);
  });

  it("keeps live-only messages", () => {
    const live = makeMessage({
      id: "e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5",
      createdAt: "2026-11-07T14:07:00.000Z",
    });
    expect(mergeChatMessages([], [live])).toEqual([live]);
  });
});

describe("formatChatTime", () => {
  it("renders UTC hours and minutes", () => {
    expect(formatChatTime("2026-11-07T14:05:00.000Z")).toBe("2:05 PM");
  });
});
