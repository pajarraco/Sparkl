import type { JobRequestWithCleaner, RankedCleaner } from "@sparkl/shared";
import { useLocalSearchParams, useRouter, useSegments } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { BodyText } from "../../../../../components/BodyText";
import { DetailScreen } from "../../../../../components/DetailScreen";
import { SparklButton } from "../../../../../components/SparklButton";
import { sparklTrpc } from "../../../../../providers/app-providers";
import { getStrings } from "../../../../../providers/i18n";
import {
  type HostJobAction,
  hasPendingOfferTo,
  hostActionsForStatus,
  hostChatAvailableForStatus,
  hostReviewAvailableForStatus,
  suggestionTrustLine,
} from "../../../../../providers/job-detail";
import {
  formatJobWindow,
  formatPriceMinorUnits,
  statusLabelFor,
} from "../../../../../providers/my-jobs";
import { stackHref } from "../../../../../providers/tabs";
import { STATUS_PILL } from "../../../../../providers/theme";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../../../../../providers/theme";

// Host Job Detail (design.md Screen Inventory): status, ranked cleaner
// suggestions from suggestions.forJob, lifecycle actions. The job itself
// comes from the host's own jobs.myJobs list — no extra backend route.
// Suggestions load only while the job is open; chat entry and reviews
// arrive with their own slices.

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
  suggestion: {
    backgroundColor: THEME_COLORS.paper,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.cardMax,
    padding: THEME_SPACING.rowMax,
    gap: THEME_SPACING.rowMin,
  },
  suggestionName: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 20,
    lineHeight: 26,
    color: THEME_COLORS.ink,
  },
  suggestionTrust: {
    fontFamily: THEME_FONT_FAMILY.regular,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.inkSoft,
  },
  suggestionStars: {
    color: THEME_COLORS.orangeDeep,
    fontWeight: "500",
  },
  bestMatch: {
    alignSelf: "flex-start",
    backgroundColor: THEME_COLORS.orangeTint,
    borderRadius: THEME_RADII.control,
    paddingHorizontal: THEME_SPACING.rowMin,
    paddingVertical: 2,
  },
  bestMatchText: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 12,
    lineHeight: 16,
    color: THEME_COLORS.orangeDeep,
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
  flatList: {
    flex: 1,
  },
  formError: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.danger,
  },
});

function SuggestionRow(props: {
  suggestion: RankedCleaner;
  isBestMatch: boolean;
  bestMatchLabel: string;
  offered: boolean;
  offerBusy: boolean;
  onOffer: () => void;
}) {
  const strings = getStrings();
  const { profile } = props.suggestion.cleaner;
  return (
    <View style={styles.suggestion} testID={`job-suggestion-${profile.id}`}>
      <Text style={styles.suggestionName}>{profile.name}</Text>
      <Text style={styles.suggestionTrust}>
        <Text style={styles.suggestionStars}>{"★ "}</Text>
        {suggestionTrustLine(profile)}
      </Text>
      {props.isBestMatch ? (
        <View style={styles.bestMatch}>
          <Text style={styles.bestMatchText}>{props.bestMatchLabel}</Text>
        </View>
      ) : null}
      {props.offered ? (
        <Text
          style={styles.hint}
          testID={`job-suggestion-offered-${profile.id}`}
        >
          {strings.jobDetail.offerSentSuccess}
        </Text>
      ) : (
        <SparklButton
          accessibilityLabel={strings.jobDetail.offerJob}
          loading={props.offerBusy}
          onPress={props.onOffer}
          testID={`job-suggestion-offer-${profile.id}`}
          title={strings.jobDetail.offerJob}
          variant="secondary"
        />
      )}
    </View>
  );
}

