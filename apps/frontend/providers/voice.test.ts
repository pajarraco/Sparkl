import {
  TRANSCRIBE_MAX_BYTES,
  TRANSCRIBE_MAX_DURATION_MS,
} from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import { getStrings } from "./i18n";
import {
  buildTranscribeInput,
  createVoiceState,
  failedWith,
  finishedTranscribing,
  startRecording,
  startTranscribing,
  validateRecording,
  voiceErrorMessage,
} from "./voice";

const strings = getStrings();

describe("voice state machine", () => {
  it("starts idle with no error", () => {
    expect(createVoiceState()).toEqual({ status: "idle", error: null });
  });

  it("transitions idle -> recording -> transcribing -> idle", () => {
    let state = createVoiceState();
    state = startRecording();
    expect(state.status).toBe("recording");
    state = startTranscribing();
    expect(state.status).toBe("transcribing");
    state = finishedTranscribing();
    expect(state).toEqual({ status: "idle", error: null });
  });

  it("carries an error message on failure", () => {
    const state = failedWith(strings.assistant.micError);
    expect(state).toEqual({
      status: "error",
      error: strings.assistant.micError,
    });
  });
});

describe("validateRecording", () => {
  it("allows a recording within both caps", () => {
    expect(validateRecording(1000, 5000)).toBeNull();
  });

  it("rejects a recording over the duration cap", () => {
    expect(validateRecording(1000, TRANSCRIBE_MAX_DURATION_MS + 1)).toBe(
      strings.assistant.micTooLong,
    );
  });

  it("rejects a recording over the byte cap", () => {
    expect(validateRecording(TRANSCRIBE_MAX_BYTES + 1, 1000)).toBe(
      strings.assistant.micTooLong,
    );
  });
});

describe("buildTranscribeInput", () => {
  it("base64-encodes the WAV bytes and rounds the duration", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const input = buildTranscribeInput(bytes, 16000, 999.6);
    expect(input).toEqual({
      audioBase64: Buffer.from(bytes).toString("base64"),
      sampleRate: 16000,
      durationMs: 1000,
    });
  });
});

describe("voiceErrorMessage", () => {
  it("maps TOO_MANY_REQUESTS to the rate-limited string", () => {
    const err = { data: { code: "TOO_MANY_REQUESTS" } };
    expect(voiceErrorMessage(err)).toBe(strings.assistant.rateLimited);
  });

  it("falls back to the generic mic-error string", () => {
    expect(voiceErrorMessage(new Error("boom"))).toBe(
      strings.assistant.micError,
    );
  });
});
