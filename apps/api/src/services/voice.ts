import {
  SPARKL_ERROR_CODES,
  type SparklErrorCode,
  TRANSCRIBE_MAX_BYTES,
  type TranscribeInput,
  type TranscribeOutput,
  transcribeInput as transcribeInputSchema,
  transcribeOutput as transcribeOutputSchema,
} from "@sparkl/shared";
import { z } from "zod";
import { type UserRateLimiter, createUserRateLimiter } from "./rate-limit.js";

// Muse Voice Transcribe through the Meta Model API. Audio arrives as base64
// in the request body, is decoded to WAV bytes in memory, sent upstream and
// discarded. It is never written to disk or a database, and neither the
// audio nor the transcript is ever logged — only metadata (latency,
// duration) if a caller chooses to log at all.

export const VOICE_MODES = ["live", "fake"] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

export const VOICE_DEFAULTS = {
  baseUrl: "https://api.meta.ai/v1",
  model: "muse-voice-transcribe-1.0",
  timeoutMs: 10_000,
  userLimit: 20,
  userWindowMs: 60_000,
} as const;

// Fake mode must never answer real users.
const FAKE_ALLOWED_NODE_ENVS = new Set(["test", "development"]);

export type VoiceErrorKind =
  | "config"
  | "timeout"
  | "http"
  | "bad_response"
  | "bad_audio";

export class VoiceError extends Error {
  readonly kind: VoiceErrorKind;
  readonly code: SparklErrorCode;
  readonly status: number | undefined;

  constructor(
    kind: VoiceErrorKind,
    message: string,
    code: SparklErrorCode = SPARKL_ERROR_CODES.UPSTREAM_UNAVAILABLE,
    status?: number,
  ) {
    super(message);
    this.name = "VoiceError";
    this.kind = kind;
    this.code = code;
    this.status = status;
  }
}

export interface VoiceProviderClient {
  transcribe(
    wavBytes: Uint8Array,
    sampleRate: number,
  ): Promise<{
    transcript: string;
    audioDurationMs: number | null;
  }>;
}

export interface VoiceConfig {
  mode: VoiceMode;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

type Env = Record<string, string | undefined>;

function positiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new VoiceError(
      "config",
      "voice numeric settings must be positive integers",
      SPARKL_ERROR_CODES.VALIDATION_ERROR,
    );
  }
  return value;
}

export function resolveVoiceConfig(env: Env = process.env): VoiceConfig {
  const mode = (env.VOICE_MODE ?? "live").trim() as VoiceMode;
  if (!VOICE_MODES.includes(mode)) {
    throw new VoiceError(
      "config",
      "VOICE_MODE must be live or fake",
      SPARKL_ERROR_CODES.VALIDATION_ERROR,
    );
  }
  if (mode === "fake" && !FAKE_ALLOWED_NODE_ENVS.has(env.NODE_ENV ?? "")) {
    throw new VoiceError(
      "config",
      "VOICE_MODE=fake is only allowed when NODE_ENV is test or development",
      SPARKL_ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const baseUrl = (env.VOICE_BASE_URL || VOICE_DEFAULTS.baseUrl).replace(
    /\/+$/,
    "",
  );
  try {
    new URL(baseUrl);
  } catch {
    throw new VoiceError(
      "config",
      "VOICE_BASE_URL is not a valid URL",
      SPARKL_ERROR_CODES.VALIDATION_ERROR,
    );
  }
  // Falls back to the image key: the owner's only Meta Model API key covers
  // every model on the account (02 Verified Facts).
  const apiKey = env.META_MODEL_API_KEY || env.META_MODEL_IMAGE_API_KEY || "";
  if (mode === "live" && apiKey === "") {
    throw new VoiceError(
      "config",
      "META_MODEL_API_KEY (or META_MODEL_IMAGE_API_KEY) is required",
      SPARKL_ERROR_CODES.VALIDATION_ERROR,
    );
  }

  return {
    mode,
    baseUrl,
    model: env.VOICE_MODEL || VOICE_DEFAULTS.model,
    apiKey,
    timeoutMs: positiveInt(env.VOICE_TIMEOUT_MS, VOICE_DEFAULTS.timeoutMs),
  };
}

// Only the fields we use; extra provider fields pass through untouched.
const transcribeResponseSchema = z.object({
  transcript: z.string(),
  audioDurationMs: z.number().int().min(0).nullish(),
});

export interface LiveVoiceDeps {
  config: VoiceConfig;
  fetch?: typeof fetch | undefined;
}

// Built by hand (Buffer concatenation) rather than the global FormData/Blob
// constructors: this file is pulled into the frontend's type-check through
// its type-only AppRouter import, and React Native's ambient types replace
// both globals with an incompatible, RN-specific shape. Buffer has no such
// override, so this is also simpler to keep correct across both programs.
function buildMultipartBody(
  boundary: string,
  parts: { name: string; contentType: string; data: Buffer | string }[],
): Buffer {
  const segments: Buffer[] = [];
  for (const part of parts) {
    segments.push(
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${part.name}"\r\n` +
          `Content-Type: ${part.contentType}\r\n\r\n`,
      ),
      Buffer.isBuffer(part.data) ? part.data : Buffer.from(part.data),
      Buffer.from("\r\n"),
    );
  }
  segments.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(segments);
}

export function createLiveVoiceProvider(
  deps: LiveVoiceDeps,
): VoiceProviderClient {
  const { config } = deps;
  const doFetch = deps.fetch ?? fetch;

  return {
    async transcribe(wavBytes, sampleRate) {
      const boundary = `sparkl-${Math.random().toString(16).slice(2)}`;
      const body = buildMultipartBody(boundary, [
        {
          name: "request",
          contentType: "application/json",
          data: JSON.stringify({
            model: config.model,
            audioEncoding: "WAV",
            sampleRate,
          }),
        },
        {
          name: "audio",
          contentType: "audio/wav",
          data: Buffer.from(wavBytes),
        },
      ]);

      let response: Response;
      try {
        response = await doFetch(`${config.baseUrl}/asr/transcribe`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            "content-type": `multipart/form-data; boundary=${boundary}`,
          },
          body,
          signal: AbortSignal.timeout(config.timeoutMs),
        });
      } catch (err) {
        const name = (err as { name?: unknown } | null)?.name;
        if (name === "TimeoutError" || name === "AbortError") {
          throw new VoiceError(
            "timeout",
            `voice transcription timed out after ${config.timeoutMs} ms`,
          );
        }
        throw new VoiceError("http", "voice transcription is unreachable");
      }

      if (!response.ok) {
        throw new VoiceError(
          "http",
          `voice transcription failed with HTTP ${response.status}`,
          SPARKL_ERROR_CODES.UPSTREAM_UNAVAILABLE,
          response.status,
        );
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new VoiceError(
          "bad_response",
          "voice transcription returned an unreadable response",
        );
      }
      const parsed = transcribeResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new VoiceError(
          "bad_response",
          "voice transcription response has an unexpected shape",
        );
      }
      return {
        transcript: parsed.data.transcript,
        audioDurationMs: parsed.data.audioDurationMs ?? null,
      };
    },
  };
}

