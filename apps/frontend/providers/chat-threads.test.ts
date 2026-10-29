import type { ChatThread } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import { formatThreadTime, threadPreviewLine } from "./chat-threads";
import { getStrings } from "./i18n";

const strings = getStrings().messages;

function thread(overrides: Partial<ChatThread> = {}): ChatThread {
  return {
    jobId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    jobStatus: "claimed",
    address: "12 Demo Lane",
    windowStart: "2026-02-01T10:00:00.000Z",
    otherParty: { id: "cleaner-1", name: "Demo Cleaner", photoUrl: null },
    lastMessage: {
      senderId: "cleaner-1",
      preview: "See you Friday",
      createdAt: "2026-02-01T09:00:00.000Z",
    },
    lastActivityAt: "2026-02-01T09:00:00.000Z",
    ...overrides,
  };
}

describe("threadPreviewLine", () => {
  it("shows the other party's message as is", () => {
    expect(threadPreviewLine(thread(), "host-1")).toBe("See you Friday");
  });

  it("prefixes the viewer's own message", () => {
    expect(threadPreviewLine(thread(), "cleaner-1")).toBe(
      `${strings.you}: See you Friday`,
    );
  });

  it("invites a first message when nobody has written", () => {
    expect(threadPreviewLine(thread({ lastMessage: null }), "host-1")).toBe(
      strings.noMessageYet,
    );
  });
});

describe("formatThreadTime", () => {
  it("shows the time for today", () => {
    expect(
      formatThreadTime("2026-02-01T09:05:00.000Z", "2026-02-01T18:00:00.000Z"),
    ).toBe("9:05 AM");
  });

  it("shows the date for earlier days", () => {
    expect(
      formatThreadTime("2026-01-28T09:05:00.000Z", "2026-02-01T18:00:00.000Z"),
    ).toBe("Jan 28");
  });
});
