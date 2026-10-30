import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { sparklTrpc } from "../providers/app-providers";
import { getStrings } from "../providers/i18n";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_SPACING,
} from "../providers/theme";
import { BodyText } from "./BodyText";
import { ReviewCard } from "./ReviewCard";

// Reviews a user has received, newest first. reviews.listBySubject is public
// (it feeds trust rows), so the same list serves a user's own profile.
const styles = StyleSheet.create({
  section: {
    gap: THEME_SPACING.rowMax,
    marginTop: THEME_SPACING.section,
  },
  title: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 12,
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: THEME_COLORS.ink,
  },
});

interface ReviewsReceivedProps {
  subjectId: string;
}

export function ReviewsReceived(props: ReviewsReceivedProps) {
  const strings = getStrings();
  const query = sparklTrpc.reviews.listBySubject.useQuery({
    subjectId: props.subjectId,
    limit: 20,
    offset: 0,
  });

  let body: ReactNode;
  if (query.isPending) {
    body = null;
  } else if (query.isError) {
    body = <BodyText>{strings.errors.generic}</BodyText>;
  } else if (query.data.reviews.length === 0) {
    body = <BodyText soft>{strings.review.receivedEmpty}</BodyText>;
  } else {
    body = query.data.reviews.map((review) => (
      <ReviewCard key={review.id} review={review} testID="review-card" />
    ));
  }

  return (
    <View style={styles.section} testID="reviews-received">
      <Text accessibilityRole="header" style={styles.title}>
        {strings.review.receivedTitle}
      </Text>
      {body}
    </View>
  );
}
