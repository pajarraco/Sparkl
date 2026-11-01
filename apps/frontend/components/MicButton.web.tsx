import { Feather } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getStrings } from "../providers/i18n";
import { THEME_COLORS, THEME_RADII, THEME_SPACING } from "../providers/theme";
import { encodeFloat32Wav } from "../providers/wav-encode";
import { MIC_SAMPLE_RATE, type MicButtonProps } from "./mic-button-config";

export type { MicButtonProps } from "./mic-button-config";

// Web mic button (02 plan, P3). MediaRecorder captures WebM/Opus, which
// Muse Voice Transcribe does not accept, so the captured audio is decoded
// with AudioContext and re-encoded as 16 kHz mono PCM WAV in plain TS (no
// dependency) before it is sent. Hidden when the browser has neither API.
//
// Browser globals (MediaRecorder, AudioContext, Blob, Navigator...) are
// reached through `globalThis` behind the small structural types below,
// rather than the bare identifiers: this file is part of the same TS
// program as the native app, and React Native's ambient types redefine
// `Blob`/`FormData` with an RN-specific shape that isn't source-compatible
// with the browser's. There is no DOM lib here to clash with either.

interface MinimalMediaStreamTrack {
  stop(): void;
}
interface MinimalMediaStream {
  getTracks(): MinimalMediaStreamTrack[];
}
interface MinimalMediaDevices {
  getUserMedia(constraints: { audio: boolean }): Promise<MinimalMediaStream>;
}
interface MinimalDataEvent {
  data: { size: number; arrayBuffer(): Promise<ArrayBuffer> };
}
interface MinimalMediaRecorder {
  start(): void;
  stop(): void;
  ondataavailable: ((event: MinimalDataEvent) => void) | null;
  addEventListener(
    type: "stop",
    listener: () => void,
    options?: { once?: boolean },
  ): void;
}
type MediaRecorderCtor = new (
  stream: MinimalMediaStream,
) => MinimalMediaRecorder;
interface MinimalAudioBuffer {
  duration: number;
  getChannelData(channel: number): Float32Array;
}
interface MinimalAudioContext {
  decodeAudioData(buffer: ArrayBuffer): Promise<MinimalAudioBuffer>;
  close(): Promise<void>;
}
type AudioContextCtor = new () => MinimalAudioContext;
interface MinimalAudioBufferSourceNode {
  buffer: MinimalAudioBuffer | null;
  connect(destination: unknown): void;
  start(when: number): void;
}
interface MinimalOfflineAudioContext {
  destination: unknown;
  createBufferSource(): MinimalAudioBufferSourceNode;
  startRendering(): Promise<MinimalAudioBuffer>;
}
type OfflineAudioContextCtor = new (
  numberOfChannels: number,
  length: number,
  sampleRate: number,
) => MinimalOfflineAudioContext;

interface BrowserGlobals {
  navigator?: { mediaDevices?: MinimalMediaDevices };
  MediaRecorder?: MediaRecorderCtor;
  AudioContext?: AudioContextCtor;
  OfflineAudioContext?: OfflineAudioContextCtor;
}

function browserGlobals(): BrowserGlobals {
  return globalThis as unknown as BrowserGlobals;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME_SPACING.rowMin,
  },
  button: {
    width: THEME_SPACING.touchTarget,
    height: THEME_SPACING.touchTarget,
    borderRadius: THEME_RADII.control,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME_COLORS.paper,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
  },
  buttonRecording: {
    backgroundColor: THEME_COLORS.dangerTint,
    borderColor: THEME_COLORS.danger,
  },
  caption: {
    fontSize: 12,
    color: THEME_COLORS.inkSoft,
  },
});

function isSupported(): boolean {
  const g = browserGlobals();
  return (
    g.navigator?.mediaDevices !== undefined &&
    g.MediaRecorder !== undefined &&
    g.AudioContext !== undefined &&
    g.OfflineAudioContext !== undefined
  );
}

