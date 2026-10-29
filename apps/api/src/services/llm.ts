import { z } from "zod";

// OpenAI-compatible chat-completions client on plain fetch (no SDK). One
// port, two modes: `live` talks to Ollama (local) or Baseten (real) — only
// the env changes — and `fake` replays scripted results for tests and e2e.
// Errors never carry prompt, reply or provider body text: callers log
// metadata only (model, latency, tokens, tool names).

export const LLM_MODES = ["live", "fake"] as const;
export type LlmMode = (typeof LLM_MODES)[number];

export const LLM_DEFAULTS = {
  baseUrl: "http://localhost:11434/v1",
  model: "muse-glimmer:latest",
  maxTokens: 1500,
  timeoutMs: 20_000,
} as const;

// Fake mode must never answer real users.
const FAKE_ALLOWED_NODE_ENVS = new Set(["test", "development"]);

export type LlmErrorKind =
  | "config"
  | "timeout"
  | "http"
  | "bad_response"
  | "truncated";

export class LlmError extends Error {
  readonly kind: LlmErrorKind;
  readonly status: number | undefined;

  constructor(kind: LlmErrorKind, message: string, status?: number) {
    super(message);
    this.name = "LlmError";
    this.kind = kind;
    this.status = status;
  }
}

export interface LlmToolCall {
  id: string;
  name: string;
  // Raw JSON text as the model sent it; callers Zod-parse it.
  arguments: string;
}

export type LlmMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: LlmToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export interface LlmTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmRequest {
  messages: LlmMessage[];
  tools?: LlmTool[];
  jsonMode?: boolean;
}

export interface LlmResult {
  content: string | null;
  toolCalls: LlmToolCall[];
  finishReason: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  model: string;
}

export interface LlmClient {
  readonly mode: LlmMode;
  readonly model: string;
  complete(request: LlmRequest): Promise<LlmResult>;
}

export interface LlmConfig {
  mode: LlmMode;
  baseUrl: string;
  model: string;
  apiKey: string;
  maxTokens: number;
  timeoutMs: number;
}

type Env = Record<string, string | undefined>;

function isLocalhost(url: URL): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

function positiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new LlmError(
      "config",
      "LLM numeric settings must be positive integers",
    );
  }
  return value;
}

export function resolveLlmConfig(env: Env = process.env): LlmConfig {
  const mode = (env.LLM_MODE ?? "live").trim() as LlmMode;
  if (!LLM_MODES.includes(mode)) {
    throw new LlmError("config", "LLM_MODE must be live or fake");
  }
  if (mode === "fake" && !FAKE_ALLOWED_NODE_ENVS.has(env.NODE_ENV ?? "")) {
    throw new LlmError(
      "config",
      "LLM_MODE=fake is only allowed when NODE_ENV is test or development",
    );
  }

  const baseUrl = (env.LLM_BASE_URL || LLM_DEFAULTS.baseUrl).replace(
    /\/+$/,
    "",
  );
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new LlmError("config", "LLM_BASE_URL is not a valid URL");
  }
  const apiKey = env.LLM_API_KEY ?? "";
  // Keys only travel over TLS; plain http is for a local Ollama.
  if (mode === "live" && !isLocalhost(parsed)) {
    if (parsed.protocol !== "https:") {
      throw new LlmError("config", "a remote LLM_BASE_URL must use https");
    }
    if (apiKey === "") {
      throw new LlmError("config", "LLM_API_KEY is required for a remote LLM");
    }
  }

  return {
    mode,
    baseUrl,
    model: env.LLM_MODEL || LLM_DEFAULTS.model,
    apiKey,
    maxTokens: positiveInt(env.LLM_MAX_TOKENS, LLM_DEFAULTS.maxTokens),
    timeoutMs: positiveInt(env.LLM_TIMEOUT_MS, LLM_DEFAULTS.timeoutMs),
  };
}

// Only the fields we use; extra provider fields pass through untouched.
const completionSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        message: z.object({
          content: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                id: z.string().min(1),
                function: z.object({
                  name: z.string().min(1),
                  arguments: z.string().nullish(),
                }),
              }),
            )
            .nullish(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().min(0).optional(),
      completion_tokens: z.number().int().min(0).optional(),
    })
    .nullish(),
});

