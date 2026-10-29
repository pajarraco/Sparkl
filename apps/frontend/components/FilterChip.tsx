import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../providers/theme";

// Board filter chip (design.md Components, Filter chips). Inactive: white
// with a stone border. Active: paper-2 with indigo border, icon and label,
// and the label carries the applied value. 44pt touch target.

export type FilterChipIcon = "calendar" | "navigation" | "dollar-sign";

export interface FilterChipProps {
  label: string;
  icon?: FilterChipIcon | undefined;
  active: boolean;
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: THEME_SPACING.rowMax,
    borderRadius: THEME_RADII.control,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    backgroundColor: THEME_COLORS.paper,
  },
  chipActive: {
    borderColor: THEME_COLORS.indigo,
    backgroundColor: THEME_COLORS.paper2,
  },
  label: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.inkSoft,
    fontVariant: ["tabular-nums"],
  },
  labelActive: {
    color: THEME_COLORS.indigo,
  },
});

export function FilterChip(props: FilterChipProps) {
  const color = props.active ? THEME_COLORS.indigo : THEME_COLORS.inkSoft;
  return (
    <Pressable
      accessibilityLabel={props.accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: props.active }}
      onPress={props.onPress}
      style={[styles.chip, props.active ? styles.chipActive : null]}
      testID={props.testID}
    >
      {props.icon === undefined ? null : (
        <Feather accessible={false} color={color} name={props.icon} size={16} />
      )}
      <Text style={[styles.label, props.active ? styles.labelActive : null]}>
        {props.label}
      </Text>
    </Pressable>
  );
}
