import { BodyText } from "../../components/BodyText.js";
import { Screen } from "../../components/Screen.js";
import { getStrings } from "../../providers/i18n.js";

// Messages stub: the chat thread lands in tasks 6–7; the designed empty
// state ships now.
export default function CleanerMessagesScreen() {
  const strings = getStrings();
  return (
    <Screen testID="cleaner-messages-screen" title={strings.chat.title}>
      <BodyText>{strings.emptyStates.noMessages}</BodyText>
    </Screen>
  );
}
