import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type FakeLlmResponder,
  LLM_DEFAULTS,
  LlmError,
  type LlmRequest,
  buildRequestBody,
  createFakeLlmClient,
  createLiveLlmClient,
  createLlmClientFromEnv,
  resolveLlmConfig,
} from "./llm.js";

const config = {
  mode: "live",
  baseUrl: "https://llm.test/v1",
  model: "m",
  apiKey: "k",
  maxTokens: 1500,
  timeoutMs: 20000,
} as const;

const successBody = {
  model: "m",
  choices: [{ finish_reason: "stop", message: { content: "hi" } }],
  usage: { prompt_tokens: 10, completion_tokens: 3 },
};

describe("resolveLlmConfig", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns default live config when env is empty", () => {
    const result = resolveLlmConfig({});
    expect(result).toEqual({
      mode: "live",
      baseUrl: LLM_DEFAULTS.baseUrl,
      model: LLM_DEFAULTS.model,
      apiKey: "",
      maxTokens: 1500,
      timeoutMs: 20000,
    });
  });

  it("removes trailing slash from LLM_BASE_URL", () => {
    const result = resolveLlmConfig({
      LLM_BASE_URL: "http://localhost:11434/v1/",
    });
    expect(result.baseUrl).toBe("http://localhost:11434/v1");
  });

  it("throws LlmError with kind 'config' when LLM_MODE is 'fake' in production", () => {
    const fn = () =>
      resolveLlmConfig({ LLM_MODE: "fake", NODE_ENV: "production" });
    expect(() => fn()).toThrow(LlmError);
    expect(() => fn()).toThrow(expect.objectContaining({ kind: "config" }));
  });

  it("allows LLM_MODE='fake' when NODE_ENV is 'test'", () => {
    const result = resolveLlmConfig({ LLM_MODE: "fake", NODE_ENV: "test" });
    expect(result.mode).toBe("fake");
  });

  it("allows LLM_MODE='fake' when NODE_ENV is 'development'", () => {
    const result = resolveLlmConfig({
      LLM_MODE: "fake",
      NODE_ENV: "development",
    });
    expect(result.mode).toBe("fake");
  });

  it("throws LlmError with kind 'config' when LLM_MODE is 'fake' and NODE_ENV is missing", () => {
    const fn = () => resolveLlmConfig({ LLM_MODE: "fake" });
    expect(() => fn()).toThrow(LlmError);
    expect(() => fn()).toThrow(expect.objectContaining({ kind: "config" }));
  });

  it("throws LlmError with kind 'config' when LLM_MODE is invalid", () => {
    const fn = () => resolveLlmConfig({ LLM_MODE: "other" });
    expect(() => fn()).toThrow(LlmError);
    expect(() => fn()).toThrow(expect.objectContaining({ kind: "config" }));
  });

  it("throws LlmError with kind 'config' when remote URL is not https", () => {
    const fn = () =>
      resolveLlmConfig({
        LLM_BASE_URL: "http://example.com/v1",
        LLM_API_KEY: "k",
      });
    expect(() => fn()).toThrow(LlmError);
    expect(() => fn()).toThrow(expect.objectContaining({ kind: "config" }));
  });

  it("throws LlmError with kind 'config' when remote https URL lacks API key", () => {
    const fn = () =>
      resolveLlmConfig({
        LLM_BASE_URL: "https://inference.baseten.co/v1",
      });
    expect(() => fn()).toThrow(LlmError);
    expect(() => fn()).toThrow(expect.objectContaining({ kind: "config" }));
  });

  it("allows remote https URL with API key", () => {
    const result = resolveLlmConfig({
      LLM_BASE_URL: "https://inference.baseten.co/v1",
      LLM_API_KEY: "key",
    });
    expect(result.baseUrl).toBe("https://inference.baseten.co/v1");
  });

  it("throws LlmError with kind 'config' when remote URL lacks API key", () => {
    const fn = () =>
      resolveLlmConfig({
        LLM_BASE_URL: "https://inference.baseten.co/v1",
      });
    expect(() => fn()).toThrow(LlmError);
    expect(() => fn()).toThrow(expect.objectContaining({ kind: "config" }));
  });

  it("throws LlmError with kind 'config' when LLM_BASE_URL is invalid", () => {
    const fn = () => resolveLlmConfig({ LLM_BASE_URL: "not a url" });
    expect(() => fn()).toThrow(LlmError);
    expect(() => fn()).toThrow(expect.objectContaining({ kind: "config" }));
  });

  it("throws LlmError with kind 'config' when LLM_MAX_TOKENS is 0", () => {
    const fn = () => resolveLlmConfig({ LLM_MAX_TOKENS: "0" });
    expect(() => fn()).toThrow(LlmError);
    expect(() => fn()).toThrow(expect.objectContaining({ kind: "config" }));
  });

  it("throws LlmError with kind 'config' when LLM_MAX_TOKENS is negative", () => {
    const fn = () => resolveLlmConfig({ LLM_MAX_TOKENS: "-5" });
    expect(() => fn()).toThrow(LlmError);
    expect(() => fn()).toThrow(expect.objectContaining({ kind: "config" }));
  });

  it("throws LlmError with kind 'config' when LLM_MAX_TOKENS is not an integer", () => {
    const fn = () => resolveLlmConfig({ LLM_MAX_TOKENS: "1.5" });
    expect(() => fn()).toThrow(LlmError);
    expect(() => fn()).toThrow(expect.objectContaining({ kind: "config" }));
  });

  it("uses LLM_TIMEOUT_MS when provided", () => {
    const result = resolveLlmConfig({ LLM_TIMEOUT_MS: "5000" });
    expect(result.timeoutMs).toBe(5000);
  });

  it("returns default timeout when LLM_TIMEOUT_MS is not provided", () => {
    const result = resolveLlmConfig({});
    expect(result.timeoutMs).toBe(LLM_DEFAULTS.timeoutMs);
  });
});

