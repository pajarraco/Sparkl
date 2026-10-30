import type { Review } from "@sparkl/shared";
import { StyleSheet, View } from "react-native";
import { getStrings } from "../providers/i18n";
import { THEME_SPACING } from "../providers/theme";
import { BodyText } from "./BodyText";

// One review: its star rating and comment. Shown on the Leave Review screen
// for a review already sent, and in the Reviews section of a profile.
const styles = StyleSheet.create({
  card: {
    gap: THEME_SPACING.rowMin,
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
      <BodyText>
        {strings.review.starsOutOf.replace(
          "{stars}",
          String(props.review.stars),
        )}
      </BodyText>
      {props.review.comment === null ? null : (
        <BodyText>{props.review.comment}</BodyText>
      )}
    </View>
  );
}
