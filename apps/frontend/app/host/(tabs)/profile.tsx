import { StyleSheet, View } from "react-native";
import { ReviewsReceived } from "../../../components/ReviewsReceived";
import { Screen } from "../../../components/Screen";
import { SparklButton } from "../../../components/SparklButton";
import { sparklTrpc } from "../../../providers/app-providers";
import { authClient } from "../../../providers/auth-instance";
import { getStrings } from "../../../providers/i18n";
import { THEME_SPACING } from "../../../providers/theme";

// Profile stub: account detail lands in tasks 6–7; sign-out is real now so
// testers can switch roles between demo runs. The reviews a host received
// show above it.
const styles = StyleSheet.create({
  actions: {
    marginTop: THEME_SPACING.section,
  },
});

export default function HostProfileScreen() {
  const strings = getStrings();
  const profileQuery = sparklTrpc.users.getProfile.useQuery();

  // No explicit navigation here: the tab layout redirects to welcome once
  // the session clears. Navigating too caused a visible double reload.
  async function handleSignOut(): Promise<void> {
    await authClient.signOut();
  }

  return (
    <Screen testID="host-profile-screen" title={strings.profile.title}>
      {profileQuery.data === undefined ? null : (
        <ReviewsReceived subjectId={profileQuery.data.id} />
      )}
      <View style={styles.actions}>
        <SparklButton
          accessibilityLabel={strings.profile.signOut}
          onPress={() => {
            void handleSignOut();
          }}
          testID="host-profile-sign-out"
          title={strings.profile.signOut}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}
