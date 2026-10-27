import type { JobStatus } from "@sparkl/shared";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { pillKeyForStatus } from "../providers/my-jobs";
import {
  STATUS_PILL,
  THEME_COLORS,
  THEME_FONT,
  THEME_RADII,
  THEME_SPACING,
} from "../providers/theme";

// Signature job card (design.md): orange rail, uppercase address caption,
// H3 title, tabular meta row, optional trust row, status pill. Stone
// border, no shadow. On press the meta line shifts indigo instead of any
// lift. Memoized so FlatList rows skip re-renders on unrelated updates.

export interface JobCardProps {
  title: string;
  address: string;
  metaLine: string;
  trustLine?: string | undefined;
  status: JobStatus;
  statusLabel: string;
  onPress?: (() => void) | undefined;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME_COLORS.paper,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.cardMax,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
  },
  rail: {
    width: 4,
    backgroundColor: THEME_COLORS.orange,
  },
  body: {
    flex: 1,
    padding: THEME_SPACING.rowMax,
    gap: THEME_SPACING.rowMin,
  },
  caption: {
    fontFamily: THEME_FONT.family,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    color: THEME_COLORS.inkSoft,
  },
  title: {
    fontFamily: THEME_FONT.family,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
    color: THEME_COLORS.ink,
  },
  meta: {
    fontFamily: THEME_FONT.family,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: THEME_COLORS.inkSoft,
    fontVariant: ["tabular-nums"],
  },
  metaPressed: {
    color: THEME_COLORS.indigo,
  },
  trust: {
    fontFamily: THEME_FONT.family,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: THEME_COLORS.inkSoft,
  },
  trustStars: {
    color: THEME_COLORS.orangeDeep,
    fontWeight: "500",
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: THEME_RADII.control,
    paddingHorizontal: THEME_SPACING.rowMin,
    paddingVertical: 2,
  },
  pillText: {
    fontFamily: THEME_FONT.family,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
});

function JobCardInner(props: JobCardProps) {
  const pill = STATUS_PILL[pillKeyForStatus(props.status)];
  return (
    <Pressable
      accessibilityLabel={
        props.onPress === undefined
          ? undefined
          : `${props.title}, ${props.statusLabel}`
      }
      accessibilityRole={props.onPress === undefined ? undefined : "button"}
      onPress={props.onPress}
      style={styles.card}
      testID={props.testID}
    >
      {({ pressed }) => (
        <View style={styles.row}>
          <View style={styles.rail} />
          <View style={styles.body}>
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.caption}>
              {props.address.toUpperCase()}
            </Text>
            <Text style={styles.title}>{props.title}</Text>
            <Text style={[styles.meta, pressed ? styles.metaPressed : null]}>
              {props.metaLine}
            </Text>
            {props.trustLine === undefined ? null : (
              <Text style={styles.trust}>
                <Text style={styles.trustStars}>{"★ "}</Text>
                {props.trustLine}
              </Text>
            )}
            <View style={[styles.pill, { backgroundColor: pill.background }]}>
              <Text style={[styles.pillText, { color: pill.text }]}>
                {props.statusLabel}
              </Text>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export const JobCard = memo(JobCardInner);
