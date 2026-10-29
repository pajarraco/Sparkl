import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../providers/theme";

// Messages tab row (design.md Components, Thread row): initials avatar,
// the other party's name, job address caption, last-message preview and
// time. Stone border, no rail, no shadow; on press the name shifts to
// indigo. Memoized so FlatList rows skip unrelated re-renders.

export interface ThreadRowProps {
  name: string;
  initials: string;
  address: string;
  preview: string;
  time: string;
  onPress: () => void;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME_COLORS.paper,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.cardMax,
    padding: THEME_SPACING.rowMax,
    minHeight: THEME_SPACING.touchTarget,
  },
  row: {
    flexDirection: "row",
    gap: THEME_SPACING.rowMax,
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: THEME_RADII.avatar,
    backgroundColor: THEME_COLORS.paper2,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.inkSoft,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: THEME_SPACING.rowMin,
  },
  name: {
    flexShrink: 1,
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 16,
    lineHeight: 24,
    color: THEME_COLORS.ink,
  },
  namePressed: {
    color: THEME_COLORS.indigo,
  },
  time: {
    flexShrink: 0,
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 12,
    lineHeight: 24,
    color: THEME_COLORS.inkMute,
    fontVariant: ["tabular-nums"],
  },
  caption: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 12,
    lineHeight: 16,
    color: THEME_COLORS.inkSoft,
  },
  preview: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.inkSoft,
  },
});

function ThreadRowInner(props: ThreadRowProps) {
  return (
    <Pressable
      accessibilityLabel={`${props.name}, ${props.address}, ${props.preview}, ${props.time}`}
      accessibilityRole="button"
      onPress={props.onPress}
      style={styles.card}
      testID={props.testID}
    >
      {({ pressed }) => (
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{props.initials}</Text>
          </View>
          <View style={styles.body}>
            <View style={styles.topLine}>
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={[styles.name, pressed ? styles.namePressed : null]}
              >
                {props.name}
              </Text>
              <Text numberOfLines={1} style={styles.time}>
                {props.time}
              </Text>
            </View>
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.caption}>
              {props.address.toUpperCase()}
            </Text>
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.preview}>
              {props.preview}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export const ThreadRow = memo(ThreadRowInner);
