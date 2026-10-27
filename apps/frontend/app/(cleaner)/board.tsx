import { BodyText } from "../../components/BodyText";
import { Screen } from "../../components/Screen";
import { getStrings } from "../../providers/i18n";

// Cleaner Board stub: the ranked board lands in task 7; the designed
// empty state ships now so the tab shell is complete.
export default function CleanerBoardScreen() {
  const strings = getStrings();
  return (
    <Screen
      subtitle={strings.board.subtitle}
      testID="cleaner-board-screen"
      title={strings.board.title}
    >
      <BodyText>{strings.emptyStates.noOpenJobs}</BodyText>
    </Screen>
  );
}
