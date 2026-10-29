import {
  ASSISTANT_MAX_TURNS,
  type AssistantTurnOutput,
  type GeoPlace,
} from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import { getStrings } from "./i18n";
import {
  applyTurnOutput,
  assistantErrorMessage,
  buildTurnInput,
  choosePlace,
  createAssistantState,
  deviceTimeZone,
  draftSummary,
  draftToFormValues,
  newSessionId,
  priceHintLine,
  validateAssistantMessage,
  withUserMessage,
} from "./job-assistant";

const SESSION = "11111111-1111-4111-8111-111111111111";
const PLACE: GeoPlace = {
  id: "osm:W1082668130",
  label:
    "12 Ocean Street North, Bondi, Sydney, New South Wales, 2026, Australia",
  latitude: -33.8909546,
  longitude: 151.2633431,
};
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const strings = getStrings();

describe("createAssistantState", () => {
  it("creates a state with the provided session ID and empty messages/draft/fields", () => {
    const state = createAssistantState(SESSION);
    expect(state).toEqual({
      sessionId: SESSION,
      messages: [],
      draft: {},
      missingFields: [],
      readyForReview: false,
      places: [],
      priceHint: null,
    });
  });

  it("creates a state with initial draft when provided", () => {
    const draft = { date: "2026-10-30" };
    const state = createAssistantState(SESSION, draft);
    expect(state).toEqual({
      sessionId: SESSION,
      messages: [],
      draft,
      missingFields: [],
      readyForReview: false,
      places: [],
      priceHint: null,
    });
  });
});

describe("validateAssistantMessage", () => {
  it("returns requiredField error for empty string", () => {
    expect(validateAssistantMessage("")).toBe(strings.errors.requiredField);
  });

  it("returns requiredField error for whitespace-only string", () => {
    expect(validateAssistantMessage("   ")).toBe(strings.errors.requiredField);
  });

  it("returns requiredField error for non-string input", () => {
    expect(validateAssistantMessage(42)).toBe(strings.errors.requiredField);
  });

  it("returns tooLong error for strings longer than max chars", () => {
    expect(validateAssistantMessage("a".repeat(1001))).toBe(
      strings.assistant.tooLong,
    );
  });

  it("returns null for valid strings", () => {
    expect(validateAssistantMessage("a".repeat(1000))).toBeNull();
    expect(validateAssistantMessage("hi")).toBeNull();
  });
});

