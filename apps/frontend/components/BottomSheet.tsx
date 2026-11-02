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
//
// position="top" anchors the same panel to the top instead (radius and
// border flip to the bottom edge). Still uses Modal's "slide" animation
// for both: react-native-web's Escape-to-close only works once its
// animationend fires, and "fade"/"none" didn't reliably fire it in this
// RN Web version (confirmed by e2e flakes), so the overlay still slides
// up from the screen's bottom edge even though the content it reveals
// sits pinned to the top.

export type BottomSheetPosition = "bottom" | "top";

export interface BottomSheetProps {
  visible: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  position?: BottomSheetPosition | undefined;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  rootBottom: {
    flex: 1,
    justifyContent: "flex-end",
  },
  rootTop: {
    flex: 1,
    justifyContent: "flex-start",
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
  sheetBottom: {
    borderTopLeftRadius: THEME_RADII.sheet,
    borderTopRightRadius: THEME_RADII.sheet,
    borderTopWidth: 1,
    paddingBottom: THEME_SPACING.section,
  },
  sheetTop: {
    borderBottomLeftRadius: THEME_RADII.sheet,
    borderBottomRightRadius: THEME_RADII.sheet,
    borderBottomWidth: 1,
    paddingTop: THEME_SPACING.section,
  },
  sheet: {
    backgroundColor: THEME_COLORS.paper,
    borderColor: THEME_COLORS.stone,
    padding: THEME_SPACING.edge,
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
  const position = props.position ?? "bottom";
  return (
    <Modal
      animationType="slide"
      onRequestClose={props.onClose}
      transparent
      visible={props.visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={position === "bottom" ? styles.rootBottom : styles.rootTop}
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
        <View
          style={[
            styles.sheet,
            position === "bottom" ? styles.sheetBottom : styles.sheetTop,
          ]}
          testID={props.testID}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {props.title}
          </Text>
          {props.children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
