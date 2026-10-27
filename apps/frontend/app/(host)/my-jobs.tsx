import { BodyText } from "../../components/BodyText.js";
import { Screen } from "../../components/Screen.js";
import { getStrings } from "../../providers/i18n.js";

// Host My Jobs stub: real lists land in task 6; the designed empty state
// ships now so the tab shell is complete.
export default function HostMyJobsScreen() {
  const strings = getStrings();
  return (
    <Screen
      subtitle={strings.emptyStates.noMyJobs}
      testID="host-my-jobs-screen"
      title={strings.myJobs.title}
    >
      <BodyText>{strings.emptyStates.postFirst}</BodyText>
    </Screen>
  );
}
