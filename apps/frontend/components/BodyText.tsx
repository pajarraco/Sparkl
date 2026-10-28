import type { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import { THEME_COLORS, THEME_FONT_FAMILY } from "../providers/theme";

// Secondary copy (design.md Small/Body): empty states and hints under a
// screen title. Keeps the eight tab stubs from duplicating one style.

export interface BodyTextProps {
  children: ReactNode;
  soft?: boolean | undefined;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 16,
    lineHeight: 24,
    color: THEME_COLORS.ink,
  },
  soft: {
    color: THEME_COLORS.inkSoft,
  },
});

export function BodyText(props: BodyTextProps) {
  return (
    <Text
      style={[styles.base, props.soft === true ? styles.soft : null]}
      testID={props.testID}
    >
      {props.children}
    </Text>
  );
}
