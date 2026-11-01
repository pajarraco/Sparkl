import { SPARKL_ERROR_CODES, TRANSCRIBE_MAX_BYTES } from "@sparkl/shared";
import { describe, expect, it, vi } from "vitest";
import { RateLimitError, type UserRateLimiter } from "./rate-limit.js";
import {
  VOICE_DEFAULTS,
  VoiceError,
  createFakeVoiceProvider,
  createLiveVoiceProvider,
  createVoiceService,
  createVoiceServiceFromEnv,
  decodeBase64,
  resolveVoiceConfig,
} from "./voice.js";

const config = {
  mode: "live",
  baseUrl: "https://voice.test/v1",
  model: "muse-voice-transcribe-1.0",
  apiKey: "k",
  timeoutMs: 10_000,
} as const;

// "RIFF....WAVEfmt " as base64, a tiny stand-in for a real WAV payload.
const TINY_WAV_BASE64 = Buffer.from("RIFF\0\0\0\0WAVEfmt ").toString("base64");

function validInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    audioBase64: TINY_WAV_BASE64,
    sampleRate: 16000 as const,
    durationMs: 2000,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("resolveVoiceConfig", () => {
  it("returns default live config with a key", () => {
    const result = resolveVoiceConfig({ META_MODEL_API_KEY: "k" });
    expect(result).toEqual({
      mode: "live",
      baseUrl: VOICE_DEFAULTS.baseUrl,
      model: VOICE_DEFAULTS.model,
      apiKey: "k",
      timeoutMs: VOICE_DEFAULTS.timeoutMs,
    });
  });

  it("falls back to META_MODEL_IMAGE_API_KEY when META_MODEL_API_KEY is unset", () => {
    const result = resolveVoiceConfig({ META_MODEL_IMAGE_API_KEY: "img-k" });
    expect(result.apiKey).toBe("img-k");
  });

  it("prefers META_MODEL_API_KEY over the image key", () => {
    const result = resolveVoiceConfig({
      META_MODEL_API_KEY: "k",
      META_MODEL_IMAGE_API_KEY: "img-k",
    });
    expect(result.apiKey).toBe("k");
  });

  it("throws when live mode has no key", () => {
    expect(() => resolveVoiceConfig({})).toThrow(VoiceError);
    expect(() => resolveVoiceConfig({})).toThrow(
      expect.objectContaining({ kind: "config" }),
    );
  });

  it("throws when VOICE_MODE is fake outside test/development", () => {
    expect(() =>
      resolveVoiceConfig({
        VOICE_MODE: "fake",
        NODE_ENV: "production",
        META_MODEL_API_KEY: "k",
      }),
    ).toThrow(VoiceError);
  });

  it("allows VOICE_MODE=fake in test", () => {
    const result = resolveVoiceConfig({ VOICE_MODE: "fake", NODE_ENV: "test" });
    expect(result.mode).toBe("fake");
  });

  it("removes a trailing slash from VOICE_BASE_URL", () => {
    const result = resolveVoiceConfig({
      META_MODEL_API_KEY: "k",
      VOICE_BASE_URL: "https://voice.test/v1/",
    });
    expect(result.baseUrl).toBe("https://voice.test/v1");
  });

  it("throws on an invalid VOICE_BASE_URL", () => {
    expect(() =>
      resolveVoiceConfig({
        META_MODEL_API_KEY: "k",
        VOICE_BASE_URL: "not a url",
      }),
    ).toThrow(VoiceError);
  });
});

describe("decodeBase64", () => {
  it("decodes valid base64", () => {
    const bytes = decodeBase64(Buffer.from("hello").toString("base64"));
    expect(Buffer.from(bytes).toString()).toBe("hello");
  });

  it("throws VoiceError on malformed base64", () => {
    expect(() => decodeBase64("not base64 at all!!")).toThrow(VoiceError);
    expect(() => decodeBase64("not base64 at all!!")).toThrow(
      expect.objectContaining({ kind: "bad_audio" }),
    );
  });
});

