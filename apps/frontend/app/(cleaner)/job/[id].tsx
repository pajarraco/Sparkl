import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../../components/Screen";
import { SparklButton } from "../../../components/SparklButton";
import { sparklTrpc } from "../../../providers/app-providers";
import {
  claimSubmitErrorMessage,
  cleanerClaimAvailableForStatus,
} from "../../../providers/cleaner-job-detail";
import { getStrings } from "../../../providers/i18n";
import {
  formatJobWindow,
  formatPriceMinorUnits,
  statusLabelFor,
} from "../../../providers/my-jobs";
import { formatMatchPercent } from "../../../providers/ranked-board";
import {
  STATUS_PILL,
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../../../providers/theme";

// Cleaner Job Detail (design.md Screen Inventory): full info plus the
// claim CTA while the job is open. The job itself comes from the
// cleaner's own jobs.listRanked list — no extra backend route — so the
// match percent rides along. Chat entry arrives with the cleaner chat
// slice; after claiming, the success message points there.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const styles = StyleSheet.create({
  section: {
    gap: THEME_SPACING.rowMin,
    marginBottom: THEME_SPACING.section,
  },
  heading: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: THEME_COLORS.ink,
  },
  body: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 16,
    lineHeight: 24,
    color: THEME_COLORS.ink,
  },
  hint: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.inkSoft,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: THEME_RADII.control,
    paddingHorizontal: THEME_SPACING.rowMin,
    paddingVertical: 2,
  },
  pillText: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  skeleton: {
    height: 96,
    backgroundColor: THEME_COLORS.paper2,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.cardMax,
  },
  actions: {
    gap: THEME_SPACING.rowMax,
    marginTop: THEME_SPACING.section,
  },
  success: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 16,
    lineHeight: 24,
    color: THEME_COLORS.indigo,
  },
  formError: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.danger,
  },
});

export default function CleanerJobDetailScreen() {
  const strings = getStrings();
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const jobId = rawId !== undefined && UUID_RE.test(rawId) ? rawId : null;

  const boardQuery = sparklTrpc.jobs.listRanked.useQuery({
    limit: 20,
    offset: 0,
  });
  // My Jobs rows land here too, but claimed jobs are gone from the ranked
  // board — fall back to the caller's own myClaimed list.
  const claimedQuery = sparklTrpc.jobs.myClaimed.useQuery({});
  const ranked =
    jobId === null || boardQuery.data === undefined
      ? undefined
      : boardQuery.data.jobs.find((candidate) => candidate.job.id === jobId);
  const claimedJob =
    jobId === null || claimedQuery.data === undefined
      ? undefined
      : claimedQuery.data.find((candidate) => candidate.id === jobId);
  const job = ranked?.job ?? claimedJob;

  const claimJob = sparklTrpc.jobs.claim.useMutation();
  const [claimed, setClaimed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const busy = claimJob.isPending;

  async function handleClaim(): Promise<void> {
    if (jobId === null) return;
    setFormError(null);
    try {
      await claimJob.mutateAsync({ jobId });
      setClaimed(true);
      await boardQuery.refetch();
      await claimedQuery.refetch();
    } catch (err) {
      setFormError(claimSubmitErrorMessage(err));
    }
  }

  if (job === undefined) {
    if (boardQuery.isPending || claimedQuery.isPending) {
      return (
        <Screen
          testID="cleaner-job-detail-screen"
          title={strings.jobDetail.title}
        >
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
        </Screen>
      );
    }
    return (
      <Screen
        testID="cleaner-job-detail-screen"
        title={strings.jobDetail.title}
      >
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {strings.errors.generic}
        </Text>
        <SparklButton
          accessibilityLabel={strings.errors.retry}
          onPress={() => {
            void boardQuery.refetch();
            void claimedQuery.refetch();
          }}
          testID="cleaner-job-detail-retry"
          title={strings.errors.retry}
          variant="secondary"
        />
      </Screen>
    );
  }

  const pill =
    STATUS_PILL[job.status === "in_progress" ? "inProgress" : job.status];

  return (
    <Screen
      subtitle={job.address}
      testID="cleaner-job-detail-screen"
      title={strings.jobDetail.title}
    >
      <View style={styles.section}>
        <Text style={styles.heading}>{strings.jobDetail.statusHeading}</Text>
        <View style={[styles.pill, { backgroundColor: pill.background }]}>
          <Text style={[styles.pillText, { color: pill.text }]}>
            {statusLabelFor(job.status)}
          </Text>
        </View>
        {ranked === undefined ? null : (
          <Text style={styles.hint}>{formatMatchPercent(ranked.score)}</Text>
        )}
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>{strings.jobDetail.dateHeading}</Text>
        <Text style={styles.body}>
          {formatJobWindow(job.windowStart, job.windowEnd)}
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>{strings.jobDetail.priceHeading}</Text>
        <Text style={styles.body}>
          {formatPriceMinorUnits(job.priceMinorUnits)}
        </Text>
      </View>
      {job.notes === null ? null : (
        <View style={styles.section}>
          <Text style={styles.heading}>{strings.jobDetail.notesHeading}</Text>
          <Text style={styles.body}>{job.notes}</Text>
        </View>
      )}
      <View style={styles.actions}>
        {cleanerClaimAvailableForStatus(job.status) && !claimed ? (
          <SparklButton
            accessibilityLabel={strings.jobDetail.claim}
            loading={claimJob.isPending}
            onPress={() => {
              void handleClaim();
            }}
            testID="cleaner-job-claim"
            title={strings.jobDetail.claim}
          />
        ) : null}
        {claimed ? (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.success}
            testID="cleaner-job-claimed"
          >
            {strings.jobDetail.claimedSuccess}
          </Text>
        ) : null}
        {formError === null || busy ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.formError}>
            {formError}
          </Text>
        )}
      </View>
    </Screen>
  );
}
