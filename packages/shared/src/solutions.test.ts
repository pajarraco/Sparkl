import { describe, expect, it } from "vitest";
import { assistantTurnOutput } from "./job-assistant";
import {
  SOLUTION_KINDS,
  SOLUTION_MAX_CHECKLIST_ITEMS,
  SOLUTION_MAX_CHECKLIST_ITEM_CHARS,
  SOLUTION_MAX_FAQ_ANSWER_CHARS,
  SOLUTION_MAX_FAQ_QUESTION_CHARS,
  SOLUTION_PAYLOAD_SCHEMAS,
  SOLUTION_RANKING_CONFIG,
  SOLUTION_TAGS,
  SOLUTION_WRITERS,
  assistantFeedbackInput,
  checklistPayloadSchema,
  faqPayloadSchema,
  offerPreferencePayloadSchema,
  solutionKindSchema,
  solutionProposalSchema,
  solutionTagSchema,
  windowPreferencePayloadSchema,
} from "./solutions";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("solution kinds and tags", () => {
  it("should keep the four kinds from the 04 plan, and no access notes", () => {
    expect(SOLUTION_KINDS).toEqual([
      "checklist",
      "window_preference",
      "offer_preference",
      "faq",
    ]);
    expect(solutionKindSchema.safeParse("access_notes").success).toBe(false);
  });

  it("should accept only tags from the closed list", () => {
    expect(solutionTagSchema.parse("turnover")).toBe("turnover");
    expect(solutionTagSchema.safeParse("lockbox 1234").success).toBe(false);
    expect(SOLUTION_TAGS).toContain("large_home");
  });

  it("should give the model only checklists and window preferences", () => {
    expect(SOLUTION_WRITERS.model).toEqual(["checklist", "window_preference"]);
    expect(SOLUTION_WRITERS.service).toEqual(["offer_preference"]);
    expect(SOLUTION_WRITERS.seed).toEqual(["checklist", "faq"]);
    expect(SOLUTION_WRITERS.model).not.toContain("faq");
  });
});

describe("checklist payload", () => {
  it("should accept up to 12 items of up to 80 characters", () => {
    const items = Array(SOLUTION_MAX_CHECKLIST_ITEMS).fill("Wipe the hob");
    expect(checklistPayloadSchema.parse({ items }).items).toHaveLength(12);
  });

  it("should reject 13 items", () => {
    const items = Array(SOLUTION_MAX_CHECKLIST_ITEMS + 1).fill("Wipe");
    expect(checklistPayloadSchema.safeParse({ items }).success).toBe(false);
  });

  it("should reject an item over 80 characters", () => {
    const items = ["x".repeat(SOLUTION_MAX_CHECKLIST_ITEM_CHARS + 1)];
    expect(checklistPayloadSchema.safeParse({ items }).success).toBe(false);
  });

  it("should reject an empty list and blank items", () => {
    expect(checklistPayloadSchema.safeParse({ items: [] }).success).toBe(false);
    expect(checklistPayloadSchema.safeParse({ items: ["   "] }).success).toBe(
      false,
    );
  });

  it("should reject extra keys", () => {
    expect(
      checklistPayloadSchema.safeParse({ items: ["Mop"], lockbox: "1234" })
        .success,
    ).toBe(false);
  });
});

describe("window preference payload", () => {
  it("should accept a weekday with HH:MM times", () => {
    expect(
      windowPreferencePayloadSchema.parse({
        weekday: 2,
        start: "09:00",
        end: "12:30",
      }),
    ).toEqual({ weekday: 2, start: "09:00", end: "12:30" });
  });

  it("should reject a weekday out of 0-6 and a bad time", () => {
    expect(
      windowPreferencePayloadSchema.safeParse({
        weekday: 7,
        start: "09:00",
        end: "12:00",
      }).success,
    ).toBe(false);
    expect(
      windowPreferencePayloadSchema.safeParse({
        weekday: 1,
        start: "9am",
        end: "12:00",
      }).success,
    ).toBe(false);
  });
});

