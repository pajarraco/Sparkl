import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_SPACING,
} from "../providers/theme";
import { BackButton } from "./BackButton";

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
//
// Desktop/web (05 item 8): content caps at THEME_SPACING.screenMax and
// centers above it. maxWidth only ever constrains, so this is unconditional
// rather than Platform-gated — a native or narrow-web screen is always
// well under the cap and never notices it.

export interface ScreenProps {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  testID?: string | undefined;
  scroll?: boolean | undefined;
  center?: boolean | undefined;
  /** Detail screens only (see DetailScreen): renders Back above the title. */
  onBack?: (() => void) | undefined;
  backLabel?: string | undefined;
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
  containerCenter: {
    width: "100%",
    maxWidth: THEME_SPACING.screenMax,
    alignSelf: "center",
  },
  containerFlex: {
    flex: 1,
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
      {props.onBack === undefined ? null : (
        <BackButton
          label={props.backLabel ?? ""}
          onPress={props.onBack}
          testID={
            props.testID === undefined ? undefined : `${props.testID}-back`
          }
        />
      )}
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
      <View style={styles.frame} testID={props.testID}>
        <View
          style={[
            styles.container,
            styles.containerCenter,
            styles.containerFlex,
            centered ? styles.centeredContent : null,
          ]}
        >
          {body}
        </View>
      </View>
    );
  }
  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        styles.containerCenter,
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
