// Plain-TS 16-bit PCM WAV encoding (no dependency). Used by the web mic
// path: MediaRecorder produces WebM/Opus, which Muse Voice Transcribe does
// not accept, so the captured audio is decoded with AudioContext and
// re-encoded here before it is sent (02 plan, "Voice format gap").

export function floatTo16BitPcm(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return out;
}

function writeString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

// A minimal, canonical 44-byte-header WAV: PCM, mono, 16-bit.
export function encodePcm16Wav(
  samples: Int16Array,
  sampleRate: number,
): Uint8Array {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    view.setInt16(offset, samples[i] ?? 0, true);
  }

  return new Uint8Array(buffer);
}

export function encodeFloat32Wav(
  samples: Float32Array,
  sampleRate: number,
): Uint8Array {
  return encodePcm16Wav(floatTo16BitPcm(samples), sampleRate);
}

// base64 without Buffer, so it works the same in a browser and in RN/Hermes.
export function bytesToBase64(bytes: Uint8Array): string {
  const globalBtoa = (globalThis as { btoa?: (data: string) => string }).btoa;
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  if (typeof globalBtoa === "function") return globalBtoa(binary);
  // Node test environment: no btoa prior to 16; Buffer always works there.
  return Buffer.from(binary, "binary").toString("base64");
}