describe("withUserMessage", () => {
  it("appends a user message to the state", () => {
    const state = createAssistantState(SESSION);
    const newState = withUserMessage(state, "  hello  ");
    expect(newState.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(state.messages).toEqual([]);
  });
});

describe("buildTurnInput", () => {
  it("builds turn input with timezone when provided", () => {
    const state = createAssistantState(SESSION);
    const input = buildTurnInput(state, "Australia/Sydney");
    expect(input).toEqual({
      sessionId: SESSION,
      messages: [],
      draft: {},
      timeZone: "Australia/Sydney",
    });
  });

  it("builds turn input without timezone when undefined", () => {
    const state = createAssistantState(SESSION);
    const input = buildTurnInput(state, undefined);
    expect(input).toEqual({
      sessionId: SESSION,
      messages: [],
      draft: {},
    });
    expect("timeZone" in input).toBe(false);
  });

  it("sends only the last ASSISTANT_MAX_TURNS messages", () => {
    const state = createAssistantState(SESSION);
    // Add 25 alternating user/assistant messages (0-24)
    let currentState = state;
    for (let i = 0; i < 25; i++) {
      if (i % 2 === 0) {
        // Even indices: user messages
        currentState = withUserMessage(currentState, `message ${i}`);
      } else {
        // Odd indices: assistant responses
        currentState = applyTurnOutput(currentState, {
          reply: `reply ${i}`,
          draft: {},
          missingFields: [],
          readyForReview: false,
          quickReplies: [],
          places: [],
          priceHint: null,
        });
      }
    }

    const input = buildTurnInput(currentState, undefined);
    expect(input.messages).toHaveLength(ASSISTANT_MAX_TURNS);
    // The oldest five are dropped: index 5 ("reply 5") through 24.
    expect(input.messages[0]).toEqual({
      role: "assistant",
      content: "reply 5",
    });
    expect(input.messages.at(-1)).toEqual({
      role: "user",
      content: "message 24",
    });
  });
});

describe("applyTurnOutput", () => {
  it("applies turn output to the state", () => {
    const state = createAssistantState(SESSION);
    const output: AssistantTurnOutput = {
      reply: "Which address?",
      draft: { date: "2026-10-30" },
      missingFields: ["address"],
      readyForReview: false,
      quickReplies: [],
      places: [PLACE],
      priceHint: null,
    };

    const newState = applyTurnOutput(state, output);
    expect(newState.messages).toEqual([
      { role: "assistant", content: "Which address?" },
    ]);
    expect(newState.draft).toEqual(output.draft);
    expect(newState.missingFields).toEqual(output.missingFields);
    expect(newState.readyForReview).toBe(output.readyForReview);
    expect(newState.places).toEqual(output.places);
    expect(newState.priceHint).toBeNull();
  });

  it("keeps the price hint from the turn", () => {
    const state = createAssistantState(SESSION);
    const priceHint = {
      medianMinorUnits: 6000,
      comparables: 3,
      source: "comparables" as const,
    };
    const newState = applyTurnOutput(state, {
      reply: "About $60.",
      draft: {},
      missingFields: [],
      readyForReview: false,
      quickReplies: [],
      places: [],
      priceHint,
    });
    expect(newState.priceHint).toEqual(priceHint);
  });
});

describe("choosePlace", () => {
  it("sets draft address and coordinates, removes address from missing fields, clears places", () => {
    const state = createAssistantState(SESSION);
    const newState = choosePlace(
      { ...state, missingFields: ["address", "date"], places: [PLACE] },
      PLACE,
    );

    expect(newState.draft.address).toBe(PLACE.label);
    expect(newState.draft.latitude).toBe("-33.8909546");
    expect(newState.draft.longitude).toBe("151.2633431");
    expect(newState.missingFields).toEqual(["date"]);
    expect(newState.places).toEqual([]);
  });
});

describe("draftToFormValues", () => {
  it("returns all form values as empty strings when draft is empty", () => {
    const result = draftToFormValues({});
    expect(result).toEqual({
      address: "",
      date: "",
      windowStart: "",
      windowEnd: "",
      sizeSqm: "",
      notes: "",
      price: "",
      latitude: "",
      longitude: "",
      preferredCleanerId: "",
    });
  });

  it("fills specified fields and keeps others as empty strings", () => {
    const result = draftToFormValues({ address: "A", sizeSqm: "80" });
    expect(result).toEqual({
      address: "A",
      date: "",
      windowStart: "",
      windowEnd: "",
      sizeSqm: "80",
      notes: "",
      price: "",
      latitude: "",
      longitude: "",
      preferredCleanerId: "",
    });
  });

  it("carries the pinned usual cleaner into the form", () => {
    const result = draftToFormValues({ preferredCleanerId: "cleaner-maria" });
    expect(result.preferredCleanerId).toBe("cleaner-maria");
  });
});

describe("priceHintLine", () => {
  it("is null without a hint", () => {
    expect(priceHintLine(null)).toBeNull();
  });

  it("names the comparables and the median", () => {
    expect(
      priceHintLine({
        medianMinorUnits: 6000,
        comparables: 3,
        source: "comparables",
      }),
    ).toBe(
      "Similar jobs nearby suggest about $60.00 (3 jobs). You set the final price.",
    );
  });

  it("says the rate is size based when there are no comparables", () => {
    expect(
      priceHintLine({
        medianMinorUnits: 32000,
        comparables: 0,
        source: "per_sqm",
      }),
    ).toBe("Based on the size, about $320.00. You set the final price.");
  });
});

describe("draftSummary", () => {
  it("returns empty array for empty draft", () => {
    expect(draftSummary({})).toEqual([]);
  });

  it("returns rows in correct order with labels and formatted values", () => {
    const result = draftSummary({
      notes: "Keys",
      address: "A",
      sizeSqm: "80",
      windowEnd: "13:00",
      date: "2026-10-30",
      windowStart: "10:00",
      latitude: "1",
    });

    expect(result).toEqual([
      { field: "address", label: strings.postJob.addressLabel, value: "A" },
      { field: "date", label: strings.postJob.dateLabel, value: "2026-10-30" },
      {
        field: "windowStart",
        label: strings.postJob.windowStartLabel,
        value: "10:00",
      },
      {
        field: "windowEnd",
        label: strings.postJob.windowEndLabel,
        value: "13:00",
      },
      { field: "sizeSqm", label: strings.postJob.sizeLabel, value: "80 m²" },
      { field: "notes", label: strings.postJob.notesLabel, value: "Keys" },
    ]);
  });

  it("excludes fields that are only spaces", () => {
    const result = draftSummary({ notes: "   " });
    expect(result).toEqual([]);
  });
});

describe("assistantErrorMessage", () => {
  it("returns rateLimited error for TOO_MANY_REQUESTS code", () => {
    expect(assistantErrorMessage({ data: { code: "TOO_MANY_REQUESTS" } })).toBe(
      strings.assistant.rateLimited,
    );
  });

  it("returns unavailable error for other codes, errors, or null", () => {
    expect(assistantErrorMessage(new Error("x"))).toBe(
      strings.assistant.unavailable,
    );
    expect(assistantErrorMessage(null)).toBe(strings.assistant.unavailable);
    expect(
      assistantErrorMessage({ data: { code: "SERVICE_UNAVAILABLE" } }),
    ).toBe(strings.assistant.unavailable);
  });
});

describe("deviceTimeZone", () => {
  it("returns a non-empty string or undefined", () => {
    const zone = deviceTimeZone();
    expect(zone === undefined || zone.length > 0).toBe(true);
  });
});

describe("newSessionId", () => {
  it("generates a UUID v4 string", () => {
    const id = newSessionId();
    expect(UUID_V4.test(id)).toBe(true);
  });

  it("uses fallback when crypto.randomUUID is not available", () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: {},
      configurable: true,
    });

    try {
      const id = newSessionId(() => 0);
      expect(UUID_V4.test(id)).toBe(true);
      expect(id).toBe("00000000-0000-4000-8000-000000000000");
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: original,
        configurable: true,
      });
    }
  });
});