describe("buildRequestBody", () => {
  it("always includes reasoning_effort, max_tokens, stream and model", () => {
    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const body = buildRequestBody(config, request);

    expect(body).toHaveProperty("reasoning_effort", "low");
    expect(body).toHaveProperty("max_tokens", 1500);
    expect(body).toHaveProperty("stream", false);
    expect(body).toHaveProperty("model", "m");
  });

  it("does not include tools key when no tools are provided", () => {
    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const body = buildRequestBody(config, request);

    expect(body).not.toHaveProperty("tools");
  });

  it("includes tools when provided", () => {
    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
      tools: [
        {
          name: "update_draft",
          description: "d",
          parameters: { type: "object" },
        },
      ],
    };
    const body = buildRequestBody(config, request);

    expect(body).toHaveProperty("tools");
    expect(body.tools).toEqual([
      {
        type: "function",
        function: {
          name: "update_draft",
          description: "d",
          parameters: { type: "object" },
        },
      },
    ]);
  });

  it("includes response_format when jsonMode is true", () => {
    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
      jsonMode: true,
    };
    const body = buildRequestBody(config, request);

    expect(body).toHaveProperty("response_format", { type: "json_object" });
  });

  it("does not include response_format when jsonMode is false", () => {
    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
      jsonMode: false,
    };
    const body = buildRequestBody(config, request);

    expect(body).not.toHaveProperty("response_format");
  });

  it("does not include response_format when jsonMode is undefined", () => {
    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const body = buildRequestBody(config, request);

    expect(body).not.toHaveProperty("response_format");
  });

  it("converts assistant message with toolCalls to wire format", () => {
    const request: LlmRequest = {
      messages: [
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "c1", name: "geocode_address", arguments: "{}" }],
        },
      ],
    };
    const body = buildRequestBody(config, request);

    expect((body.messages as unknown[])[0]).toEqual({
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "c1",
          type: "function",
          function: { name: "geocode_address", arguments: "{}" },
        },
      ],
    });
  });

  it("converts tool message to wire format", () => {
    const request: LlmRequest = {
      messages: [
        {
          role: "tool",
          toolCallId: "c1",
          content: "{}",
        },
      ],
    };
    const body = buildRequestBody(config, request);

    expect((body.messages as unknown[])[0]).toEqual({
      role: "tool",
      tool_call_id: "c1",
      content: "{}",
    });
  });
});

