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
  type CleanerMyJobsSegment,
  cleanerMetaLine,
  filterCleanerJobsBySegment,
  spotlightCleanerJob,
  statusLabelFor,
} from "../../providers/my-jobs";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../../providers/theme";

// Cleaner My Jobs (design.md Screen Inventory): claimed / active / history
// segments over one jobs.myClaimed query, rows are memoized JobCards with
// stable keyExtractor pushing to the cleaner Job Detail route (which falls
// back to myClaimed for non-open jobs). Loading shows card-shaped
// skeletons, never a full-screen spinner; errors stay inline with a retry.
//
// Prototype variant B (prototype/board.html §vB) survives as the spotlight:
// the earliest-window job in claimed/active renders first under a "Next up"
// eyebrow, the rest as uniform rows. Match explanations and photos arrive
// with the board prototype fold-in — myClaimed carries no scores.
const SEGMENTS: CleanerMyJobsSegment[] = ["claimed", "active", "history"];

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
  spotlightEyebrow: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: THEME_COLORS.ink,
    marginBottom: THEME_SPACING.rowMin,
  },
  spotlight: {
    marginBottom: THEME_SPACING.rowMax,
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

export default function CleanerMyJobsScreen() {
  const strings = getStrings();
  const router = useRouter();
  const [segment, setSegment] = useState<CleanerMyJobsSegment>("claimed");
  const query = sparklTrpc.jobs.myClaimed.useQuery({});

  const segmentLabel = useCallback(
    (value: CleanerMyJobsSegment): string => {
      if (value === "active") return strings.myJobs.segmentActive;
      if (value === "history") return strings.myJobs.segmentHistory;
      return strings.myJobs.segmentClaimed;
    },
    [strings],
  );

  const openJob = useCallback(
    (jobId: string) => {
      router.push(`/(cleaner)/job/${jobId}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Job }) => (
      <JobCard
        address={item.address}
        metaLine={cleanerMetaLine(item)}
        onPress={() => {
          openJob(item.id);
        }}
        status={item.status}
        statusLabel={statusLabelFor(item.status)}
        testID={`cleaner-job-card-${item.id}`}
        title={strings.jobCard.title}
      />
    ),
    [strings, openJob],
  );

  const jobs =
    query.data === undefined
      ? undefined
      : filterCleanerJobsBySegment(query.data, segment);
  const spotlight =
    query.data === undefined ? null : spotlightCleanerJob(query.data, segment);
  const rest =
    jobs === undefined || spotlight === null
      ? jobs
      : jobs.filter((job) => job.id !== spotlight.id);

  return (
    <Screen
      scroll={false}
      testID="cleaner-my-jobs-screen"
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
            testID={`cleaner-my-jobs-segment-${value}`}
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
        <View style={styles.list} testID="cleaner-my-jobs-loading">
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
        </View>
      ) : query.isError || jobs === undefined || rest === undefined ? (
        <View style={styles.list}>
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {strings.errors.generic}
          </Text>
          <SparklButton
            accessibilityLabel={strings.errors.retry}
            onPress={() => {
              void query.refetch();
            }}
            testID="cleaner-my-jobs-retry"
            title={strings.errors.retry}
            variant="secondary"
          />
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.list}>
          <BodyText>
            {segment === "history"
              ? strings.emptyStates.noHistory
              : strings.emptyStates.noMyJobs}
          </BodyText>
        </View>
      ) : (
        <FlatList
          ListHeaderComponent={
            spotlight === null ? null : (
              <View style={styles.spotlight}>
                <Text style={styles.spotlightEyebrow}>
                  {strings.myJobs.spotlightNextUp}
                </Text>
                <JobCard
                  address={spotlight.address}
                  metaLine={cleanerMetaLine(spotlight)}
                  onPress={() => {
                    openJob(spotlight.id);
                  }}
                  status={spotlight.status}
                  statusLabel={statusLabelFor(spotlight.status)}
                  testID={`cleaner-job-card-${spotlight.id}`}
                  title={strings.jobCard.title}
                />
              </View>
            )
          }
          contentContainerStyle={styles.list}
          data={rest}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.flatList}
          testID="cleaner-my-jobs-list"
        />
      )}
    </Screen>
  );
}
