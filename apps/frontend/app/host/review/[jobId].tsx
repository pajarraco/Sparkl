import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BodyText } from "../../../components/BodyText";
import { Screen } from "../../../components/Screen";
import { SparklButton } from "../../../components/SparklButton";
import { SparklTextField } from "../../../components/SparklTextField";
import { sparklTrpc } from "../../../providers/app-providers";
import { getStrings } from "../../../providers/i18n";
import {
  REVIEW_STARS,
  type ReviewFieldErrors,
  type ReviewStars,
  hostReviewSubjectForJob,
  reviewSubmitErrorMessage,
  validateReviewForm,
} from "../../../providers/leave-review";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../../../providers/theme";

// Host Leave Review screen (design.md Screen Inventory): 1–5 tappable
// ★ glyphs (orange-deep when selected, ink-mute when not) plus an
// optional comment, submitted through reviews.create. The server owns
// the rules (completed-only, job-party author, other-party subject,
// one review per job+author); the screen only validates the form and
// maps the duplicate failure to its string. The entry point lives on
// Job Detail for completed jobs, so the form stays reachable from
// history afterwards. Stars render as a radio group: the visible label
// above names the control, each star is a numbered radio with its
// selected state announced.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const styles = StyleSheet.create({
  form: {
    gap: THEME_SPACING.rowMax,
    marginTop: THEME_SPACING.section,
  },
  groupLabel: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 12,
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: THEME_COLORS.ink,
    marginBottom: THEME_SPACING.rowMin,
  },
  stars: {
    flexDirection: "row",
    gap: THEME_SPACING.rowMin,
  },
  star: {
    minHeight: THEME_SPACING.touchTarget,
    minWidth: THEME_SPACING.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  starGlyph: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 32,
    lineHeight: 38,
  },
  starSelected: {
    color: THEME_COLORS.orangeDeep,
  },
  starUnselected: {
    color: THEME_COLORS.inkMute,
  },
  skeleton: {
    height: 96,
    backgroundColor: THEME_COLORS.paper2,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.cardMax,
  },
  formError: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.danger,
  },
  success: {
    gap: THEME_SPACING.rowMax,
    marginTop: THEME_SPACING.section,
  },
});

export default function HostLeaveReviewScreen() {
  const strings = getStrings();
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId: string }>();
  const rawId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;
  const jobId = rawId !== undefined && UUID_RE.test(rawId) ? rawId : null;

  const jobsQuery = sparklTrpc.jobs.myJobs.useQuery(
    {},
    { enabled: jobId !== null },
  );
  const createReview = sparklTrpc.reviews.create.useMutation();

  const [stars, setStars] = useState<ReviewStars | null>(null);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<ReviewFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(subjectId: string): Promise<void> {
    const result = validateReviewForm({ stars, comment });
    setErrors(result.errors);
    if (result.data === null || jobId === null) return;
    setFormError(null);
    try {
      await createReview.mutateAsync({
        jobId,
        subjectId,
        stars: result.data.stars,
        comment: result.data.comment,
      });
      setSubmitted(true);
    } catch (err) {
      setFormError(reviewSubmitErrorMessage(err));
    }
  }

  if (jobId === null) {
    return (
      <Screen testID="host-leave-review-screen" title={strings.review.title}>
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {strings.errors.generic}
        </Text>
      </Screen>
    );
  }

  if (jobsQuery.isPending) {
    return (
      <Screen testID="host-leave-review-screen" title={strings.review.title}>
        <View style={styles.skeleton} />
        <View style={styles.skeleton} />
      </Screen>
    );
  }

  const job =
    jobsQuery.data === undefined
      ? undefined
      : jobsQuery.data.find((candidate) => candidate.id === jobId);
  const subjectId = job === undefined ? null : hostReviewSubjectForJob(job);

  if (jobsQuery.isError || job === undefined || subjectId === null) {
    return (
      <Screen testID="host-leave-review-screen" title={strings.review.title}>
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {strings.errors.generic}
        </Text>
        <SparklButton
          accessibilityLabel={strings.errors.retry}
          onPress={() => {
            void jobsQuery.refetch();
          }}
          testID="leave-review-retry"
          title={strings.errors.retry}
          variant="secondary"
        />
      </Screen>
    );
  }

  if (job.status !== "completed") {
    return (
      <Screen
        subtitle={job.address}
        testID="host-leave-review-screen"
        title={strings.review.title}
      >
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {strings.errors.generic}
        </Text>
      </Screen>
    );
  }

  if (submitted) {
    return (
      <Screen testID="host-leave-review-screen" title={strings.review.title}>
        <View style={styles.success}>
          <BodyText testID="leave-review-success">
            {strings.review.success}
          </BodyText>
          <SparklButton
            accessibilityLabel={strings.jobDetail.title}
            onPress={() => {
              router.back();
            }}
            testID="leave-review-back"
            title={strings.jobDetail.title}
            variant="secondary"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      subtitle={job.address}
      testID="host-leave-review-screen"
      title={strings.review.title}
    >
      <BodyText>{strings.review.prompt}</BodyText>
      <View style={styles.form}>
        <View>
          <Text nativeID="leave-review-stars-label" style={styles.groupLabel}>
            {strings.review.starsLabel}
          </Text>
          <View style={styles.stars} testID="review-stars">
            {REVIEW_STARS.map((value) => {
              const selected = stars !== null && value <= stars;
              return (
                <Pressable
                  key={value}
                  accessibilityLabel={String(value)}
                  accessibilityLabelledBy="leave-review-stars-label"
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setStars(value);
                    if (errors.stars !== undefined) setErrors({});
                  }}
                  style={styles.star}
                  testID={`review-star-${value}`}
                >
                  <Text
                    style={[
                      styles.starGlyph,
                      selected ? styles.starSelected : styles.starUnselected,
                    ]}
                  >
                    {"★"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.stars === undefined ? null : (
            <Text accessibilityLiveRegion="polite" style={styles.formError}>
              {errors.stars}
            </Text>
          )}
        </View>
        <SparklTextField
          error={errors.comment}
          label={strings.review.commentLabel}
          onChangeText={setComment}
          placeholder={strings.review.commentPlaceholder}
          testID="review-comment"
          value={comment}
        />
        {formError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.formError}>
            {formError}
          </Text>
        )}
        <SparklButton
          accessibilityLabel={strings.review.submit}
          loading={createReview.isPending}
          onPress={() => {
            void handleSubmit(subjectId);
          }}
          testID="review-submit"
          title={strings.review.submit}
        />
      </View>
    </Screen>
  );
}
