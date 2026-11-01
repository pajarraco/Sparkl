import {
  TRANSCRIBE_MAX_BYTES,
  TRANSCRIBE_MAX_DURATION_MS,
  type TranscribeInput,
} from "@sparkl/shared";
import { getStrings } from "./i18n";
import { bytesToBase64 } from "./wav-encode";

// Pure state and helpers for the Post-tab mic button (rules.md: no logic
// in components). The platform-specific recording glue (expo-audio on
// native, MediaRecorder + AudioContext on web) lives in MicButton /
// MicButton.web, which call these helpers rather than re-implement them.

export type VoiceRecorderStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "error";

export interface VoiceState {
  status: VoiceRecorderStatus;
  error: string | null;
}

export function createVoiceState(): VoiceState {
  return { status: "idle", error: null };
}

export function startRecording(): VoiceState {
  return { status: "recording", error: null };
}

export function startTranscribing(): VoiceState {
  return { status: "transcribing", error: null };
}

export function finishedTranscribing(): VoiceState {
  return { status: "idle", error: null };
}

export function failedWith(message: string): VoiceState {
  return { status: "error", error: message };
}

// The recording is capped client-side (the shared schema caps it again,
// server-side) so a long press never sends audio the server will reject.
export function validateRecording(
  byteLength: number,
  durationMs: number,
): string | null {
  const strings = getStrings();
  if (durationMs > TRANSCRIBE_MAX_DURATION_MS)
    return strings.assistant.micTooLong;
  if (byteLength > TRANSCRIBE_MAX_BYTES) return strings.assistant.micTooLong;
  return null;
}

export type VoiceSampleRate = 16000 | 24000;

// WAV bytes → the transcribe input the router expects.
export function buildTranscribeInput(
  wavBytes: Uint8Array,
  sampleRate: VoiceSampleRate,
  durationMs: number,
): TranscribeInput {
  return {
    audioBase64: bytesToBase64(wavBytes),
    sampleRate,
    durationMs: Math.round(durationMs),
  };
}

// tRPC client errors carry the mapped code in data.code, same convention
// as assistantErrorMessage in job-assistant.ts.
export function voiceErrorMessage(error: unknown): string {
  const strings = getStrings();
  const code = (error as { data?: { code?: unknown } } | null)?.data?.code;
  if (code === "TOO_MANY_REQUESTS") return strings.assistant.rateLimited;
  return strings.assistant.micError;
}
