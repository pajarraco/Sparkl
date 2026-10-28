import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { KeyboardTypeOptions } from "react-native";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../providers/theme";

// Labelled text input (design.md Components): eyebrow label above, white
// fill, stone border, 6pt radius. Focus shows a 2pt indigo border (React
// Native has no outline); the ring is never stripped.

export interface SparklTextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string | undefined;
  secureTextEntry?: boolean | undefined;
  keyboardType?: KeyboardTypeOptions | undefined;
  autoCapitalize?: "none" | "sentences" | "words" | "characters" | undefined;
  error?: string | undefined;
  accessibilityLabel?: string | undefined;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 12,
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: THEME_COLORS.ink,
    marginBottom: THEME_SPACING.rowMin,
  },
  input: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 16,
    lineHeight: 24,
    color: THEME_COLORS.ink,
    backgroundColor: THEME_COLORS.paper,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.control,
    minHeight: THEME_SPACING.touchTarget,
    paddingHorizontal: 12,
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: THEME_COLORS.indigo,
  },
  error: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 12,
    lineHeight: 16,
    color: THEME_COLORS.danger,
    marginTop: THEME_SPACING.rowMin,
  },
});

export function SparklTextField(props: SparklTextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text
        nativeID={`${props.testID ?? props.label}-label`}
        style={styles.label}
      >
        {props.label}
      </Text>
      <TextInput
        accessibilityLabel={props.accessibilityLabel ?? props.label}
        accessibilityLabelledBy={`${props.testID ?? props.label}-label`}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        keyboardType={props.keyboardType}
        onBlur={() => setFocused(false)}
        onChangeText={props.onChangeText}
        onFocus={() => setFocused(true)}
        placeholder={props.placeholder}
        placeholderTextColor={THEME_COLORS.inkMute}
        secureTextEntry={props.secureTextEntry}
        style={[styles.input, focused ? styles.inputFocused : null]}
        testID={props.testID}
        value={props.value}
      />
      {props.error === undefined || props.error === "" ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {props.error}
        </Text>
      )}
    </View>
  );
}
