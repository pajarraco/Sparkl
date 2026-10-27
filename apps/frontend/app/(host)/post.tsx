import { BodyText } from "../../components/BodyText.js";
import { Screen } from "../../components/Screen.js";
import { getStrings } from "../../providers/i18n.js";

// Post stub: the posting form lands in task 6; the title and next action
// ship now so the center tab exists.
export default function HostPostScreen() {
  const strings = getStrings();
  return (
    <Screen testID="host-post-screen" title={strings.postJob.title}>
      <BodyText>{strings.emptyStates.postFirst}</BodyText>
    </Screen>
  );
}
