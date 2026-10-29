import type { Job } from "@sparkl/shared";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { BodyText } from "../../components/BodyText";
import { JobCard } from "../../components/JobCard";
import { Screen } from "../../components/Screen";
import { SparklButton } from "../../components/SparklButton";
import { sparklTrpc } from "../../providers/app-providers";
import { getStrings } from "../../providers/i18n";
import {
  type MyJobsSegment,
  filterJobsBySegment,
  hostMetaLine,
  statusLabelFor,
} from "../../providers/my-jobs";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../../providers/theme";

// Host My Jobs (design.md Screen Inventory): open / active / history
// segments over one jobs.myJobs query, rows are memoized JobCards with
// stable keyExtractor. Loading shows card-shaped skeletons, never a
// full-screen spinner; errors stay inline with a retry.

const SEGMENTS: MyJobsSegment[] = ["open", "active", "history"];

const styles = StyleSheet.create({
  segments: {
    flexDirection: "row",
    gap: THEME_SPACING.rowMax,
    marginBottom: THEME_SPACING.rowMax,
  },
  segment: {
    minHeight: THEME_SPACING.touchTarget,
    justifyContent: "center",
    paddingHorizontal: THEME_SPACING.rowMin,
  },
  segmentText: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.inkMute,
  },
  segmentTextActive: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    color: THEME_COLORS.indigo,
  },
  list: {
    gap: THEME_SPACING.rowMax,
  },
  flatList: {
    flex: 1,
  },
  skeleton: {
    height: 132,
    backgroundColor: THEME_COLORS.paper2,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.cardMax,
  },
  error: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.danger,
  },
});

export default function HostMyJobsScreen() {
  const strings = getStrings();
  const router = useRouter();
  const [segment, setSegment] = useState<MyJobsSegment>("open");
  const query = sparklTrpc.jobs.myJobs.useQuery({});

  const segmentLabel = useCallback(
    (value: MyJobsSegment): string => {
      if (value === "active") return strings.myJobs.segmentActive;
      if (value === "history") return strings.myJobs.segmentHistory;
      return strings.myJobs.segmentOpen;
    },
    [strings],
  );

  const renderItem = useCallback(
    ({ item }: { item: Job }) => (
      <JobCard
        address={item.address}
        metaLine={hostMetaLine(item)}
        onPress={() => {
          router.navigate(`/(host)/job/${item.id}`);
        }}
        status={item.status}
        statusLabel={statusLabelFor(item.status)}
        testID={`host-job-card-${item.id}`}
        title={strings.jobCard.title}
      />
    ),
    [strings, router],
  );

  const jobs =
    query.data === undefined
      ? undefined
      : filterJobsBySegment(query.data, segment);

  return (
    <Screen
      scroll={false}
      testID="host-my-jobs-screen"
      title={strings.myJobs.title}
    >
      <View style={styles.segments}>
        {SEGMENTS.map((value) => (
          <Pressable
            key={value}
            accessibilityLabel={segmentLabel(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: segment === value }}
            onPress={() => setSegment(value)}
            style={styles.segment}
            testID={`host-my-jobs-segment-${value}`}
          >
            <Text
              style={[
                styles.segmentText,
                segment === value ? styles.segmentTextActive : null,
              ]}
            >
              {segmentLabel(value)}
            </Text>
          </Pressable>
        ))}
      </View>
      {query.isPending ? (
        <View style={styles.list} testID="host-my-jobs-loading">
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
        </View>
      ) : query.isError || jobs === undefined ? (
        <View style={styles.list}>
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {strings.errors.generic}
          </Text>
          <SparklButton
            accessibilityLabel={strings.errors.retry}
            onPress={() => {
              void query.refetch();
            }}
            testID="host-my-jobs-retry"
            title={strings.errors.retry}
            variant="secondary"
          />
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.list}>
          <BodyText>{strings.emptyStates.noMyJobs}</BodyText>
          <BodyText soft>{strings.emptyStates.postFirst}</BodyText>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.flatList}
          testID="host-my-jobs-list"
        />
      )}
    </Screen>
  );
}
