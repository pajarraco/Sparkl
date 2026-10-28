import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_SPACING,
} from "../providers/theme";

// Shared screen shell: single column, 16pt edges, title + optional
// subtitle, generous section rhythm (design.md Spacing). Screens own
// their content; this owns the frame.
//
// Static content scrolls by default (small screens clip otherwise —
// the tab navigator bounds every screen to the viewport). Screens that
// own a FlatList pass scroll={false} and give the list flex: 1 instead:
// a virtualized list inside a ScrollView loses windowing and its own
// scroll on native. keyboardShouldPersistTaps keeps form buttons
// tappable while the keyboard is open.

export interface ScreenProps {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  testID?: string | undefined;
  scroll?: boolean | undefined;
  center?: boolean | undefined;
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: THEME_COLORS.paper,
  },
  container: {
    paddingTop: THEME_SPACING.extraEdge,
    paddingBottom: THEME_SPACING.edge,
    paddingHorizontal: THEME_SPACING.edge,
    gap: THEME_SPACING.rowMax,
  },
  centeredContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  centeredText: {
    textAlign: "center",
  },
  title: {
    fontFamily: THEME_FONT_FAMILY.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.64,
    color: THEME_COLORS.ink,
  },
  subtitle: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 16,
    lineHeight: 24,
    color: THEME_COLORS.inkSoft,
  },
});

export function Screen(props: ScreenProps) {
  const centered = props.center === true;
  const body = (
    <>
      <Text
        accessibilityRole="header"
        style={[styles.title, centered ? styles.centeredText : null]}
      >
        {props.title}
      </Text>
      {props.subtitle === undefined ? null : (
        <Text style={[styles.subtitle, centered ? styles.centeredText : null]}>
          {props.subtitle}
        </Text>
      )}
      {props.children}
    </>
  );
  if (props.scroll === false) {
    return (
      <View
        style={[
          styles.frame,
          styles.container,
          centered ? styles.centeredContent : null,
        ]}
        testID={props.testID}
      >
        {body}
      </View>
    );
  }
  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        centered ? styles.centeredContent : null,
      ]}
      keyboardShouldPersistTaps="handled"
      style={styles.frame}
      testID={props.testID}
    >
      {body}
    </ScrollView>
  );
}