function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const total = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const buffer of buffers) {
    out.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  return out.buffer;
}

// Decodes the recorded audio and resamples to mono at MIC_SAMPLE_RATE via
// OfflineAudioContext, so the WAV we send always matches the sample rate
// the request declares.
async function recordedToWav(
  chunks: ArrayBuffer[],
): Promise<{ bytes: Uint8Array; durationMs: number }> {
  const g = browserGlobals();
  if (!g.AudioContext || !g.OfflineAudioContext) {
    throw new Error("audio decoding is unavailable");
  }
  const arrayBuffer = concatArrayBuffers(chunks);
  const decodeContext = new g.AudioContext();
  let decoded: MinimalAudioBuffer;
  try {
    decoded = await decodeContext.decodeAudioData(arrayBuffer);
  } finally {
    await decodeContext.close();
  }

  const frameCount = Math.max(1, Math.ceil(decoded.duration * MIC_SAMPLE_RATE));
  const offline = new g.OfflineAudioContext(1, frameCount, MIC_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);
  const bytes = encodeFloat32Wav(samples, MIC_SAMPLE_RATE);
  return { bytes, durationMs: Math.round(decoded.duration * 1000) };
}

export function MicButton(props: MicButtonProps) {
  const strings = getStrings();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef<MinimalMediaRecorder | null>(null);
  const chunksRef = useRef<ArrayBuffer[]>([]);
  // Tracks each ondataavailable's async arrayBuffer() conversion, so
  // stopRecording can await the final chunk instead of racing it: the
  // browser fires a last "dataavailable" then "stop", but the handler below
  // doesn't block on the conversion, so the stop listener could otherwise
  // resolve before that last chunk lands in chunksRef.
  const pendingChunksRef = useRef<Promise<void>[]>([]);
  const streamRef = useRef<MinimalMediaStream | null>(null);

  if (!isSupported()) return null;

  function stopStream(): void {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
  }

  async function startRecording(): Promise<void> {
    const g = browserGlobals();
    try {
      const stream = await g.navigator?.mediaDevices?.getUserMedia({
        audio: true,
      });
      if (!stream || !g.MediaRecorder) throw new Error("no mic access");
      streamRef.current = stream;
      chunksRef.current = [];
      pendingChunksRef.current = [];
      const recorder = new g.MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          pendingChunksRef.current.push(
            event.data.arrayBuffer().then((buffer) => {
              chunksRef.current.push(buffer);
            }),
          );
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      props.onError(strings.assistant.micUnsupported);
    }
  }

  async function stopRecording(): Promise<void> {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setBusy(true);
    setRecording(false);
    try {
      await new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
        recorder.stop();
      });
      await Promise.all(pendingChunksRef.current);
      stopStream();
      const { bytes, durationMs } = await recordedToWav(chunksRef.current);
      props.onRecorded(bytes, MIC_SAMPLE_RATE, durationMs);
    } catch {
      stopStream();
      props.onError(strings.assistant.micError);
    } finally {
      setBusy(false);
    }
  }

  function handlePress(): void {
    if (busy || props.disabled) return;
    if (recording) {
      void stopRecording();
    } else {
      void startRecording();
    }
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={
          recording
            ? strings.assistant.micRecording
            : strings.assistant.micLabel
        }
        accessibilityRole="button"
        disabled={props.disabled || busy}
        onPress={handlePress}
        style={[styles.button, recording ? styles.buttonRecording : null]}
        testID={props.testID ?? "mic-button"}
      >
        <Feather
          color={recording ? THEME_COLORS.danger : THEME_COLORS.indigo}
          name={recording ? "mic-off" : "mic"}
          size={20}
        />
      </Pressable>
      {recording ? (
        <Text accessibilityLiveRegion="polite" style={styles.caption}>
          {strings.assistant.micRecording}
        </Text>
      ) : null}
    </View>
  );
}
