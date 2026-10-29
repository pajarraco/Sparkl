import { describe, expect, it } from "vitest";
import {
  ASSISTANT_MAX_MESSAGE_CHARS,
  ASSISTANT_MAX_QUICK_REPLIES,
  ASSISTANT_MAX_TURNS,
  ASSISTANT_REQUIRED_FIELDS,
  JOB_DRAFT_FIELDS,
  assistantDraftPatchSchema,
  assistantFinishInput,
  assistantMessageSchema,
  assistantOutcomeSchema,
  assistantTurnInput,
  assistantTurnOutput,
  jobDraftFieldSchema,
  jobDraftSchema,
  priceHintSchema,
} from "./job-assistant";

describe("job-assistant", () => {
  describe("constants", () => {
    it("should have correct constants", () => {
      expect(ASSISTANT_MAX_TURNS).toBe(20);
      expect(ASSISTANT_MAX_MESSAGE_CHARS).toBe(1000);
      expect(ASSISTANT_MAX_QUICK_REPLIES).toBe(4);
    });

    it("should have correct job draft fields", () => {
      expect(JOB_DRAFT_FIELDS).toEqual([
        "address",
        "latitude",
        "longitude",
        "date",
        "windowStart",
        "windowEnd",
        "sizeSqm",
        "notes",
        "price",
      ]);
    });

    it("should have correct required fields", () => {
      expect(ASSISTANT_REQUIRED_FIELDS).toEqual([
        "address",
        "date",
        "windowStart",
        "windowEnd",
      ]);
    });
  });

  describe("jobDraftFieldSchema", () => {
    it("should validate valid fields", () => {
      expect(jobDraftFieldSchema.parse("address")).toBe("address");
      expect(jobDraftFieldSchema.parse("date")).toBe("date");
      expect(jobDraftFieldSchema.parse("windowStart")).toBe("windowStart");
      expect(jobDraftFieldSchema.parse("windowEnd")).toBe("windowEnd");
    });

    it("should reject invalid fields", () => {
      expect(() => jobDraftFieldSchema.parse("invalid")).toThrow();
    });
  });

  describe("jobDraftSchema", () => {
    it("should parse empty draft", () => {
      expect(jobDraftSchema.parse({})).toEqual({});
    });

    it("should parse valid draft", () => {
      const draft = {
        address: "123 Main St",
        date: "2026-10-30",
        windowStart: "09:00",
        windowEnd: "17:00",
        sizeSqm: "100",
        notes: "Some notes",
        price: "500",
      };
      expect(jobDraftSchema.parse(draft)).toEqual(draft);
    });

    it("should reject invalid date format", () => {
      expect(() => jobDraftSchema.parse({ date: "30/10/2026" })).toThrow();
    });

    it("should reject invalid time format", () => {
      expect(() => jobDraftSchema.parse({ windowStart: "24:00" })).toThrow();
    });

    it("should reject unknown keys", () => {
      expect(() => jobDraftSchema.parse({ unknownKey: "value" })).toThrow();
    });
  });

  describe("assistantDraftPatchSchema", () => {
    it("should reject invalid keys", () => {
      expect(() => assistantDraftPatchSchema.parse({ hostId: "x" })).toThrow();
      expect(() =>
        assistantDraftPatchSchema.parse({ status: "open" }),
      ).toThrow();
      expect(() => assistantDraftPatchSchema.parse({ price: "100" })).toThrow();
      expect(() =>
        assistantDraftPatchSchema.parse({ address: "1 A St" }),
      ).toThrow();
      expect(() =>
        assistantDraftPatchSchema.parse({ latitude: -33 }),
      ).toThrow();
    });

    it("should parse valid patch", () => {
      const patch = {
        date: "2026-10-30",
        windowStart: "10:00",
        windowEnd: "13:00",
        sizeSqm: 80,
        placeId: "osm:1",
      };
      expect(assistantDraftPatchSchema.parse(patch)).toEqual(patch);
    });

    it("should reject invalid sizeSqm", () => {
      expect(() => assistantDraftPatchSchema.parse({ sizeSqm: 0 })).toThrow();
    });
  });

  describe("assistantMessageSchema", () => {
    it("should parse valid message", () => {
      const message = { role: "user", content: "Hello" };
      expect(assistantMessageSchema.parse(message)).toEqual(message);
    });

    it("should reject message with too many chars", () => {
      const longContent = "a".repeat(1001);
      expect(() =>
        assistantMessageSchema.parse({ role: "user", content: longContent }),
      ).toThrow();
    });

    it("should reject message with only spaces", () => {
      expect(() =>
        assistantMessageSchema.parse({ role: "user", content: "   " }),
      ).toThrow();
    });
  });

  describe("assistantTurnInput", () => {
    const validInput = {
      sessionId: "11111111-1111-4111-8111-111111111111",
      messages: [{ role: "user", content: "Hello" }],
      draft: {},
      timeZone: "Australia/Sydney",
    };

    it("should parse valid input with one message", () => {
      expect(assistantTurnInput.parse(validInput)).toEqual(validInput);
    });

    it("should reject empty messages array", () => {
      expect(() =>
        assistantTurnInput.parse({ ...validInput, messages: [] }),
      ).toThrow();
    });

    it("should reject too many messages", () => {
      const messages = Array(ASSISTANT_MAX_TURNS + 1).fill({
        role: "user",
        content: "Hello",
      });
      expect(() =>
        assistantTurnInput.parse({ ...validInput, messages }),
      ).toThrow();
    });

    it("should reject when last message is from assistant", () => {
      const input = {
        ...validInput,
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" },
        ],
      };
      expect(() => assistantTurnInput.parse(input)).toThrow();
    });
  });

  describe("assistantTurnOutput", () => {
    it("should parse valid output with null priceHint and empty places", () => {
      const output = {
        reply: "Hello",
        draft: {},
        missingFields: [],
        readyForReview: false,
        quickReplies: [],
        places: [],
        priceHint: null,
      };
      expect(assistantTurnOutput.parse(output)).toEqual(output);
    });

    it("should reject too many quick replies", () => {
      const quickReplies = Array(ASSISTANT_MAX_QUICK_REPLIES + 1).fill("reply");
      expect(() =>
        assistantTurnOutput.parse({
          reply: "Hello",
          draft: {},
          missingFields: [],
          readyForReview: false,
          quickReplies,
          places: [],
          priceHint: null,
        }),
      ).toThrow();
    });
  });

  describe("assistantFinishInput", () => {
    it("should reject posted without jobId", () => {
      expect(() =>
        assistantFinishInput.parse({
          sessionId: "11111111-1111-4111-8111-111111111111",
          outcome: "posted",
          modelFilled: [],
          hostChanged: [],
        }),
      ).toThrow();
    });

    it("should reject abandoned with jobId", () => {
      expect(() =>
        assistantFinishInput.parse({
          sessionId: "11111111-1111-4111-8111-111111111111",
          outcome: "abandoned",
          jobId: "22222222-2222-4222-8222-222222222222",
          modelFilled: [],
          hostChanged: [],
        }),
      ).toThrow();
    });

    it("should parse posted with jobId", () => {
      const input = {
        sessionId: "11111111-1111-4111-8111-111111111111",
        outcome: "posted",
        jobId: "22222222-2222-4222-8222-222222222222",
        modelFilled: [],
        hostChanged: [],
      };
      expect(assistantFinishInput.parse(input)).toEqual(input);
    });

    it("should parse fell_back without jobId", () => {
      const input = {
        sessionId: "11111111-1111-4111-8111-111111111111",
        outcome: "fell_back",
        modelFilled: [],
        hostChanged: [],
      };
      expect(assistantFinishInput.parse(input)).toEqual(input);
    });

    it("should reject invalid hostChanged field", () => {
      expect(() =>
        assistantFinishInput.parse({
          sessionId: "11111111-1111-4111-8111-111111111111",
          outcome: "posted",
          jobId: "22222222-2222-4222-8222-222222222222",
          modelFilled: [],
          hostChanged: ["hostId"],
        }),
      ).toThrow();
    });
  });

  describe("priceHintSchema", () => {
    it("should parse valid price hint", () => {
      const priceHint = {
        medianMinorUnits: 1000,
        comparables: 5,
        source: "comparables",
      };
      expect(priceHintSchema.parse(priceHint)).toEqual(priceHint);
    });

    it("should reject invalid source", () => {
      expect(() =>
        priceHintSchema.parse({
          medianMinorUnits: 1000,
          comparables: 5,
          source: "invalid",
        }),
      ).toThrow();
    });
  });

  describe("assistantOutcomeSchema", () => {
    it("should validate valid outcomes", () => {
      expect(assistantOutcomeSchema.parse("posted")).toBe("posted");
      expect(assistantOutcomeSchema.parse("abandoned")).toBe("abandoned");
      expect(assistantOutcomeSchema.parse("fell_back")).toBe("fell_back");
    });

    it("should reject invalid outcome", () => {
      expect(() => assistantOutcomeSchema.parse("invalid")).toThrow();
    });
  });
});
