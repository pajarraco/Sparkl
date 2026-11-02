import type { Review } from "@sparkl/shared";
import { StyleSheet, Text, View } from "react-native";
import { getStrings } from "../providers/i18n";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_SPACING,
} from "../providers/theme";
import { BodyText } from "./BodyText";

// One review: its star rating and comment, each under its own eyebrow
// label (design.md Spacing) so the two never read as one undifferentiated
// block of text. Shown on the Leave Review screen for a review already
// sent, and in the Reviews section of a profile.
const styles = StyleSheet.create({
  card: {
    gap: THEME_SPACING.rowMax,
  },
  field: {
    gap: THEME_SPACING.rowMin,
  },
  label: {
    fontFamily: THEME_FONT_FAMILY.semiBold,
    fontSize: 12,
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: THEME_COLORS.inkSoft,
  },
});

interface ReviewCardProps {
  review: Review;
  testID?: string;
}

export function ReviewCard(props: ReviewCardProps) {
  const strings = getStrings();
  return (
    <View style={styles.card} testID={props.testID}>
      <View style={styles.field}>
        <Text style={styles.label}>{strings.review.ratingLabel}</Text>
        <BodyText>
          {strings.review.starsOutOf.replace(
            "{stars}",
            String(props.review.stars),
          )}
        </BodyText>
      </View>
      {props.review.comment === null ? null : (
        <View style={styles.field}>
          <Text style={styles.label}>{strings.review.commentLabel}</Text>
          <BodyText>{props.review.comment}</BodyText>
        </View>
      )}
    </View>
  );
}
