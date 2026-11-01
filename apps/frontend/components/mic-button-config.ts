// Shared by MicButton.tsx and MicButton.web.tsx. Kept in its own file: on
// web, importing "./MicButton" from MicButton.web.tsx resolves to itself.

import type { VoiceSampleRate } from "../providers/voice";

export interface MicButtonProps {
  // Called once a recording stops with usable audio. The caller owns the
  // transcribe call and lands the result in the composer.
  onRecorded: (
    wavBytes: Uint8Array,
    sampleRate: VoiceSampleRate,
    durationMs: number,
  ) => void;
  onError: (message: string) => void;
  disabled?: boolean | undefined;
  testID?: string | undefined;
}

export const MIC_SAMPLE_RATE: VoiceSampleRate = 16000;