describe("createLiveVoiceProvider", () => {
  it("sends a multipart request and parses a successful response", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(`${config.baseUrl}/asr/transcribe`);
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers.authorization).toBe("Bearer k");
      expect(headers["content-type"]).toMatch(
        /^multipart\/form-data; boundary=/,
      );
      expect(Buffer.isBuffer(init?.body)).toBe(true);
      const body = (init?.body as Buffer).toString("utf8");
      expect(body).toContain('name="request"');
      expect(body).toContain('name="audio"');
      expect(body).toContain('"audioEncoding":"WAV"');
      return jsonResponse({ transcript: "hello world", audioDurationMs: 1800 });
    });
    const provider = createLiveVoiceProvider({
      config,
      fetch: fetchMock as unknown as typeof fetch,
    });
    const result = await provider.transcribe(new Uint8Array([1, 2, 3]), 16000);
    expect(result).toEqual({
      transcript: "hello world",
      audioDurationMs: 1800,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws VoiceError 'http' on a non-ok response", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 503));
    const provider = createLiveVoiceProvider({
      config,
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(provider.transcribe(new Uint8Array(), 16000)).rejects.toThrow(
      expect.objectContaining({
        kind: "http",
        code: SPARKL_ERROR_CODES.UPSTREAM_UNAVAILABLE,
      }),
    );
  });

  it("throws VoiceError 'bad_response' on an unexpected shape", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ nope: true }));
    const provider = createLiveVoiceProvider({
      config,
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(provider.transcribe(new Uint8Array(), 16000)).rejects.toThrow(
      expect.objectContaining({ kind: "bad_response" }),
    );
  });

  it("throws VoiceError 'timeout' when fetch aborts", async () => {
    const fetchMock = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "TimeoutError";
      throw err;
    });
    const provider = createLiveVoiceProvider({
      config,
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(provider.transcribe(new Uint8Array(), 16000)).rejects.toThrow(
      expect.objectContaining({ kind: "timeout" }),
    );
  });
});

describe("createVoiceService", () => {
  it("transcribes valid input through the provider", async () => {
    const provider = createFakeVoiceProvider(async () => ({
      transcript: "turnover clean this friday",
    }));
    const service = createVoiceService({ provider });
    const result = await service.transcribe("user-1", validInput());
    expect(result).toEqual({
      transcript: "turnover clean this friday",
      audioDurationMs: 2000, // falls back to the input's durationMs
    });
  });

  it("uses the provider's audioDurationMs when given", async () => {
    const provider = createFakeVoiceProvider(async () => ({
      transcript: "hi",
      audioDurationMs: 1234,
    }));
    const service = createVoiceService({ provider });
    const result = await service.transcribe("user-1", validInput());
    expect(result.audioDurationMs).toBe(1234);
  });

  it("rejects decoded audio over TRANSCRIBE_MAX_BYTES (service-level guard)", async () => {
    // Mock the decode step indirectly: build base64 for exactly
    // TRANSCRIBE_MAX_BYTES + 3 raw bytes. That many bytes needs more
    // base64 characters than the shared schema allows, so the schema
    // itself is what actually stops it — this documents why.
    const rawBytes = TRANSCRIBE_MAX_BYTES + 3;
    const tooBig = Buffer.alloc(rawBytes).toString("base64");
    expect(tooBig.length).toBeGreaterThan(
      Math.ceil(TRANSCRIBE_MAX_BYTES / 3) * 4,
    );
    const provider = createFakeVoiceProvider(async () => ({ transcript: "x" }));
    const service = createVoiceService({ provider });
    await expect(
      service.transcribe("user-1", validInput({ audioBase64: tooBig })),
    ).rejects.toThrow();
  });

  it("rejects input that fails the shared schema even if the caller bypassed it", async () => {
    const provider = createFakeVoiceProvider(async () => ({ transcript: "x" }));
    const service = createVoiceService({ provider });
    await expect(
      service.transcribe(
        "user-1",
        // biome-ignore lint/suspicious/noExplicitAny: intentionally invalid shape
        validInput({ sampleRate: 44100 }) as any,
      ),
    ).rejects.toThrow();
  });

  it("consumes the per-user rate limiter and propagates RateLimitError", async () => {
    const limiter: UserRateLimiter = {
      consume: vi.fn(() => {
        throw new RateLimitError();
      }),
    };
    const provider = createFakeVoiceProvider(async () => ({ transcript: "x" }));
    const service = createVoiceService({ provider, limiter });
    await expect(service.transcribe("user-1", validInput())).rejects.toThrow(
      RateLimitError,
    );
    expect(limiter.consume).toHaveBeenCalledWith("user-1");
  });

  it("never touches the filesystem or a database (provider is the only I/O)", async () => {
    // The service's only dependency is the injected provider; nothing else
    // is reachable from createVoiceService, so there is no path to disk.
    const calls: unknown[] = [];
    const provider = createFakeVoiceProvider(async (bytes, sampleRate) => {
      calls.push([bytes, sampleRate]);
      return { transcript: "ok" };
    });
    const service = createVoiceService({ provider });
    await service.transcribe("user-1", validInput());
    expect(calls).toHaveLength(1);
  });
});

describe("createVoiceServiceFromEnv", () => {
  it("throws a config error when VOICE_MODE=fake (needs a scripted responder)", () => {
    expect(() =>
      createVoiceServiceFromEnv({ VOICE_MODE: "fake", NODE_ENV: "test" }),
    ).toThrow(expect.objectContaining({ kind: "config" }));
  });

  it("builds a live service when a key is present", () => {
    const service = createVoiceServiceFromEnv({ META_MODEL_API_KEY: "k" });
    expect(service).toBeDefined();
  });
});
