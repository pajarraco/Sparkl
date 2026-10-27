import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { THEME_COLORS, THEME_FONT, THEME_SPACING } from "../providers/theme.js";

// Shared screen shell: single column, 16pt edges, title + optional
// subtitle, generous section rhythm (design.md Spacing). Screens own
// their content; this owns the frame.

export interface ScreenProps {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.paper,
    padding: THEME_SPACING.edge,
    gap: THEME_SPACING.rowMax,
  },
  title: {
    fontFamily: THEME_FONT.family,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.64,
    color: THEME_COLORS.ink,
  },
  subtitle: {
    fontFamily: THEME_FONT.family,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    color: THEME_COLORS.inkSoft,
  },
});

export function Screen(props: ScreenProps) {
  return (
    <View style={styles.container} testID={props.testID}>
      <Text accessibilityRole="header" style={styles.title}>
        {props.title}
      </Text>
      {props.subtitle === undefined ? null : (
        <Text style={styles.subtitle}>{props.subtitle}</Text>
      )}
      {props.children}
    </View>
  );
}
