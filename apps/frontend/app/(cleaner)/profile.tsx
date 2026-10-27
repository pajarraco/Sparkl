import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Screen } from "../../components/Screen";
import { SparklButton } from "../../components/SparklButton";
import { authClient } from "../../providers/auth-instance";
import { getStrings } from "../../providers/i18n";
import { THEME_SPACING } from "../../providers/theme";

// Profile stub: photo, service area and availability editing land in
// task 7; sign-out is real now so testers can switch roles between demo
// runs.
const styles = StyleSheet.create({
  actions: {
    marginTop: THEME_SPACING.section,
  },
});

export default function CleanerProfileScreen() {
  const strings = getStrings();
  const router = useRouter();

  async function handleSignOut(): Promise<void> {
    try {
      await authClient.signOut();
    } finally {
      router.replace("/(auth)/welcome");
    }
  }

  return (
    <Screen testID="cleaner-profile-screen" title={strings.profile.title}>
      <View style={styles.actions}>
        <SparklButton
          accessibilityLabel={strings.profile.signOut}
          onPress={() => {
            void handleSignOut();
          }}
          testID="cleaner-profile-sign-out"
          title={strings.profile.signOut}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}
