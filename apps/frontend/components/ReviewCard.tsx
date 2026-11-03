import type { Review } from "@sparkl/shared";
import { StyleSheet, Text, View } from "react-native";
import { getStrings } from "../providers/i18n";
import { REVIEW_STARS, reviewStarsFill } from "../providers/leave-review";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_RADII,
  THEME_SPACING,
} from "../providers/theme";
import { BodyText } from "./BodyText";

// One sent review (design.md Review card): ★ glyph row (filled
// orange-deep up to the given stars, ink-mute after) under its eyebrow
// label, then the comment in a soft orange-tint panel so it reads as one
// highlighted block. The card itself keeps a stone border on paper.
// Shown on the Leave Review screen for a review already sent, and in
// a profile's Reviews section.
const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME_COLORS.paper,
    borderWidth: 1,
    borderColor: THEME_COLORS.stone,
    borderRadius: THEME_RADII.cardMax,
    padding: THEME_SPACING.rowMax,
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
  stars: {
    flexDirection: "row",
    gap: THEME_SPACING.rowMin,
  },
  star: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 20,
    lineHeight: 26,
  },
  starFilled: {
    color: THEME_COLORS.orangeDeep,
  },
  starEmpty: {
    color: THEME_COLORS.inkMute,
  },
  commentPanel: {
    backgroundColor: THEME_COLORS.orangeTint,
    borderRadius: THEME_RADII.control,
    padding: THEME_SPACING.rowMax,
    gap: THEME_SPACING.rowMin,
  },
});

interface ReviewCardProps {
  review: Review;
  testID?: string;
}

export function ReviewCard(props: ReviewCardProps) {
  const strings = getStrings();
  const filled = reviewStarsFill(props.review.stars);
  return (
    <View style={styles.card} testID={props.testID}>
      <View style={styles.field}>
        <Text style={styles.label}>{strings.review.ratingLabel}</Text>
        <View
          accessibilityLabel={strings.review.starsOutOf.replace(
            "{stars}",
            String(props.review.stars),
          )}
          accessibilityRole="text"
          style={styles.stars}
          testID={
            props.testID === undefined ? undefined : `${props.testID}-stars`
          }
        >
          {REVIEW_STARS.map((value, index) => (
            <Text
              key={value}
              style={[
                styles.star,
                filled[index] === true ? styles.starFilled : styles.starEmpty,
              ]}
            >
              {"★"}
            </Text>
          ))}
        </View>
      </View>
      {props.review.comment === null ? null : (
        <View style={styles.commentPanel}>
          <Text style={styles.label}>{strings.review.commentLabel}</Text>
          <BodyText>{props.review.comment}</BodyText>
        </View>
      )}
    </View>
  );
}