export type FakeVoiceResponder = (
  wavBytes: Uint8Array,
  sampleRate: number,
) =>
  | { transcript: string; audioDurationMs?: number }
  | Promise<{ transcript: string; audioDurationMs?: number }>;

export function createFakeVoiceProvider(
  responder: FakeVoiceResponder,
): VoiceProviderClient {
  return {
    async transcribe(wavBytes, sampleRate) {
      const result = await responder(wavBytes, sampleRate);
      return {
        transcript: result.transcript,
        audioDurationMs: result.audioDurationMs ?? null,
      };
    },
  };
}

// --- decoding ---

// base64 → bytes with no Buffer-specific API, so the same check works if
// this ever runs outside Node. Throws on malformed input.
export function decodeBase64(base64: string): Uint8Array {
  const buffer = Buffer.from(base64, "base64");
  // Buffer.from silently drops invalid characters instead of throwing;
  // round-tripping catches truncation from a corrupt payload.
  if (
    buffer.toString("base64").replace(/=+$/, "") !== base64.replace(/=+$/, "")
  ) {
    throw new VoiceError(
      "bad_audio",
      "audio is not valid base64",
      SPARKL_ERROR_CODES.VALIDATION_ERROR,
    );
  }
  return buffer;
}

// --- service ---

export interface VoiceService {
  transcribe(userId: string, input: TranscribeInput): Promise<TranscribeOutput>;
}

export interface VoiceServiceDeps {
  provider: VoiceProviderClient;
  limiter?: UserRateLimiter;
}

export function createVoiceService(deps: VoiceServiceDeps): VoiceService {
  const limiter =
    deps.limiter ??
    createUserRateLimiter({
      limit: VOICE_DEFAULTS.userLimit,
      windowMs: VOICE_DEFAULTS.userWindowMs,
    });

  return {
    async transcribe(userId, rawInput) {
      limiter.consume(userId);
      // Defence in depth: the router already validates with the same
      // schema, but the service never trusts a caller blindly either.
      const input = transcribeInputSchema.parse(rawInput);
      const wavBytes = decodeBase64(input.audioBase64);
      if (wavBytes.byteLength > TRANSCRIBE_MAX_BYTES) {
        throw new VoiceError(
          "bad_audio",
          "audio exceeds the maximum size",
          SPARKL_ERROR_CODES.VALIDATION_ERROR,
        );
      }

      const result = await deps.provider.transcribe(wavBytes, input.sampleRate);
      const output = transcribeOutputSchema.parse({
        transcript: result.transcript,
        audioDurationMs: result.audioDurationMs ?? input.durationMs,
      });
      return output;
    },
  };
}

// --- wiring from env ---

export function createVoiceServiceFromEnv(
  env: Env = process.env,
  fetchImpl?: typeof fetch,
): VoiceService {
  const config = resolveVoiceConfig(env);
  if (config.mode === "fake") {
    // Fake mode needs a real responder; only tests and the e2e boot path
    // provide one, by calling createVoiceService directly instead.
    throw new VoiceError(
      "config",
      "VOICE_MODE=fake needs a scripted responder; call createVoiceService directly",
      SPARKL_ERROR_CODES.VALIDATION_ERROR,
    );
  }
  return createVoiceService({
    provider: createLiveVoiceProvider({ config, fetch: fetchImpl }),
  });
}

let singleton: VoiceService | undefined;

// One per process, so the per-user rate limit is shared by every request.
export function getVoiceService(): VoiceService {
  singleton ??= createVoiceServiceFromEnv();
  return singleton;
}
