import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../providers/theme";

// Buttons (design.md Components): primary indigo fill with white uppercase
// label; secondary white fill with 2px indigo border; destructive danger
// text with no fill. 44pt minimum touch target; pressed state is an
// instant colour shift, never animation.

export type SparklButtonVariant = "primary" | "secondary" | "destructive";

export interface SparklButtonProps {
  title: string;
  onPress: () => void;
  variant?: SparklButtonVariant | undefined;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  accessibilityLabel?: string | undefined;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  base: {
    minHeight: THEME_SPACING.touchTarget,
    borderRadius: THEME_RADII.control,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: THEME_COLORS.indigo,
  },
  primaryPressed: {
    backgroundColor: THEME_COLORS.indigoDeep,
  },
  secondary: {
    backgroundColor: THEME_COLORS.paper,
    borderWidth: 2,
    borderColor: THEME_COLORS.indigo,
  },
  destructive: {
    backgroundColor: THEME_COLORS.paper,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 16,
    letterSpacing: 0.48,
    textTransform: "uppercase",
  },
  primaryLabel: {
    color: THEME_COLORS.paper,
  },
  secondaryLabel: {
    color: THEME_COLORS.indigo,
  },
  destructiveLabel: {
    color: THEME_COLORS.danger,
  },
});

export function SparklButton(props: SparklButtonProps) {
  const variant = props.variant ?? "primary";
  const disabled = props.disabled === true || props.loading === true;
  const labelStyle =
    variant === "primary"
      ? [styles.label, styles.primaryLabel]
      : variant === "secondary"
        ? [styles.label, styles.secondaryLabel]
        : [styles.label, styles.destructiveLabel];
  return (
    <Pressable
      accessibilityLabel={props.accessibilityLabel ?? props.title}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "primary"
          ? pressed
            ? styles.primaryPressed
            : styles.primary
          : variant === "secondary"
            ? styles.secondary
            : styles.destructive,
        disabled ? styles.disabled : null,
      ]}
      testID={props.testID}
    >
      {props.loading === true ? (
        <ActivityIndicator
          color={
            variant === "primary" ? THEME_COLORS.paper : THEME_COLORS.indigo
          }
        />
      ) : (
        <Text style={labelStyle}>{props.title}</Text>
      )}
    </Pressable>
  );
}