describe("createLiveLlmClient", () => {
  let mockFetch: Mock<typeof fetch>;
  let mockNow: Mock<() => number>;

  beforeEach(() => {
    mockFetch = vi.fn();
    mockNow = vi.fn();
  });

  it("POSTs to the correct URL with proper headers", async () => {
    const client = createLiveLlmClient({
      config,
      fetch: mockFetch,
      now: mockNow,
    });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(successBody), { status: 200 }),
    );
    mockNow.mockReturnValueOnce(1000).mockReturnValueOnce(1250);

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    await client.complete(request);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://llm.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer k",
        },
        body: JSON.stringify(buildRequestBody(config, request)),
      }),
    );
  });

  it("does not include authorization header when API key is empty", async () => {
    const client = createLiveLlmClient({
      config: { ...config, apiKey: "" },
      fetch: mockFetch,
      now: mockNow,
    });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(successBody), { status: 200 }),
    );
    mockNow.mockReturnValueOnce(1000).mockReturnValueOnce(1250);

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    await client.complete(request);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://llm.test/v1/chat/completions",
      expect.objectContaining({
        headers: {
          "content-type": "application/json",
        },
      }),
    );
  });

  it("returns correct result with latency calculation", async () => {
    const client = createLiveLlmClient({
      config,
      fetch: mockFetch,
      now: mockNow,
    });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(successBody), { status: 200 }),
    );
    mockNow.mockReturnValueOnce(1000).mockReturnValueOnce(1250);

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const result = await client.complete(request);

    expect(result).toEqual({
      content: "hi",
      finishReason: "stop",
      inputTokens: 10,
      outputTokens: 3,
      latencyMs: 250,
      model: "m",
      toolCalls: [],
    });
  });

  it("maps tool calls correctly", async () => {
    const client = createLiveLlmClient({
      config,
      fetch: mockFetch,
      now: mockNow,
    });

    const bodyWithToolCalls = {
      ...successBody,
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: null,
            tool_calls: [
              {
                id: "c1",
                function: {
                  name: "suggest_price",
                  arguments: '{"sizeSqm":80}',
                },
              },
            ],
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(bodyWithToolCalls), { status: 200 }),
    );
    mockNow.mockReturnValueOnce(1000).mockReturnValueOnce(1250);

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const result = await client.complete(request);

    expect(result.toolCalls).toEqual([
      {
        id: "c1",
        name: "suggest_price",
        arguments: '{"sizeSqm":80}',
      },
    ]);
  });

  it("handles missing usage gracefully", async () => {
    const client = createLiveLlmClient({
      config,
      fetch: mockFetch,
      now: mockNow,
    });

    const bodyWithoutUsage = {
      ...successBody,
      usage: undefined,
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(bodyWithoutUsage), { status: 200 }),
    );
    mockNow.mockReturnValueOnce(1000).mockReturnValueOnce(1250);

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const result = await client.complete(request);

    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
  });

  it("rejects with kind 'http' and status on HTTP 500", async () => {
    const client = createLiveLlmClient({
      config,
      fetch: mockFetch,
      now: mockNow,
    });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "secret provider text" }), {
        status: 500,
      }),
    );

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const promise = client.complete(request);

    await expect(promise).rejects.toThrow(LlmError);
    await expect(promise).rejects.toHaveProperty("kind", "http");
    await expect(promise).rejects.toHaveProperty("status", 500);
    await expect(promise).rejects.toThrow(
      expect.not.stringContaining("secret provider text"),
    );
  });

  it("rejects with kind 'timeout' when fetch throws TimeoutError", async () => {
    const client = createLiveLlmClient({
      config,
      fetch: mockFetch,
      now: mockNow,
    });

    mockFetch.mockRejectedValueOnce(
      Object.assign(new Error("t"), { name: "TimeoutError" }),
    );

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const promise = client.complete(request);

    await expect(promise).rejects.toThrow(LlmError);
    await expect(promise).rejects.toHaveProperty("kind", "timeout");
  });

  it("rejects with kind 'http' when fetch throws TypeError", async () => {
    const client = createLiveLlmClient({
      config,
      fetch: mockFetch,
      now: mockNow,
    });

    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const promise = client.complete(request);

    await expect(promise).rejects.toThrow(LlmError);
    await expect(promise).rejects.toHaveProperty("kind", "http");
  });

  it("rejects with kind 'bad_response' when body is not JSON", async () => {
    const client = createLiveLlmClient({
      config,
      fetch: mockFetch,
      now: mockNow,
    });

    mockFetch.mockResolvedValueOnce(new Response("oops", { status: 200 }));

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const promise = client.complete(request);

    await expect(promise).rejects.toThrow(LlmError);
    await expect(promise).rejects.toHaveProperty("kind", "bad_response");
  });

  it("rejects with kind 'bad_response' when body has no choices", async () => {
    const client = createLiveLlmClient({
      config,
      fetch: mockFetch,
      now: mockNow,
    });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    );

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const promise = client.complete(request);

    await expect(promise).rejects.toThrow(LlmError);
    await expect(promise).rejects.toHaveProperty("kind", "bad_response");
  });

  it("rejects with kind 'truncated' when finish_reason is 'length' and content is empty without tool calls", async () => {
    const client = createLiveLlmClient({
      config,
      fetch: mockFetch,
      now: mockNow,
    });

    const truncatedBody = {
      ...successBody,
      choices: [
        {
          finish_reason: "length",
          message: { content: "", tool_calls: [] },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(truncatedBody), { status: 200 }),
    );

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const promise = client.complete(request);

    await expect(promise).rejects.toThrow(LlmError);
    await expect(promise).rejects.toHaveProperty("kind", "truncated");
  });

  it("resolves normally when finish_reason is 'length' with content present", async () => {
    const client = createLiveLlmClient({
      config,
      fetch: mockFetch,
      now: mockNow,
    });

    const truncatedBody = {
      ...successBody,
      choices: [
        {
          finish_reason: "length",
          message: { content: "partial", tool_calls: [] },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(truncatedBody), { status: 200 }),
    );
    mockNow.mockReturnValueOnce(1000).mockReturnValueOnce(1250);

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const result = await client.complete(request);

    expect(result.content).toBe("partial");
  });

  it("passes an AbortSignal to fetch", async () => {
    const client = createLiveLlmClient({
      config,
      fetch: mockFetch,
      now: mockNow,
    });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(successBody), { status: 200 }),
    );

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    await client.complete(request);

    const [, init] = mockFetch.mock.calls[0] ?? [];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("createFakeLlmClient", () => {
  let responder: Mock<FakeLlmResponder>;

  beforeEach(() => {
    responder = vi.fn();
  });

  it("mode is fake", () => {
    const client = createFakeLlmClient(responder);
    expect(client.mode).toBe("fake");
  });

  it("fills defaults and passes call index to responder", async () => {
    responder.mockReturnValueOnce({ content: "response1" });
    responder.mockReturnValueOnce({ content: "response2" });

    const client = createFakeLlmClient(responder);

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const result1 = await client.complete(request);
    const result2 = await client.complete(request);

    expect(responder).toHaveBeenNthCalledWith(1, request, 0);
    expect(responder).toHaveBeenNthCalledWith(2, request, 1);

    expect(result1).toEqual({
      content: "response1",
      finishReason: "stop",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      model: "fake",
      toolCalls: [],
    });

    expect(result2).toEqual({
      content: "response2",
      finishReason: "stop",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      model: "fake",
      toolCalls: [],
    });
  });

  it("rejects when responder throws", async () => {
    responder.mockImplementationOnce(() => {
      throw new Error("test error");
    });

    const client = createFakeLlmClient(responder);

    const request: LlmRequest = {
      messages: [{ role: "user", content: "hello" }],
    };
    const promise = client.complete(request);

    await expect(promise).rejects.toThrow("test error");
  });
});

describe("createLlmClientFromEnv", () => {
  it("returns live mode with default model when env is empty", () => {
    const client = createLlmClientFromEnv({});
    expect(client.mode).toBe("live");
    expect(client.model).toBe(LLM_DEFAULTS.model);
  });

  it("throws a config error when LLM_MODE=fake has no responder", () => {
    const fn = () =>
      createLlmClientFromEnv({ LLM_MODE: "fake", NODE_ENV: "test" });
    expect(() => fn()).toThrow(LlmError);
    expect(() => fn()).toThrow(expect.objectContaining({ kind: "config" }));
  });

  it("returns fake mode when LLM_MODE=fake and NODE_ENV=test with responder", () => {
    const responder = vi.fn();
    const client = createLlmClientFromEnv(
      { LLM_MODE: "fake", NODE_ENV: "test" },
      responder,
    );
    expect(client.mode).toBe("fake");
  });
});
