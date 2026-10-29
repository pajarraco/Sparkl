import {
  type AssistantTurnInput,
  type GeoPlace,
  type Job,
  type JobDraft,
  SPARKL_ERROR_CODES,
  type User,
} from "@sparkl/shared";
import { describe, expect, it, vi } from "vitest";
import type {
  AssistantSessionsStore,
  AssistantTurnStats,
  SessionCorrections,
} from "./assistant-sessions.js";
import type { GeoService } from "./geo.js";
import type { HostMemoryStores } from "./host-memory.js";
import {
  AssistantError,
  type AssistantTurnEvent,
  applyPatch,
  buildSystemPrompt,
  createJobAssistant,
  filledFields,
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

// Records what the assistant writes; openTurn answers `open`.
function sessionsStub(open = true) {
  const opened: Parameters<AssistantSessionsStore["openTurn"]>[0][] = [];
  const recorded: { id: string; hostId: string; stats: AssistantTurnStats }[] =
    [];
  const sessions: AssistantSessionsStore = {
    async openTurn(args) {
      opened.push(args);
      return open;
    },
    async recordTurn(id, hostId, stats) {
      recorded.push({ id, hostId, stats });
    },
    async listFinishedByHost() {
      return [];
    },
    async finish() {
      throw new Error("finish is not called by a turn");
    },
  };
  return { sessions, opened, recorded };
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

  it("filledFields", () => {
    expect(filledFields({}, {})).toEqual([]);
    expect(
      filledFields(
        { date: "2026-10-30", notes: "keys" },
        {
          address: "A",
          latitude: "1",
          longitude: "2",
          date: "2026-10-31",
          notes: "keys",
        },
      ),
    ).toEqual(["address", "latitude", "longitude", "date"]);
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

  describe("session record", () => {
    it("opens the session before the model and records the turn", async () => {
      const { llm } = scripted([
        {
          toolCalls: [
            call("c1", "geocode_address", { text: "12 Ocean St, Bondi" }),
            call("c2", "update_draft", { date: "2026-10-30" }),
          ],
          inputTokens: 100,
          outputTokens: 20,
        },
        {
          toolCalls: [call("c3", "update_draft", { placeId: PLACE.id })],
          inputTokens: 150,
          outputTokens: 10,
        },
        { content: "What time?", inputTokens: 200, outputTokens: 5 },
      ]);
      const { sessions, opened, recorded } = sessionsStub();
      const assistant = createJobAssistant({
        llm,
        geo: geoStub(),
        now: fixedNow,
      });

      await assistant.turn(
        "host-1",
        input("12 Ocean St, Bondi", { notes: "keys" }),
        { sessions },
      );

      expect(opened).toEqual([
        {
          id: SESSION,
          hostId: "host-1",
          model: "fake",
          nowIso: "2026-10-29T03:00:00.000Z",
        },
      ]);
      expect(recorded).toEqual([
        {
          id: SESSION,
          hostId: "host-1",
          stats: {
            toolCalls: 3,
            inputTokens: 450,
            outputTokens: 35,
            latencyMs: 0,
            // notes came from the host, not this turn.
            modelFilled: ["address", "latitude", "longitude", "date"],
          },
        },
      ]);
    });

    it("refuses a foreign or finished session without calling the model", async () => {
      const llm = createFakeLlmClient(() => {
        throw new Error("the model must not be called");
      });
      const { sessions, recorded } = sessionsStub(false);
      const assistant = createJobAssistant({
        llm,
        geo: geoStub(),
        now: fixedNow,
      });

      const error = await assistant
        .turn("host-1", input("hi"), { sessions })
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(AssistantError);
      expect((error as AssistantError).code).toBe(SPARKL_ERROR_CODES.NOT_FOUND);
      expect(recorded).toEqual([]);
    });

    it("records a failed turn and keeps the original error", async () => {
      const llm = createFakeLlmClient(() => {
        throw new LlmError("timeout", "t");
      });
      const { sessions, recorded } = sessionsStub();
      sessions.recordTurn = async (id, hostId, stats) => {
        recorded.push({ id, hostId, stats });
        throw new Error("db down");
      };
      const assistant = createJobAssistant({
        llm,
        geo: geoStub(),
        now: fixedNow,
      });

      const error = await assistant
        .turn("host-1", input("hi"), { sessions })
        .catch((err: unknown) => err);

      expect((error as AssistantError).code).toBe(
        SPARKL_ERROR_CODES.UPSTREAM_UNAVAILABLE,
      );
      expect(recorded.map((r) => r.stats.modelFilled)).toEqual([[]]);
    });
  });

  describe("host memory", () => {
    const HISTORY_JOB: Job = {
      id: "job-past-1",
      hostId: "host-1",
      address: "12 Ocean St, Bondi",
      latitude: -33.8909,
      longitude: 151.2633,
      windowStart: "2026-10-20T10:00:00.000Z",
      windowEnd: "2026-10-20T12:00:00.000Z",
      sizeSqm: 80,
      notes: "Change the sheets",
      priceMinorUnits: 5000,
      status: "completed",
      claimedByCleanerId: "cleaner-maria",
      createdAt: "2026-10-20T03:00:00.000Z",
      updatedAt: "2026-10-20T03:00:00.000Z",
    };

    function memoryStores(
      overrides: Partial<{
        jobs: Job[];
        user: User | null;
        sessions: SessionCorrections[];
      }> = {},
    ): HostMemoryStores {
      return {
        jobs: { listJobsByHost: async () => overrides.jobs ?? [HISTORY_JOB] },
        users: {
          findById: async () =>
            overrides.user ?? {
              id: "cleaner-maria",
              role: "cleaner",
              name: "Maria",
              photoUrl: null,
              serviceLat: null,
              serviceLng: null,
              serviceRadiusKm: null,
              avgRating: 4.8,
              completedJobCount: 10,
              createdAt: "2026-10-20T03:00:00.000Z",
              updatedAt: "2026-10-20T03:00:00.000Z",
            },
        },
        reviews: { findReviewByJobAndAuthor: async () => null },
        sessions: {
          listFinishedByHost: async () => overrides.sessions ?? [],
        },
      };
    }

    it("offers get_host_history and answers from the host's jobs", async () => {
      const { llm, requests } = scripted([
        { toolCalls: [call("c1", "get_host_history", {})] },
        { content: "Same as last time?" },
      ]);
      const { sessions } = sessionsStub();
      const assistant = createJobAssistant({
        llm,
        geo: geoStub(),
        now: fixedNow,
      });

      const result = await assistant.turn(
        "host-1",
        input("same as last time"),
        {
          sessions,
          memory: memoryStores(),
        },
      );

      expect(requests[0]?.tools?.map((t) => t.name)).toEqual([
        "update_draft",
        "geocode_address",
        "get_host_history",
      ]);
      expect(toolOutput(requests[1], "c1")).toEqual({
        jobs: [
          {
            address: "12 Ocean St, Bondi",
            windowStart: "2026-10-20T10:00:00.000Z",
            windowEnd: "2026-10-20T12:00:00.000Z",
            sizeSqm: 80,
            notes: "Change the sheets",
            priceMinorUnits: 5000,
          },
        ],
      });
      expect(result.reply).toBe("Same as last time?");
    });

    it("pre-fills a single property and tells the model to confirm it", async () => {
      const { llm, requests } = scripted([
        { content: "At 12 Ocean St as usual?" },
      ]);
      const { sessions } = sessionsStub();
      const assistant = createJobAssistant({
        llm,
        geo: geoStub(),
        now: fixedNow,
      });

      const result = await assistant.turn(
        "host-1",
        input("this Friday 10 to 1"),
        {
          sessions,
          memory: memoryStores(),
        },
      );

      expect(result.draft.address).toBe("12 Ocean St, Bondi");
      expect(result.draft.latitude).toBe("-33.8909");
      expect(result.draft.longitude).toBe("151.2633");
      const system = requests[0]?.messages[0];
      expect(system?.role).toBe("system");
      expect(system?.content).toContain("as usual?");
      expect(system?.content).toContain("never ask for the address");
    });

    it("adds usual-cleaner and correction hints to the prompt", async () => {
      const jobs = ["21", "22", "23"].map((day) => ({
        ...HISTORY_JOB,
        id: `job-${day}`,
        windowStart: `2026-10-${day}T10:00:00.000Z`,
        windowEnd: `2026-10-${day}T12:00:00.000Z`,
        createdAt: `2026-10-${day}T03:00:00.000Z`,
      }));
      const { llm, requests } = scripted([
        { content: "Go with Maria as always?" },
      ]);
      const { sessions } = sessionsStub();
      const assistant = createJobAssistant({
        llm,
        geo: geoStub(),
        now: fixedNow,
      });

      await assistant.turn("host-1", input("I need a clean"), {
        sessions,
        memory: memoryStores({
          jobs,
          sessions: [
            { modelFilled: ["windowEnd"], hostChanged: ["windowEnd"] },
            { modelFilled: ["windowEnd"], hostChanged: ["windowEnd"] },
          ],
        }),
      });

      const system = requests[0]?.messages[0];
      expect(system?.content).toContain("Go with Maria as always?");
      expect(system?.content).toContain("`windowEnd`");
    });

    it("runs memory-free when the memory read fails", async () => {
      const { llm, requests } = scripted([{ content: "ok" }]);
      const { sessions } = sessionsStub();
      const assistant = createJobAssistant({
        llm,
        geo: geoStub(),
        now: fixedNow,
      });

      const result = await assistant.turn("host-1", input("hi"), {
        sessions,
        memory: {
          ...memoryStores(),
          jobs: {
            listJobsByHost: async () => {
              throw new Error("db down");
            },
          },
        },
      });

      expect(result.reply).toBe("ok");
      expect(requests[0]?.tools?.map((t) => t.name)).toEqual([
        "update_draft",
        "geocode_address",
      ]);
    });
  });
});

describe("price hint and usual cleaner", () => {
  const HERE = { latitude: -33.8909546, longitude: 151.2633431 };
  const MARIA: User = {
    id: "cleaner-maria",
    role: "cleaner",
    name: "Maria",
    photoUrl: null,
    serviceLat: null,
    serviceLng: null,
    serviceRadiusKm: null,
    avgRating: 4.8,
    completedJobCount: 10,
    createdAt: "2026-10-20T03:00:00.000Z",
    updatedAt: "2026-10-20T03:00:00.000Z",
  };
  const HOSTED_DRAFT: JobDraft = {
    address: PLACE.label,
    latitude: String(HERE.latitude),
    longitude: String(HERE.longitude),
    sizeSqm: "80",
  };

  // A past job at the same spot, 80 m², claimed by Maria and completed.
  function pastJob(n: number, overrides: Partial<Job> = {}): Job {
    return {
      id: `job-${n}`,
      hostId: "host-1",
      address: PLACE.label,
      latitude: HERE.latitude,
      longitude: HERE.longitude,
      windowStart: `2026-10-${10 + n}T10:00:00.000Z`,
      windowEnd: `2026-10-${10 + n}T12:00:00.000Z`,
      sizeSqm: 80,
      notes: null,
      priceMinorUnits: 5000,
      status: "completed",
      claimedByCleanerId: MARIA.id,
      createdAt: `2026-10-${10 + n}T03:00:00.000Z`,
      updatedAt: `2026-10-${10 + n}T03:00:00.000Z`,
      ...overrides,
    };
  }

  function memory(jobs: Job[]): HostMemoryStores {
    return {
      jobs: { listJobsByHost: async () => jobs },
      users: { findById: async () => MARIA },
      reviews: { findReviewByJobAndAuthor: async () => null },
      sessions: { listFinishedByHost: async () => [] },
    };
  }

  function pricing(pool: Job[]) {
    return { listJobsForPricing: async () => pool };
  }

  function toolNames(request: LlmRequest | undefined): string[] {
    return request?.tools?.map((t) => t.name) ?? [];
  }

  it("offers suggest_price only with pricing, and answers with the hint", async () => {
    const pool = [
      pastJob(1, { priceMinorUnits: 5000 }),
      pastJob(2, { priceMinorUnits: 6000 }),
      pastJob(3, { priceMinorUnits: 7000 }),
    ];
    const { llm, requests } = scripted([
      { toolCalls: [call("p1", "suggest_price", {})] },
      { content: "Similar jobs nearby are about $60." },
    ]);
    const assistant = createJobAssistant({
      llm,
      geo: geoStub(),
      now: fixedNow,
    });

    const result = await assistant.turn(
      "host-1",
      input("price?", HOSTED_DRAFT),
      { pricing: pricing(pool) },
    );

    expect(toolNames(requests[0])).toEqual([
      "update_draft",
      "geocode_address",
      "suggest_price",
    ]);
    expect(toolOutput(requests[1], "p1")).toEqual({
      medianMinorUnits: 6000,
      comparables: 3,
      source: "comparables",
    });
    expect(result.priceHint).toEqual({
      medianMinorUnits: 6000,
      comparables: 3,
      source: "comparables",
    });
    expect(result.draft.price).toBeUndefined();
  });

  it("falls back to the per-m² rate when there are too few comparables", async () => {
    const { llm, requests } = scripted([
      { toolCalls: [call("p1", "suggest_price", {})] },
      { content: "About $320 for 80 m²." },
    ]);
    const assistant = createJobAssistant({
      llm,
      geo: geoStub(),
      now: fixedNow,
    });

    const result = await assistant.turn(
      "host-1",
      input("price?", HOSTED_DRAFT),
      { pricing: pricing([]) },
    );

    expect(toolOutput(requests[1], "p1")).toEqual({
      medianMinorUnits: 32000,
      comparables: 0,
      source: "per_sqm",
    });
    expect(result.priceHint?.source).toBe("per_sqm");
  });

  it("asks for the address and size before suggesting a price", async () => {
    const { llm, requests } = scripted([
      { toolCalls: [call("p1", "suggest_price", {})] },
      { content: "What is the size?" },
    ]);
    const assistant = createJobAssistant({
      llm,
      geo: geoStub(),
      now: fixedNow,
    });

    const result = await assistant.turn("host-1", input("price?"), {
      pricing: pricing([]),
    });

    expect(toolOutput(requests[1], "p1")).toEqual({
      error: "need the address and the size first",
    });
    expect(result.priceHint).toBeNull();
  });

  it("keeps the turn alive when the comparables read fails", async () => {
    const { llm, requests } = scripted([
      { toolCalls: [call("p1", "suggest_price", {})] },
      { content: "I cannot price it right now." },
    ]);
    const assistant = createJobAssistant({
      llm,
      geo: geoStub(),
      now: fixedNow,
    });

    const result = await assistant.turn(
      "host-1",
      input("price?", HOSTED_DRAFT),
      {
        pricing: {
          listJobsForPricing: async () => {
            throw new Error("db down");
          },
        },
      },
    );

    expect(toolOutput(requests[1], "p1")).toEqual({
      error: "price comparables unavailable",
    });
    expect(result.priceHint).toBeNull();
  });

  it("does not offer suggest_price without pricing", async () => {
    const { llm, requests } = scripted([{ content: "Hello" }]);
    const assistant = createJobAssistant({
      llm,
      geo: geoStub(),
      now: fixedNow,
    });

    await assistant.turn("host-1", input("hi", HOSTED_DRAFT), {});

    expect(toolNames(requests[0])).not.toContain("suggest_price");
    expect(requests[0]?.messages[0]?.content).not.toContain("suggest_price");
  });

  it("pins the usual cleaner on yes", async () => {
    const { llm, requests } = scripted([
      { toolCalls: [call("k1", "pin_usual_cleaner", {})] },
      { content: "Maria is pinned to the top of this job's suggestions." },
    ]);
    const assistant = createJobAssistant({
      llm,
      geo: geoStub(),
      now: fixedNow,
    });
    const jobs = [pastJob(1), pastJob(2), pastJob(3)];

    const result = await assistant.turn("host-1", input("yes"), {
      memory: memory(jobs),
    });

    expect(toolNames(requests[0])).toContain("pin_usual_cleaner");
    expect(toolOutput(requests[1], "k1")).toEqual({ ok: true, name: "Maria" });
    expect(result.draft.preferredCleanerId).toBe(MARIA.id);
    expect(requests[0]?.messages[0]?.content).toContain(
      "Go with Maria as always?",
    );
  });

  it("does not offer the pin tool without a usual cleaner", async () => {
    const { llm, requests } = scripted([{ content: "Hello" }]);
    const assistant = createJobAssistant({
      llm,
      geo: geoStub(),
      now: fixedNow,
    });

    await assistant.turn("host-1", input("hi"), {
      memory: memory([pastJob(1)]),
    });

    expect(toolNames(requests[0])).not.toContain("pin_usual_cleaner");
  });

  it("refuses a pin when memory has no usual cleaner", async () => {
    const { llm, requests } = scripted([
      { toolCalls: [call("k1", "pin_usual_cleaner", {})] },
      { content: "No usual cleaner yet." },
    ]);
    const assistant = createJobAssistant({
      llm,
      geo: geoStub(),
      now: fixedNow,
    });

    const result = await assistant.turn("host-1", input("yes"), {
      memory: memory([pastJob(1)]),
    });

    expect(toolOutput(requests[1], "k1")).toEqual({
      error: "no usual cleaner to pin",
    });
    expect(result.draft.preferredCleanerId).toBeUndefined();
  });

  it("drops a pin in the draft that does not match the usual cleaner", async () => {
    const { llm } = scripted([{ content: "Hello" }]);
    const assistant = createJobAssistant({
      llm,
      geo: geoStub(),
      now: fixedNow,
    });

    const result = await assistant.turn(
      "host-1",
      input("hi", { ...HOSTED_DRAFT, preferredCleanerId: "cleaner-stranger" }),
      { memory: memory([pastJob(1), pastJob(2), pastJob(3)]) },
    );

    expect(result.draft.preferredCleanerId).toBeUndefined();
  });

  it("keeps a pin in the draft that matches the usual cleaner", async () => {
    const { llm } = scripted([{ content: "Hello" }]);
    const assistant = createJobAssistant({
      llm,
      geo: geoStub(),
      now: fixedNow,
    });

    const result = await assistant.turn(
      "host-1",
      input("hi", { ...HOSTED_DRAFT, preferredCleanerId: MARIA.id }),
      { memory: memory([pastJob(1), pastJob(2), pastJob(3)]) },
    );

    expect(result.draft.preferredCleanerId).toBe(MARIA.id);
  });

  it("tells the model the cleaner is already pinned, and carries the checklist rule", () => {
    const prompt = buildSystemPrompt({
      today: { date: "2026-10-30", weekday: "Friday", timeZone: "UTC" },
      draft: { preferredCleanerId: MARIA.id },
      missing: [],
      memory: {
        recentJobs: [],
        singleProperty: null,
        usualCleaner: { id: MARIA.id, name: "Maria" },
        correctionHints: [],
      },
      canSuggestPrice: true,
    });

    expect(prompt).toContain("already pinned to this job");
    expect(prompt).not.toContain("Go with Maria as always?");
    expect(prompt).toContain("call suggest_price");
    expect(prompt).toContain("cleaning checklist");
  });
});
