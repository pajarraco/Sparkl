import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Screen } from "../../components/Screen";
import { SparklButton } from "../../components/SparklButton";
import { getStrings } from "../../providers/i18n";
import { THEME_SPACING } from "../../providers/theme";

const styles = StyleSheet.create({
  actions: {
    gap: THEME_SPACING.rowMax,
    marginTop: THEME_SPACING.section,
  },
});

export default function WelcomeScreen() {
  const strings = getStrings().auth;
  const router = useRouter();
  return (
    <Screen
      subtitle={strings.welcomeSubtitle}
      testID="welcome-screen"
      title={strings.welcomeTitle}
    >
      <View style={styles.actions}>
        <SparklButton
          accessibilityLabel={strings.signUp}
          onPress={() => {
            router.push("/(auth)/sign-up");
          }}
          testID="welcome-sign-up"
          title={strings.signUp}
        />
        <SparklButton
          accessibilityLabel={strings.signIn}
          onPress={() => {
            router.push("/(auth)/sign-in");
          }}
          testID="welcome-sign-in"
          title={strings.signIn}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}
