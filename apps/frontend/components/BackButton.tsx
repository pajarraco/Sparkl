import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import { THEME_COLORS } from "../providers/theme";

// design.md Components: icon-only chevron in ink, no fill or border, 44pt
// touch target, labelled "Back" for screen readers. Pressed shifts the
// icon to indigo (an instant colour shift, no animation).

export interface BackButtonProps {
  label: string;
  onPress: () => void;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  target: {
    width: 44,
    height: 44,
    marginLeft: -10,
    alignItems: "center",
    justifyContent: "center",
  },
});

export function BackButton(props: BackButtonProps) {
  return (
    <Pressable
      accessibilityLabel={props.label}
      accessibilityRole="button"
      hitSlop={4}
      onPress={props.onPress}
      style={styles.target}
      testID={props.testID}
    >
      {({ pressed }) => (
        <Feather
          color={pressed ? THEME_COLORS.indigo : THEME_COLORS.ink}
          name="chevron-left"
          size={24}
        />
      )}
    </Pressable>
  );
}
