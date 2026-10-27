import { BodyText } from "../../components/BodyText.js";
import { Screen } from "../../components/Screen.js";
import { getStrings } from "../../providers/i18n.js";

// Messages stub: the chat thread lands in tasks 6–7; the designed empty
// state ships now.
export default function HostMessagesScreen() {
  const strings = getStrings();
  return (
    <Screen testID="host-messages-screen" title={strings.chat.title}>
      <BodyText>{strings.emptyStates.noMessages}</BodyText>
    </Screen>
  );
}
