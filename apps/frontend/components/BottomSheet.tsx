import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
// border flip to the bottom edge) and slides it down from the top edge
// on open (~180ms, skipped under prefers-reduced-motion). Modal's own
// animation is off for "top": react-native-web's Escape-to-close only
// works once its animationend fires, and "fade"/"none" didn't reliably
// fire it in this RN Web version (confirmed by e2e flakes), so this
// component listens for Escape itself on web and keeps onRequestClose
// for Android back.

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

interface WebKeydownTarget {
  addEventListener(
    type: "keydown",
    listener: (event: { key: string }) => void,
  ): void;
  removeEventListener(
    type: "keydown",
    listener: (event: { key: string }) => void,
  ): void;
}

// Entrance offset for the top sheet: enough to start fully above the
// panel (title + one field + actions), so it visibly slides down in.
const TOP_SHEET_HIDDEN_OFFSET = -360;
const TOP_SHEET_ENTER_MS = 180;

function prefersReducedMotion(): boolean {
  if (Platform.OS !== "web") return false;
  const matchMedia = (
    globalThis as unknown as {
      matchMedia?: (query: string) => { matches: boolean };
    }
  ).matchMedia;
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BottomSheet(props: BottomSheetProps) {
  const position = props.position ?? "bottom";
  const isTop = position === "top";
  const translateY = useRef(new Animated.Value(0)).current;

  // Slide-down entrance for the top sheet. The content mounts when the
  // Modal opens, so resetting + animating on `visible` covers every open.
  useEffect(() => {
    if (!props.visible || !isTop || prefersReducedMotion()) return;
    translateY.setValue(TOP_SHEET_HIDDEN_OFFSET);
    const animation = Animated.timing(translateY, {
      toValue: 0,
      duration: TOP_SHEET_ENTER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [props.visible, isTop, translateY]);

  // Modal's own animation is off for "top", so its built-in web
  // Escape-to-close never fires: listen for Escape directly on web.
  // Android back still arrives via onRequestClose.
  useEffect(() => {
    if (!props.visible || !isTop || Platform.OS !== "web") return;
    const documentRef = (
      globalThis as unknown as { document?: WebKeydownTarget }
    ).document;
    if (documentRef === undefined) return;
    const onKeyDown = (event: { key: string }) => {
      if (event.key === "Escape") props.onClose();
    };
    documentRef.addEventListener("keydown", onKeyDown);
    return () => {
      documentRef.removeEventListener("keydown", onKeyDown);
    };
  }, [props.visible, isTop, props.onClose]);

  return (
    <Modal
      animationType={isTop ? "none" : "slide"}
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
        <Animated.View
          style={[
            styles.sheet,
            position === "bottom" ? styles.sheetBottom : styles.sheetTop,
            { transform: [{ translateY }] },
          ]}
          testID={props.testID}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {props.title}
          </Text>
          {props.children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
