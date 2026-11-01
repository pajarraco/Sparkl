import { Feather } from "@expo/vector-icons";
import {
  AudioQuality,
  IOSOutputFormat,
  type RecordingOptions,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { getStrings } from "../providers/i18n";
import { THEME_COLORS, THEME_RADII, THEME_SPACING } from "../providers/theme";
import { MIC_SAMPLE_RATE, type MicButtonProps } from "./mic-button-config";

export type { MicButtonProps } from "./mic-button-config";

// Native mic button (02 plan, P3). iOS records linear PCM WAV directly, so
// no transcoding step is needed before the audio is sent. Android records
// AAC/3GP, not WAV, and a server-side conversion was deferred (02 Verified
// Facts, "Voice format gap"), so the button is hidden there rather than
// shown disabled — the composer looks the same as it does without voice.
// Web uses MicButton.web.tsx (MediaRecorder + AudioContext).

const WAV_RECORDING_OPTIONS: RecordingOptions = {
  extension: ".wav",
  sampleRate: MIC_SAMPLE_RATE,
  numberOfChannels: 1,
  bitRate: MIC_SAMPLE_RATE * 16,
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    outputFormat: "mpeg4",
    audioEncoder: "aac",
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
};

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

// file:// URI -> bytes, via RN's fetch (which reads local files), so no
// extra dependency (e.g. expo-file-system) is needed just for this.
async function readFileAsBytes(uri: string): Promise<Uint8Array> {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export function MicButton(props: MicButtonProps) {
  const strings = getStrings();
  const recorder = useAudioRecorder(WAV_RECORDING_OPTIONS);
  const state = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);

  // Android WAV recording is deferred (see header comment); hide rather
  // than show a dead button.
  if (Platform.OS === "android") return null;

  async function handlePress(): Promise<void> {
    if (busy || props.disabled) return;
    if (state.isRecording) {
      setBusy(true);
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) throw new Error("no recording uri");
        const durationMs = Math.round((recorder.currentTime ?? 0) * 1000);
        const bytes = await readFileAsBytes(uri);
        props.onRecorded(bytes, MIC_SAMPLE_RATE, durationMs);
      } catch {
        props.onError(strings.assistant.micError);
      } finally {
        setBusy(false);
      }
      return;
    }

    const existing = await getRecordingPermissionsAsync();
    const granted =
      existing.granted || (await requestRecordingPermissionsAsync()).granted;
    if (!granted) {
      props.onError(strings.assistant.micUnsupported);
      return;
    }
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      props.onError(strings.assistant.micError);
    }
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={
          state.isRecording
            ? strings.assistant.micRecording
            : strings.assistant.micLabel
        }
        accessibilityRole="button"
        disabled={props.disabled || busy}
        onPress={() => void handlePress()}
        style={[
          styles.button,
          state.isRecording ? styles.buttonRecording : null,
        ]}
        testID={props.testID ?? "mic-button"}
      >
        <Feather
          color={state.isRecording ? THEME_COLORS.danger : THEME_COLORS.indigo}
          name={state.isRecording ? "mic-off" : "mic"}
          size={20}
        />
      </Pressable>
      {state.isRecording ? (
        <Text accessibilityLiveRegion="polite" style={styles.caption}>
          {strings.assistant.micRecording}
        </Text>
      ) : null}
    </View>
  );
}