function toWireMessage(message: LlmMessage): Record<string, unknown> {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content,
    };
  }
  if (message.role === "assistant" && message.toolCalls?.length) {
    return {
      role: "assistant",
      content: message.content,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments },
      })),
    };
  }
  return { role: message.role, content: message.content };
}

export function buildRequestBody(
  config: Pick<LlmConfig, "model" | "maxTokens">,
  request: LlmRequest,
): Record<string, unknown> {
  return {
    model: config.model,
    messages: request.messages.map(toWireMessage),
    ...(request.tools?.length
      ? {
          tools: request.tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          })),
        }
      : {}),
    ...(request.jsonMode ? { response_format: { type: "json_object" } } : {}),
    // Spark spends the whole budget on reasoning without this (02 Verified Facts).
    reasoning_effort: "low",
    max_tokens: config.maxTokens,
    stream: false,
  };
}

export interface LiveLlmDeps {
  config: LlmConfig;
  fetch?: typeof fetch;
  now?: () => number;
}

export function createLiveLlmClient(deps: LiveLlmDeps): LlmClient {
  const { config } = deps;
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;

  return {
    mode: "live",
    model: config.model,
    async complete(request) {
      const started = now();
      let response: Response;
      try {
        response = await doFetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(config.apiKey
              ? { authorization: `Bearer ${config.apiKey}` }
              : {}),
          },
          body: JSON.stringify(buildRequestBody(config, request)),
          signal: AbortSignal.timeout(config.timeoutMs),
        });
      } catch (err) {
        const name = (err as { name?: unknown } | null)?.name;
        if (name === "TimeoutError" || name === "AbortError") {
          throw new LlmError(
            "timeout",
            `LLM call timed out after ${config.timeoutMs} ms`,
          );
        }
        throw new LlmError("http", "LLM endpoint unreachable");
      }

      if (!response.ok) {
        throw new LlmError(
          "http",
          `LLM call failed with HTTP ${response.status}`,
          response.status,
        );
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new LlmError("bad_response", "LLM response is not JSON");
      }
      const parsed = completionSchema.safeParse(json);
      if (!parsed.success) {
        throw new LlmError(
          "bad_response",
          "LLM response has an unexpected shape",
        );
      }

      const choice = parsed.data.choices[0];
      const content = choice?.message.content ?? null;
      const toolCalls = (choice?.message.tool_calls ?? []).map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments ?? "",
      }));
      const finishReason = choice?.finish_reason ?? "unknown";
      if (
        finishReason === "length" &&
        !content?.trim() &&
        toolCalls.length === 0
      ) {
        throw new LlmError(
          "truncated",
          "LLM ran out of tokens before answering",
        );
      }

      return {
        content,
        toolCalls,
        finishReason,
        inputTokens: parsed.data.usage?.prompt_tokens ?? 0,
        outputTokens: parsed.data.usage?.completion_tokens ?? 0,
        latencyMs: now() - started,
        model: parsed.data.model ?? config.model,
      };
    },
  };
}

export type FakeLlmResponder = (
  request: LlmRequest,
  callIndex: number,
) => Partial<LlmResult> | Promise<Partial<LlmResult>>;

// Scripted client: each call gets the responder's result, with zeroed
// metadata filled in. A thrown error propagates, so tests can script failures.
export function createFakeLlmClient(
  responder: FakeLlmResponder,
  model = "fake",
): LlmClient {
  let calls = 0;
  return {
    mode: "fake",
    model,
    async complete(request) {
      const result = await responder(request, calls++);
      return {
        content: null,
        toolCalls: [],
        finishReason: "stop",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        model,
        ...result,
      };
    },
  };
}

// Live client from env. Fake mode needs a responder, which only tests and
// the e2e boot path provide, so it is built with createFakeLlmClient.
export function createLlmClientFromEnv(
  env: Env = process.env,
  fakeResponder?: FakeLlmResponder,
): LlmClient {
  const config = resolveLlmConfig(env);
  if (config.mode === "fake") {
    if (!fakeResponder) {
      throw new LlmError("config", "LLM_MODE=fake needs a scripted responder");
    }
    return createFakeLlmClient(fakeResponder, config.model);
  }
  return createLiveLlmClient({ config });
}