function RequestRow(props: {
  row: JobRequestWithCleaner;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const strings = getStrings();
  const { cleaner } = props.row;
  return (
    <View style={styles.suggestion} testID={`job-request-${cleaner.id}`}>
      <Text style={styles.suggestionName}>{cleaner.name}</Text>
      <Text style={styles.suggestionTrust}>
        <Text style={styles.suggestionStars}>{"★ "}</Text>
        {suggestionTrustLine(cleaner)}
      </Text>
      <View style={styles.actions}>
        <SparklButton
          accessibilityLabel={strings.jobDetail.acceptRequest}
          loading={props.busy}
          onPress={props.onAccept}
          testID={`job-request-accept-${cleaner.id}`}
          title={strings.jobDetail.acceptRequest}
        />
        <SparklButton
          accessibilityLabel={strings.jobDetail.declineRequest}
          loading={props.busy}
          onPress={props.onDecline}
          testID={`job-request-decline-${cleaner.id}`}
          title={strings.jobDetail.declineRequest}
          variant="secondary"
        />
      </View>
    </View>
  );
}

export default function HostJobDetailScreen() {
  const strings = getStrings();
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const jobId = rawId !== undefined && UUID_RE.test(rawId) ? rawId : null;

  const jobsQuery = sparklTrpc.jobs.myJobs.useQuery({});
  const job =
    jobId === null || jobsQuery.data === undefined
      ? undefined
      : jobsQuery.data.find((candidate) => candidate.id === jobId);

  const suggestionsQuery = sparklTrpc.suggestions.forJob.useQuery(
    { jobId: jobId ?? "" },
    { enabled: jobId !== null && job?.status === "open" },
  );
  // Pending requests/offers on this job (03 D): cleaner-initiated rows
  // need the host's Accept/Decline; host-initiated rows mark a
  // suggestion as already offered.
  const requestsQuery = sparklTrpc.jobRequests.listForJob.useQuery(
    { jobId: jobId ?? "" },
    { enabled: jobId !== null && job?.status === "open" },
  );
  const pendingRequests = (requestsQuery.data ?? []).filter(
    (row) => row.request.initiatedBy === "cleaner",
  );

  const cancelJob = sparklTrpc.jobs.cancel.useMutation();
  const transitionJob = sparklTrpc.jobs.transition.useMutation();
  const offerJob = sparklTrpc.jobRequests.offer.useMutation();
  const acceptRequest = sparklTrpc.jobRequests.accept.useMutation();
  const declineRequest = sparklTrpc.jobRequests.decline.useMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const busy =
    cancelJob.isPending ||
    transitionJob.isPending ||
    offerJob.isPending ||
    acceptRequest.isPending ||
    declineRequest.isPending;

  async function refresh(): Promise<void> {
    await jobsQuery.refetch();
    await suggestionsQuery.refetch();
    await requestsQuery.refetch();
  }

  async function handleAction(action: HostJobAction): Promise<void> {
    if (jobId === null) return;
    setFormError(null);
    try {
      if (action === "cancel") {
        await cancelJob.mutateAsync({ jobId });
      } else {
        await transitionJob.mutateAsync({ jobId, toStatus: "completed" });
      }
      await refresh();
    } catch {
      setFormError(strings.errors.generic);
    }
  }

  async function handleOffer(cleanerId: string): Promise<void> {
    if (jobId === null) return;
    setFormError(null);
    try {
      await offerJob.mutateAsync({ jobId, cleanerId });
      await refresh();
    } catch {
      setFormError(strings.errors.generic);
    }
  }

  async function handleAcceptRequest(requestId: string): Promise<void> {
    setFormError(null);
    try {
      await acceptRequest.mutateAsync({ requestId });
      await refresh();
    } catch {
      setFormError(strings.errors.generic);
    }
  }

  async function handleDeclineRequest(requestId: string): Promise<void> {
    setFormError(null);
    try {
      await declineRequest.mutateAsync({ requestId });
      await refresh();
    } catch {
      setFormError(strings.errors.generic);
    }
  }

  function renderSuggestion({
    item,
    index,
  }: {
    item: RankedCleaner;
    index: number;
  }) {
    return (
      <SuggestionRow
        bestMatchLabel={strings.jobDetail.bestMatch}
        isBestMatch={index === 0}
        offerBusy={offerJob.isPending}
        offered={hasPendingOfferTo(
          requestsQuery.data ?? [],
          item.cleaner.profile.id,
        )}
        onOffer={() => {
          void handleOffer(item.cleaner.profile.id);
        }}
        suggestion={item}
      />
    );
  }

  if (jobsQuery.isPending) {
    return (
      <DetailScreen
        userRole="host"
        testID="host-job-detail-screen"
        title={strings.jobDetail.title}
      >
        <View style={styles.skeleton} />
        <View style={styles.skeleton} />
      </DetailScreen>
    );
  }

  if (jobsQuery.isError || job === undefined) {
    return (
      <DetailScreen
        userRole="host"
        testID="host-job-detail-screen"
        title={strings.jobDetail.title}
      >
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {strings.errors.generic}
        </Text>
        <SparklButton
          accessibilityLabel={strings.errors.retry}
          onPress={() => {
            void refresh();
          }}
          testID="host-job-detail-retry"
          title={strings.errors.retry}
          variant="secondary"
        />
      </DetailScreen>
    );
  }

  const pill =
    STATUS_PILL[job.status === "in_progress" ? "inProgress" : job.status];
  const actions = hostActionsForStatus(job.status);

  return (
    <DetailScreen
      userRole="host"
      scroll={false}
      subtitle={job.address}
      testID="host-job-detail-screen"
      title={strings.jobDetail.title}
    >
      <FlatList
        ListFooterComponent={
          <View style={styles.actions}>
            {hostChatAvailableForStatus(job.status) ? (
              <SparklButton
                accessibilityLabel={strings.jobDetail.openChat}
                onPress={() => {
                  router.push(stackHref("host", segments, `chat/${job.id}`));
                }}
                testID="host-job-open-chat"
                title={strings.jobDetail.openChat}
                variant="secondary"
              />
            ) : null}
            {hostReviewAvailableForStatus(job.status) ? (
              <SparklButton
                accessibilityLabel={strings.review.title}
                onPress={() => {
                  router.push(stackHref("host", segments, `review/${job.id}`));
                }}
                testID="host-job-leave-review"
                title={strings.review.title}
                variant="secondary"
              />
            ) : null}
            {actions.includes("complete") ? (
              <SparklButton
                accessibilityLabel={strings.jobDetail.complete}
                loading={transitionJob.isPending}
                onPress={() => {
                  void handleAction("complete");
                }}
                testID="host-job-complete"
                title={strings.jobDetail.complete}
              />
            ) : null}
            {actions.includes("cancel") ? (
              <SparklButton
                accessibilityLabel={strings.jobDetail.cancel}
                loading={cancelJob.isPending}
                onPress={() => {
                  void handleAction("cancel");
                }}
                testID="host-job-cancel"
                title={strings.jobDetail.cancel}
                variant="destructive"
              />
            ) : null}
            {formError === null || busy ? null : (
              <Text accessibilityLiveRegion="polite" style={styles.formError}>
                {formError}
              </Text>
            )}
          </View>
        }
        ListHeaderComponent={
          <View>
            <View style={styles.section}>
              <Text style={styles.heading}>
                {strings.jobDetail.statusHeading}
              </Text>
              <View style={[styles.pill, { backgroundColor: pill.background }]}>
                <Text style={[styles.pillText, { color: pill.text }]}>
                  {statusLabelFor(job.status)}
                </Text>
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.heading}>
                {strings.jobDetail.dateHeading}
              </Text>
              <Text style={styles.body}>
                {formatJobWindow(job.windowStart, job.windowEnd)}
              </Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.heading}>
                {strings.jobDetail.priceHeading}
              </Text>
              <Text style={styles.body}>
                {formatPriceMinorUnits(job.priceMinorUnits)}
              </Text>
            </View>
            {job.notes === null ? null : (
              <View style={styles.section}>
                <Text style={styles.heading}>
                  {strings.jobDetail.notesHeading}
                </Text>
                <Text style={styles.body}>{job.notes}</Text>
              </View>
            )}
            {job.status === "open" && pendingRequests.length > 0 ? (
              <View style={styles.section} testID="host-job-requests">
                <Text style={styles.heading}>
                  {strings.jobDetail.requestsHeading}
                </Text>
                <Text style={styles.hint}>
                  {strings.jobDetail.requestsHint}
                </Text>
                {pendingRequests.map((row) => (
                  <RequestRow
                    key={row.request.id}
                    busy={acceptRequest.isPending || declineRequest.isPending}
                    onAccept={() => {
                      void handleAcceptRequest(row.request.id);
                    }}
                    onDecline={() => {
                      void handleDeclineRequest(row.request.id);
                    }}
                    row={row}
                  />
                ))}
              </View>
            ) : null}
            {job.status === "open" ? (
              <View style={styles.section}>
                <Text style={styles.heading}>
                  {strings.jobDetail.suggestionsHeading}
                </Text>
                <Text style={styles.hint}>
                  {strings.jobDetail.suggestionsHint}
                </Text>
              </View>
            ) : null}
          </View>
        }
        contentContainerStyle={{ gap: THEME_SPACING.rowMax }}
        data={
          job.status === "open"
            ? (suggestionsQuery.data?.suggestions ?? [])
            : []
        }
        keyExtractor={(item) => item.cleaner.profile.id}
        ListEmptyComponent={
          job.status === "open" ? (
            suggestionsQuery.isPending ? (
              <View style={styles.skeleton} testID="job-suggestions-loading" />
            ) : (
              <BodyText>{strings.emptyStates.noSuggestions}</BodyText>
            )
          ) : undefined
        }
        renderItem={renderSuggestion}
        style={styles.flatList}
        testID="host-job-detail-suggestions"
      />
    </DetailScreen>
  );
}
