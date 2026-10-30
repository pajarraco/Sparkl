import { useLocalSearchParams, useRouter, useSegments } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DetailScreen } from "../../../../../components/DetailScreen";
import { SparklButton } from "../../../../../components/SparklButton";
import { sparklTrpc } from "../../../../../providers/app-providers";
import {
  cleanerChatAvailableForStatus,
  cleanerClaimAvailableForStatus,
  cleanerReviewAvailableForStatus,
  cleanerStartAvailableForStatus,
  myPendingRequestForJob,
  requestSubmitErrorMessage,
} from "../../../../../providers/cleaner-job-detail";
import { getStrings } from "../../../../../providers/i18n";
import {
  formatJobWindow,
  formatPriceMinorUnits,
  statusLabelFor,
} from "../../../../../providers/my-jobs";
import { formatMatchPercent } from "../../../../../providers/ranked-board";
import { stackHref } from "../../../../../providers/tabs";
import {
  STATUS_PILL,
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../../../../../providers/theme";

// Cleaner Job Detail (design.md Screen Inventory): full info plus the
// two-way assignment CTA while the job is open — Request job, or Accept
// / Decline when the host already offered it (03 D). The job itself
// comes from the cleaner's own jobs.listRanked list — no extra backend
// route — so the match percent rides along. Chat entry arrives with the
// cleaner chat slice; after the job is claimed, the success message
// points there.

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
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const jobId = rawId !== undefined && UUID_RE.test(rawId) ? rawId : null;

  // Wide scan window (not the board's 20): detail must resolve deep links
  // and filtered-board rows even when the shared open-job pool is large.
  const boardQuery = sparklTrpc.jobs.listRanked.useQuery({
    limit: 100,
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

  // The caller's own pending request/offer, across all jobs — used to
  // decide between "Request job" and the offer-response actions below.
  const myRequestsQuery = sparklTrpc.jobRequests.listMine.useQuery();

  const transitionJob = sparklTrpc.jobs.transition.useMutation();
  const requestJob = sparklTrpc.jobRequests.request.useMutation();
  const acceptRequest = sparklTrpc.jobRequests.accept.useMutation();
  const declineRequest = sparklTrpc.jobRequests.decline.useMutation();
  const withdrawRequest = sparklTrpc.jobRequests.withdraw.useMutation();
  const [claimed, setClaimed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const busy =
    transitionJob.isPending ||
    requestJob.isPending ||
    acceptRequest.isPending ||
    declineRequest.isPending ||
    withdrawRequest.isPending;

  async function refresh(): Promise<void> {
    await boardQuery.refetch();
    await claimedQuery.refetch();
    await myRequestsQuery.refetch();
  }

  async function handleRequest(): Promise<void> {
    if (jobId === null) return;
    setFormError(null);
    try {
      const result = await requestJob.mutateAsync({ jobId });
      if (result.status === "accepted") setClaimed(true);
      await refresh();
    } catch (err) {
      setFormError(requestSubmitErrorMessage(err));
    }
  }

  async function handleWithdraw(requestId: string): Promise<void> {
    setFormError(null);
    try {
      await withdrawRequest.mutateAsync({ requestId });
      await refresh();
    } catch (err) {
      setFormError(requestSubmitErrorMessage(err));
    }
  }

  async function handleAcceptOffer(requestId: string): Promise<void> {
    setFormError(null);
    try {
      await acceptRequest.mutateAsync({ requestId });
      setClaimed(true);
      await refresh();
    } catch (err) {
      setFormError(requestSubmitErrorMessage(err));
    }
  }

  async function handleDeclineOffer(requestId: string): Promise<void> {
    setFormError(null);
    try {
      await declineRequest.mutateAsync({ requestId });
      await refresh();
    } catch (err) {
      setFormError(requestSubmitErrorMessage(err));
    }
  }

  async function handleStart(): Promise<void> {
    if (jobId === null) return;
    setFormError(null);
    try {
      await transitionJob.mutateAsync({ jobId, toStatus: "in_progress" });
      await boardQuery.refetch();
      await claimedQuery.refetch();
    } catch {
      setFormError(strings.errors.generic);
    }
  }

  if (job === undefined) {
    if (boardQuery.isPending || claimedQuery.isPending) {
      return (
        <DetailScreen
          userRole="cleaner"
          testID="cleaner-job-detail-screen"
          title={strings.jobDetail.title}
        >
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
        </DetailScreen>
      );
    }
    return (
      <DetailScreen
        userRole="cleaner"
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
      </DetailScreen>
    );
  }

  const pill =
    STATUS_PILL[job.status === "in_progress" ? "inProgress" : job.status];
  const myRequest = myPendingRequestForJob(myRequestsQuery.data ?? [], job.id);

  return (
    <DetailScreen
      userRole="cleaner"
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
        {cleanerChatAvailableForStatus(job.status) ? (
          <SparklButton
            accessibilityLabel={strings.jobDetail.openChat}
            onPress={() => {
              router.push(stackHref("cleaner", segments, `chat/${job.id}`));
            }}
            testID="cleaner-job-open-chat"
            title={strings.jobDetail.openChat}
            variant="secondary"
          />
        ) : null}
        {cleanerReviewAvailableForStatus(job.status) ? (
          <SparklButton
            accessibilityLabel={strings.review.title}
            onPress={() => {
              router.push(stackHref("cleaner", segments, `review/${job.id}`));
            }}
            testID="cleaner-job-leave-review"
            title={strings.review.title}
            variant="secondary"
          />
        ) : null}
        {cleanerClaimAvailableForStatus(job.status) && !claimed ? (
          myRequest === null ? (
            <SparklButton
              accessibilityLabel={strings.jobDetail.request}
              loading={requestJob.isPending}
              onPress={() => {
                void handleRequest();
              }}
              testID="cleaner-job-request"
              title={strings.jobDetail.request}
            />
          ) : myRequest.initiatedBy === "host" ? (
            <>
              <SparklButton
                accessibilityLabel={strings.jobDetail.acceptOffer}
                loading={acceptRequest.isPending}
                onPress={() => {
                  void handleAcceptOffer(myRequest.id);
                }}
                testID="cleaner-job-accept-offer"
                title={strings.jobDetail.acceptOffer}
              />
              <SparklButton
                accessibilityLabel={strings.jobDetail.declineOffer}
                loading={declineRequest.isPending}
                onPress={() => {
                  void handleDeclineOffer(myRequest.id);
                }}
                testID="cleaner-job-decline-offer"
                title={strings.jobDetail.declineOffer}
                variant="secondary"
              />
            </>
          ) : (
            <>
              <Text style={styles.hint} testID="cleaner-job-requested">
                {strings.jobDetail.requested}
              </Text>
              <SparklButton
                accessibilityLabel={strings.jobDetail.withdrawRequest}
                loading={withdrawRequest.isPending}
                onPress={() => {
                  void handleWithdraw(myRequest.id);
                }}
                testID="cleaner-job-withdraw-request"
                title={strings.jobDetail.withdrawRequest}
                variant="secondary"
              />
            </>
          )
        ) : null}
        {cleanerStartAvailableForStatus(job.status) ? (
          <SparklButton
            accessibilityLabel={strings.jobDetail.start}
            loading={transitionJob.isPending}
            onPress={() => {
              void handleStart();
            }}
            testID="cleaner-job-start"
            title={strings.jobDetail.start}
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
    </DetailScreen>
  );
}
