import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../providers/theme";

// Bottom sheet (design.md Components): paper panel anchored to the bottom
// over an ink scrim at 40%, radius 14 on the top corners, stone top
// border, no shadow. Built on React Native Modal (no new dependency).
// Tapping the scrim, Android back or Escape on web closes without
// applying anything.

export interface BottomSheetProps {
  visible: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: THEME_COLORS.ink,
    opacity: 0.4,
  },
  sheet: {
    backgroundColor: THEME_COLORS.paper,
    borderTopLeftRadius: THEME_RADII.sheet,
    borderTopRightRadius: THEME_RADII.sheet,
    borderTopWidth: 1,
    borderColor: THEME_COLORS.stone,
    padding: THEME_SPACING.edge,
    paddingBottom: THEME_SPACING.section,
    gap: THEME_SPACING.rowMax,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  title: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 20,
    lineHeight: 26,
    color: THEME_COLORS.ink,
  },
});

export function BottomSheet(props: BottomSheetProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={props.onClose}
      transparent
      visible={props.visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.root}
      >
        <Pressable
          accessibilityLabel={props.closeLabel}
          accessibilityRole="button"
          onPress={props.onClose}
          style={styles.scrim}
          testID={
            props.testID === undefined ? undefined : `${props.testID}-scrim`
          }
        />
        <View style={styles.sheet} testID={props.testID}>
          <Text accessibilityRole="header" style={styles.title}>
            {props.title}
          </Text>
          {props.children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
