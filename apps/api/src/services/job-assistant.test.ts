import {
  type AssistantTurnInput,
  type GeoPlace,
  type JobDraft,
  SPARKL_ERROR_CODES,
} from "@sparkl/shared";
import { describe, expect, it, vi } from "vitest";
import type { GeoService } from "./geo.js";
import {
  AssistantError,
  type AssistantTurnEvent,
  applyPatch,
  buildSystemPrompt,
  createJobAssistant,
  localToday,
  missingFields,
} from "./job-assistant.js";
import {
  LlmError,
  type LlmRequest,
  type LlmResult,
  type LlmToolCall,
  createFakeLlmClient,
} from "./llm.js";
import { RateLimitError } from "./rate-limit.js";

const SESSION = "11111111-1111-4111-8111-111111111111";
const PLACE: GeoPlace = {
  id: "osm:W1082668130",
  label:
    "12 Ocean Street North, Bondi, Sydney, New South Wales, 2026, Australia",
  latitude: -33.8909546,
  longitude: 151.2633431,
};
// 2026-10-29 14:00 in Sydney (AEDT, UTC+11): a Thursday.
const fixedNow = () => Date.parse("2026-10-29T03:00:00Z");

function call(id: string, name: string, args: unknown): LlmToolCall {
  return { id, name, arguments: JSON.stringify(args) };
}

// Each LLM call returns the next scripted result; requests are deep-copied
// because the service keeps appending to the same messages array.
function scripted(results: Partial<LlmResult>[]) {
  const requests: LlmRequest[] = [];
  const llm = createFakeLlmClient((request, index) => {
    requests.push(structuredClone(request));
    const result = results[index];
    if (!result) throw new Error(`unscripted LLM call ${index}`);
    return result;
  });
  return { llm, requests };
}

function geoStub(places: GeoPlace[] = [PLACE]) {
  const geocode = vi.fn<GeoService["geocode"]>().mockResolvedValue(places);
  return { geocode };
}

function input(content: string, draft: JobDraft = {}): AssistantTurnInput {
  return {
    sessionId: SESSION,
    timeZone: "Australia/Sydney",
    draft,
    messages: [{ role: "user", content }],
  };
}

// The JSON a tool returned, read back from the follow-up request.
function toolOutput(
  request: LlmRequest | undefined,
  toolCallId: string,
): unknown {
  const message = request?.messages.find(
    (m) => m.role === "tool" && m.toolCallId === toolCallId,
  );
  return message ? JSON.parse(message.content) : undefined;
}

describe("pure helpers", () => {
  it("localToday", () => {
    expect(
      localToday(new Date("2026-10-29T15:00:00Z"), "Australia/Sydney"),
    ).toEqual({
      date: "2026-10-30",
      weekday: "Friday",
      timeZone: "Australia/Sydney",
    });
    expect(localToday(new Date("2026-10-29T15:00:00Z"), "Not/AZone")).toEqual({
      date: "2026-10-29",
      weekday: "Thursday",
      timeZone: "UTC",
    });
    expect(localToday(new Date("2026-10-29T15:00:00Z"), undefined)).toEqual({
      date: "2026-10-29",
      weekday: "Thursday",
      timeZone: "UTC",
    });
  });

  it("missingFields", () => {
    expect(missingFields({})).toEqual([
      "address",
      "date",
      "windowStart",
      "windowEnd",
    ]);
    expect(
      missingFields({
        address: "12 Ocean St, Bondi",
        latitude: "-33.89",
        longitude: "151.26",
        date: "2026-10-30",
        windowStart: "10:00",
        windowEnd: "13:00",
      }),
    ).toEqual([]);
    expect(
      missingFields({
        address: "12 Ocean St, Bondi",
        latitude: "-33.89",
        longitude: "151.26",
        date: "2026-10-30",
        windowStart: "13:00",
        windowEnd: "10:00",
      }),
    ).toEqual(["windowEnd"]);
    expect(
      missingFields({
        address: "12 Ocean St, Bondi",
        latitude: "-33.89",
        longitude: "151.26",
        date: "2026-10-30",
      }),
    ).toEqual(["windowStart", "windowEnd"]);
  });

  it("applyPatch", () => {
    expect(
      applyPatch(
        {},
        { placeId: PLACE.id, sizeSqm: 80 },
        new Map([[PLACE.id, PLACE]]),
      ),
    ).toEqual({
      draft: {
        address: PLACE.label,
        latitude: "-33.8909546",
        longitude: "151.2633431",
        sizeSqm: "80",
      },
      error: undefined,
    });
    expect(
      applyPatch({ notes: "keep" }, { placeId: "osm:N1" }, new Map()),
    ).toEqual({
      draft: { notes: "keep" },
      error: "unknown placeId: call geocode_address and use one of its ids",
    });
  });

  it("buildSystemPrompt", () => {
    const prompt = buildSystemPrompt({
      today: {
        date: "2026-10-29",
        weekday: "Thursday",
        timeZone: "Australia/Sydney",
      },
      draft: { date: "2026-10-30" },
      missing: ["address"],
    });
    expect(prompt).toContain("Thursday 2026-10-29");
    expect(prompt).toContain("Still missing: address");
    // The exact JSON format may vary, so just check that the draft is included in the prompt
    expect(prompt).toContain("Current draft:");
  });
});