describe("offer preference payload", () => {
  it("should accept only the computed offers", () => {
    expect(offerPreferencePayloadSchema.parse({ offer: "price_hint" })).toEqual(
      { offer: "price_hint" },
    );
    expect(
      offerPreferencePayloadSchema.safeParse({
        offer: "free_cleaning",
      }).success,
    ).toBe(false);
  });
});

describe("faq payload", () => {
  it("should cap the question and answer lengths", () => {
    expect(
      faqPayloadSchema.safeParse({
        question: "q".repeat(SOLUTION_MAX_FAQ_QUESTION_CHARS),
        answer: "a".repeat(SOLUTION_MAX_FAQ_ANSWER_CHARS),
      }).success,
    ).toBe(true);
    expect(
      faqPayloadSchema.safeParse({
        question: "q".repeat(SOLUTION_MAX_FAQ_QUESTION_CHARS + 1),
        answer: "a",
      }).success,
    ).toBe(false);
    expect(
      faqPayloadSchema.safeParse({
        question: "q",
        answer: "a".repeat(SOLUTION_MAX_FAQ_ANSWER_CHARS + 1),
      }).success,
    ).toBe(false);
  });
});

describe("SOLUTION_PAYLOAD_SCHEMAS", () => {
  it("should have a payload schema for every kind", () => {
    for (const kind of SOLUTION_KINDS) {
      expect(SOLUTION_PAYLOAD_SCHEMAS[kind]).toBeDefined();
    }
  });
});

describe("SOLUTION_RANKING_CONFIG", () => {
  it("should cap the saves per session and the tool result size", () => {
    expect(SOLUTION_RANKING_CONFIG.maxSavesPerSession).toBe(3);
    expect(SOLUTION_RANKING_CONFIG.toolResultMaxChars).toBe(1500);
    expect(SOLUTION_RANKING_CONFIG.topK).toBe(3);
  });

  it("should need 3 distinct hosts before sharing", () => {
    expect(SOLUTION_RANKING_CONFIG.sharingMinHosts).toBe(3);
  });
});

describe("assistantFeedbackInput", () => {
  it("should accept a chip vote for a proposal", () => {
    expect(
      assistantFeedbackInput.parse({
        sessionId: UUID,
        proposalId: UUID,
        vote: "accepted",
      }),
    ).toEqual({ sessionId: UUID, proposalId: UUID, vote: "accepted" });
  });

  it("should reject other votes and extra keys", () => {
    expect(
      assistantFeedbackInput.safeParse({
        sessionId: UUID,
        proposalId: UUID,
        vote: "maybe",
      }).success,
    ).toBe(false);
    expect(
      assistantFeedbackInput.safeParse({
        sessionId: UUID,
        proposalId: UUID,
        vote: "rejected",
        hostId: "other",
      }).success,
    ).toBe(false);
  });
});

describe("solutionProposalSchema", () => {
  it("should accept a labelled proposal and reject a bad kind", () => {
    expect(
      solutionProposalSchema.parse({
        id: UUID,
        kind: "checklist",
        label: "Turnover checklist",
      }).kind,
    ).toBe("checklist");
    expect(
      solutionProposalSchema.safeParse({
        id: UUID,
        kind: "access_notes",
        label: "Lockbox",
      }).success,
    ).toBe(false);
  });
});

describe("assistantTurnOutput proposals", () => {
  const base = {
    reply: "Hello",
    draft: {},
    missingFields: [],
    readyForReview: false,
    quickReplies: [],
    places: [],
    priceHint: null,
  };

  it("should still accept output without proposals", () => {
    expect(assistantTurnOutput.parse(base)).toEqual(base);
  });

  it("should accept proposals and reject more than topK", () => {
    const one = { id: UUID, kind: "faq", label: "Products" };
    expect(
      assistantTurnOutput.parse({ ...base, proposals: [one] }).proposals,
    ).toEqual([one]);
    const four = Array(SOLUTION_RANKING_CONFIG.topK + 1).fill(one);
    expect(
      assistantTurnOutput.safeParse({ ...base, proposals: four }).success,
    ).toBe(false);
  });
});
