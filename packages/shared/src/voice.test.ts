import { describe, expect, it } from "vitest";
import { TRANSCRIBE_MAX_BASE64_CHARS, transcribeInput } from "./voice";

describe("voice", () => {
  it("parses a valid input", () => {
    const result = transcribeInput.safeParse({
      audioBase64: "UklGRg==",
      sampleRate: 16000,
      durationMs: 8320,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.audioBase64).toBe("UklGRg==");
      expect(result.data.sampleRate).toBe(16000);
      expect(result.data.durationMs).toBe(8320);
    }
  });

  it("rejects sampleRate 44100", () => {
    const result = transcribeInput.safeParse({
      audioBase64: "UklGRg==",
      sampleRate: 44100,
      durationMs: 8320,
    });
    expect(result.success).toBe(false);
  });

  it("rejects durationMs 30001", () => {
    const result = transcribeInput.safeParse({
      audioBase64: "UklGRg==",
      sampleRate: 16000,
      durationMs: 30001,
    });
    expect(result.success).toBe(false);
  });

  it("rejects base64 with space", () => {
    const result = transcribeInput.safeParse({
      audioBase64: "Ukl GRg==",
      sampleRate: 16000,
      durationMs: 8320,
    });
    expect(result.success).toBe(false);
  });

  it("rejects base64 with dash", () => {
    const result = transcribeInput.safeParse({
      audioBase64: "Ukl-GRg==",
      sampleRate: 16000,
      durationMs: 8320,
    });
    expect(result.success).toBe(false);
  });

  it("rejects string one char longer than TRANSCRIBE_MAX_BASE64_CHARS", () => {
    const longString = "A".repeat(TRANSCRIBE_MAX_BASE64_CHARS + 1);
    const result = transcribeInput.safeParse({
      audioBase64: longString,
      sampleRate: 16000,
      durationMs: 8320,
    });
    expect(result.success).toBe(false);
  });

  it("TRANSCRIBE_MAX_BASE64_CHARS equals 2000000", () => {
    expect(TRANSCRIBE_MAX_BASE64_CHARS).toBe(2000000);
  });
});