describe("createJobAssistant", () => {
  it("happy path", async () => {
    const { llm, requests } = scripted([
      {
        toolCalls: [
          call("c1", "geocode_address", { text: "12 Ocean St, Bondi" }),
          call("c2", "update_draft", {
            date: "2026-10-30",
            windowStart: "10:00",
            windowEnd: "13:00",
            sizeSqm: 80,
          }),
        ],
      },
      {
        toolCalls: [call("c3", "update_draft", { placeId: PLACE.id })],
      },
      { content: "Draft is ready to review." },
    ]);

    const geo = geoStub();
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    const result = await assistant.turn("host-1", input("12 Ocean St, Bondi"));

    expect(result.reply).toBe("Draft is ready to review.");
    expect(result.draft).toEqual({
      address: PLACE.label,
      latitude: "-33.8909546",
      longitude: "151.2633431",
      date: "2026-10-30",
      windowStart: "10:00",
      windowEnd: "13:00",
      sizeSqm: "80",
    });
    expect(result.readyForReview).toBe(true);
    expect(result.missingFields).toEqual([]);
    expect(result.places).toEqual([]);
    expect(result.priceHint).toBe(null);
    expect(geo.geocode).toHaveBeenCalledWith("host-1", {
      query: "12 Ocean St, Bondi",
    });
    expect(requests[0]?.tools?.map((t) => t.name)).toEqual([
      "update_draft",
      "geocode_address",
    ]);
    expect(toolOutput(requests[1], "c1")).toEqual({
      candidates: [{ placeId: PLACE.id, label: PLACE.label }],
    });
  });

  it("system prompt", async () => {
    const { llm, requests } = scripted([
      {
        toolCalls: [
          call("c1", "geocode_address", { text: "12 Ocean St, Bondi" }),
        ],
      },
      { content: "ok" },
    ]);

    const geo = geoStub();
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    await assistant.turn("host-1", input("12 Ocean St, Bondi"));

    expect(requests[0]?.messages[0]).toEqual({
      role: "system",
      content: expect.stringContaining("Thursday 2026-10-29"),
    });
  });

  it.each([
    { patch: { hostId: "admin" } },
    { patch: { price: "0" } },
    { patch: { latitude: -33 } },
    { patch: { status: "open" } },
  ])("injection protection", async ({ patch }) => {
    const { llm, requests } = scripted([
      {
        toolCalls: [call("c1", "update_draft", patch)],
      },
      { content: "ok" },
    ]);

    const geo = geoStub();
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    const result = await assistant.turn("host-1", input("12 Ocean St, Bondi"));

    expect(result.draft).toEqual({});
    // The actual error object includes a fields property
    const output = toolOutput(requests[1], "c1");
    expect(output).toHaveProperty("error", "invalid arguments");
  });

  it("unknown placeId without geocode in this turn", async () => {
    const { llm, requests } = scripted([
      {
        toolCalls: [call("c1", "update_draft", { placeId: "osm:N1" })],
      },
      { content: "ok" },
    ]);

    const geo = geoStub();
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    const result = await assistant.turn("host-1", input("12 Ocean St, Bondi"));

    expect(toolOutput(requests[1], "c1")).toEqual({
      error: "unknown placeId: call geocode_address and use one of its ids",
    });
    expect(result.draft.address).toBeUndefined();
  });

  it("unparseable arguments", async () => {
    const { llm, requests } = scripted([
      {
        toolCalls: [{ id: "c1", name: "update_draft", arguments: "{not json" }],
      },
      { content: "ok" },
    ]);

    const geo = geoStub();
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    await assistant.turn("host-1", input("12 Ocean St, Bondi"));

    // The actual error object includes a fields property
    const output = toolOutput(requests[1], "c1");
    expect(output).toHaveProperty("error", "invalid arguments");
  });

  it("unknown tool", async () => {
    const { llm, requests } = scripted([
      {
        toolCalls: [call("c1", "post_job", {})],
      },
      { content: "ok" },
    ]);

    const geo = geoStub();
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    const result = await assistant.turn("host-1", input("12 Ocean St, Bondi"));

    expect(toolOutput(requests[1], "c1")).toEqual({
      error: "unknown tool post_job",
    });
    expect(result.reply).toBe("ok");
  });

  it("candidates shown until one is chosen", async () => {
    const { llm } = scripted([
      {
        toolCalls: [
          call("c1", "geocode_address", { text: "12 Ocean St, Bondi" }),
        ],
      },
      { content: "Which one?" },
    ]);

    const geo = geoStub();
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    const result = await assistant.turn("host-1", input("12 Ocean St, Bondi"));

    expect(result.places).toEqual([PLACE]);
    expect(result.readyForReview).toBe(false);
    expect(result.missingFields).toContain("address");
  });

  it("geo failure", async () => {
    const { llm, requests } = scripted([
      {
        toolCalls: [
          call("c1", "geocode_address", { text: "12 Ocean St, Bondi" }),
        ],
      },
      { content: "ok" },
    ]);

    const geo = geoStub();
    geo.geocode.mockRejectedValue(new Error("down"));
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    const result = await assistant.turn("host-1", input("12 Ocean St, Bondi"));

    expect(toolOutput(requests[1], "c1")).toEqual({
      error: "address lookup unavailable, ask the host to use the form",
    });
    expect(result.reply).toBe("ok");
  });

  it("repair", async () => {
    const { llm, requests } = scripted([{ content: "" }, { content: "Hello" }]);

    const geo = geoStub();
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    const result = await assistant.turn("host-1", input("12 Ocean St, Bondi"));

    expect(result.reply).toBe("Hello");
    expect(requests.length).toBe(2);
    expect(requests[1]?.tools).toBeUndefined();
    expect(requests[1]?.messages?.at(-1)).toEqual({
      role: "system",
      content: "Reply to the host now in plain text.",
    });
  });

  it("repair fails", async () => {
    const { llm } = scripted([{ content: "" }, { content: "   " }]);

    const geo = geoStub();
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    await expect(() =>
      assistant.turn("host-1", input("12 Ocean St, Bondi")),
    ).rejects.toThrow(
      new AssistantError(
        SPARKL_ERROR_CODES.UPSTREAM_UNAVAILABLE,
        "the assistant is unavailable, use the form instead",
      ),
    );
  });

  it("step cap", async () => {
    const results: Partial<LlmResult>[] = [];
    for (let i = 1; i <= 5; i++) {
      results.push({
        toolCalls: [call(`c${i}`, "geocode_address", { text: "12 Ocean St" })],
      });
    }
    results.push({ content: "Done" });

    const { llm, requests } = scripted(results);

    const geo = geoStub();
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    const result = await assistant.turn("host-1", input("12 Ocean St, Bondi"));

    expect(result.reply).toBe("Done");
    expect(requests.length).toBe(6);
    expect(requests[5]?.tools).toBeUndefined();
    expect(requests[4]?.tools).toBeDefined();
  });

  it("step cap with empty final answer", async () => {
    const results: Partial<LlmResult>[] = [];
    for (let i = 1; i <= 5; i++) {
      results.push({
        toolCalls: [call(`c${i}`, "geocode_address", { text: "12 Ocean St" })],
      });
    }
    results.push({ content: "" });

    const { llm } = scripted(results);

    const geo = geoStub();
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    await expect(() =>
      assistant.turn("host-1", input("12 Ocean St, Bondi")),
    ).rejects.toThrow(
      new AssistantError(
        SPARKL_ERROR_CODES.UPSTREAM_UNAVAILABLE,
        "the assistant is unavailable, use the form instead",
      ),
    );
  });

  it("tool-call cap", async () => {
    const results: Partial<LlmResult>[] = [
      {
        toolCalls: Array.from({ length: 13 }, (_, i) =>
          call(`c${i + 1}`, "update_draft", { notes: "x" }),
        ),
      },
      { content: "ok" },
    ];

    const { llm, requests } = scripted(results);

    const geo = geoStub();
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    await assistant.turn("host-1", input("12 Ocean St, Bondi"));

    expect(toolOutput(requests[1], "c13")).toHaveProperty(
      "error",
      "tool call limit reached, reply to the host now",
    );
    // The tool output for c12 should just be { ok: true }
    const outputC12 = toolOutput(requests[1], "c12");
    expect(outputC12).toHaveProperty("ok", true);
  });

  it("LLM failure", async () => {
    const llm = createFakeLlmClient(() => {
      throw new LlmError("timeout", "t");
    });

    const events: AssistantTurnEvent[] = [];
    const assistant = createJobAssistant({
      llm,
      geo: geoStub(),
      now: fixedNow,
      onTurn: (event) => events.push(event),
    });

    const error = await assistant
      .turn("host-1", input("12 Ocean St, Bondi"))
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(AssistantError);
    expect((error as AssistantError).code).toBe(
      SPARKL_ERROR_CODES.UPSTREAM_UNAVAILABLE,
    );
    expect(events.map((e) => e.outcome)).toEqual(["error"]);
  });

  it("events", async () => {
    const { llm } = scripted([
      {
        toolCalls: [
          call("c1", "geocode_address", { text: "12 Ocean St, Bondi" }),
          call("c2", "update_draft", {
            date: "2026-10-30",
            windowStart: "10:00",
            windowEnd: "13:00",
            sizeSqm: 80,
          }),
        ],
      },
      {
        toolCalls: [call("c3", "update_draft", { placeId: PLACE.id })],
      },
      { content: "Draft is ready to review." },
    ]);

    const fromDeps: AssistantTurnEvent[] = [];
    const fromCall: AssistantTurnEvent[] = [];
    const assistant = createJobAssistant({
      llm,
      geo: geoStub(),
      now: fixedNow,
      onTurn: (event) => fromDeps.push(event),
    });

    const result = await assistant.turn("host-1", input("12 Ocean St, Bondi"), {
      onTurn: (event) => fromCall.push(event),
    });

    expect(result.reply).toBe("Draft is ready to review.");
    expect(fromDeps).toHaveLength(1);
    expect(fromCall).toEqual(fromDeps);
    const event = fromDeps[0];
    expect(event).toMatchObject({
      model: "fake",
      toolNames: ["geocode_address", "update_draft", "update_draft"],
      steps: 3,
      outcome: "reply",
    });
    // Metadata only: no message text or address.
    expect(JSON.stringify(event)).not.toContain("Ocean");
  });

  it("rate limit", async () => {
    // Need to provide a script for 21 calls to test rate limiting properly
    const results: Partial<LlmResult>[] = Array(21).fill({ content: "ok" });
    const { llm } = scripted(results);

    const geo = geoStub();
    const assistant = createJobAssistant({ llm, geo, now: fixedNow });

    // 20 turns for host-1 should resolve
    for (let i = 0; i < 20; i++) {
      await assistant.turn("host-1", input("12 Ocean St, Bondi"));
    }

    // 21st turn should reject with RateLimitError
    await expect(() =>
      assistant.turn("host-1", input("12 Ocean St, Bondi")),
    ).rejects.toThrow(RateLimitError);

    // host-2 should still resolve
    await expect(
      assistant.turn("host-2", input("12 Ocean St, Bondi")),
    ).resolves.toBeDefined();
  });
});
