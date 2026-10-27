import { BodyText } from "../../components/BodyText";
import { Screen } from "../../components/Screen";
import { getStrings } from "../../providers/i18n";

// Cleaner My Jobs stub: claimed/active/history lists land in task 7; the
// designed empty state ships now.
export default function CleanerMyJobsScreen() {
  const strings = getStrings();
  return (
    <Screen
      subtitle={strings.emptyStates.noMyJobs}
      testID="cleaner-my-jobs-screen"
      title={strings.myJobs.title}
    >
      <BodyText>{strings.emptyStates.noHistory}</BodyText>
    </Screen>
  );
}
