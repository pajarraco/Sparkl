import { describe, expect, it } from "vitest";
import {
  bytesToBase64,
  encodeFloat32Wav,
  encodePcm16Wav,
  floatTo16BitPcm,
} from "./wav-encode";

describe("floatTo16BitPcm", () => {
  it("maps -1..1 to the full int16 range", () => {
    const out = floatTo16BitPcm(new Float32Array([-1, 0, 1]));
    expect(out[0]).toBe(-0x8000);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0x7fff);
  });

  it("clamps values outside -1..1", () => {
    const out = floatTo16BitPcm(new Float32Array([-2, 2]));
    expect(out[0]).toBe(-0x8000);
    expect(out[1]).toBe(0x7fff);
  });
});

describe("encodePcm16Wav", () => {
  it("writes a canonical 44-byte header", () => {
    const samples = new Int16Array([1, -1, 100]);
    const wav = encodePcm16Wav(samples, 16000);
    const view = new DataView(wav.buffer);
    const text = (offset: number, length: number) =>
      String.fromCharCode(...wav.subarray(offset, offset + length));

    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(text(12, 4)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000); // sample rate
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(text(36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
    expect(wav.byteLength).toBe(44 + samples.length * 2);
  });

  it("round-trips sample values through the data chunk", () => {
    const samples = new Int16Array([0, 1, -1, 32767, -32768]);
    const wav = encodePcm16Wav(samples, 24000);
    const view = new DataView(wav.buffer);
    for (let i = 0; i < samples.length; i++) {
      expect(view.getInt16(44 + i * 2, true)).toBe(samples[i]);
    }
  });
});

describe("encodeFloat32Wav", () => {
  it("encodes float samples end to end", () => {
    const wav = encodeFloat32Wav(new Float32Array([0, 0.5, -0.5]), 16000);
    expect(wav.byteLength).toBe(44 + 3 * 2);
  });
});

describe("bytesToBase64", () => {
  it("matches Buffer's base64 for small input", () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("handles input larger than the chunk size", () => {
    const bytes = new Uint8Array(0x8000 + 10).fill(7);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("handles empty input", () => {
    expect(bytesToBase64(new Uint8Array())).toBe("");
  });
});
