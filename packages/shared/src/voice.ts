import { z } from "zod";

// Audio is sent as base64 in the request body and never stored.
export const TRANSCRIBE_MAX_BYTES = 1_500_000; // decoded audio size
export const TRANSCRIBE_MAX_DURATION_MS = 30_000;
export const TRANSCRIBE_SAMPLE_RATES = [16000, 24000] as const;
// base64 of TRANSCRIBE_MAX_BYTES bytes
export const TRANSCRIBE_MAX_BASE64_CHARS =
  Math.ceil(TRANSCRIBE_MAX_BYTES / 3) * 4;

export const transcribeInput = z
  .object({
    audioBase64: z
      .string()
      .min(1)
      .max(TRANSCRIBE_MAX_BASE64_CHARS)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    sampleRate: z.union([z.literal(16000), z.literal(24000)]),
    durationMs: z.number().int().positive().max(TRANSCRIBE_MAX_DURATION_MS),
  })
  .strict();
export type TranscribeInput = z.infer<typeof transcribeInput>;

export const transcribeOutput = z
  .object({
    transcript: z.string().max(5000),
    audioDurationMs: z.number().int().min(0),
  })
  .strict();
export type TranscribeOutput = z.infer<typeof transcribeOutput>;
