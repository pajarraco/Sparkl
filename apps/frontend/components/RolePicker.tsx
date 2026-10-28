import { Pressable, StyleSheet, Text, View } from "react-native";
import { type AppRole, parseAppRole } from "../providers/auth";
import { getStrings } from "../providers/i18n";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../providers/theme";

// Host / cleaner role pick (sign-up screen). Two radio options with
// visible labels; screen readers get the group label plus selected state.

export interface RolePickerProps {
  value: AppRole | null;
  onSelect: (role: AppRole) => void;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  groupLabel: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 12,
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: THEME_COLORS.ink,
    marginBottom: THEME_SPACING.rowMin,
  },
  row: {
    flexDirection: "row",
    gap: THEME_SPACING.rowMax,
  },
  option: {
    flex: 1,
    minHeight: THEME_SPACING.touchTarget,
    borderRadius: THEME_RADII.control,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    backgroundColor: THEME_COLORS.paper,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: THEME_COLORS.indigo,
    backgroundColor: THEME_COLORS.paper2,
  },
  optionLabel: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 16,
    color: THEME_COLORS.ink,
  },
  hint: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.inkSoft,
    marginTop: THEME_SPACING.rowMin,
  },
});

const OPTIONS: AppRole[] = ["host", "cleaner"];

export function RolePicker(props: RolePickerProps) {
  const strings = getStrings().auth;
  return (
    <View>
      <Text nativeID="role-picker-label" style={styles.groupLabel}>
        {strings.roleLabel}
      </Text>
      <View
        accessibilityLabel={strings.roleLabel}
        accessibilityRole="radiogroup"
        style={styles.row}
      >
        {OPTIONS.map((role) => {
          const selected = props.value === role;
          const label =
            role === "host" ? strings.roleHost : strings.roleCleaner;
          return (
            <Pressable
              key={role}
              accessibilityLabel={label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                const parsed = parseAppRole(role);
                if (parsed !== null) props.onSelect(parsed);
              }}
              style={[styles.option, selected ? styles.optionSelected : null]}
              testID={
                props.testID === undefined
                  ? undefined
                  : `${props.testID}-${role}`
              }
            >
              <Text style={styles.optionLabel}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{strings.roleHint}</Text>
    </View>
  );
}
