import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { SparklButton } from "../../components/SparklButton";
import { SparklTextField } from "../../components/SparklTextField";
import { parseAppRole } from "../../providers/auth";
import {
  type AuthFieldErrors,
  validateSignIn,
} from "../../providers/auth-forms";
import { authClient } from "../../providers/auth-instance";
import { getHomeRouteForRole } from "../../providers/auth-navigation";
import { waitForSessionEmail } from "../../providers/auth-session";
import { getStrings } from "../../providers/i18n";
import {
  THEME_COLORS,
  THEME_FONT_FAMILY,
  THEME_SPACING,
} from "../../providers/theme";

const styles = StyleSheet.create({
  form: {
    gap: THEME_SPACING.rowMax,
    marginTop: THEME_SPACING.section,
  },
  formError: {
    fontFamily: THEME_FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME_COLORS.danger,
  },
});

export default function SignInScreen() {
  const strings = getStrings();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(): Promise<void> {
    const result = validateSignIn({ email, password });
    setErrors(result.errors);
    if (result.data === null) return;
    setLoading(true);
    setFormError(null);
    try {
      const signIn = await authClient.signIn.email({
        email: result.data.email,
        password: result.data.password,
      });
      if (signIn.error !== null) {
        setFormError(strings.errors.generic);
        return;
      }
      const fresh = await waitForSessionEmail(
        () => authClient.getSession(),
        result.data.email,
      );
      if (fresh === null) {
        setFormError(strings.errors.generic);
        return;
      }
      // Push the fresh session into the shared store BEFORE navigating:
      // the tab layouts read useSession, and without this they can still
      // see the signed-out state and bounce straight back to welcome.
      authClient.hydrateSession(fresh);
      const role = parseAppRole(
        (fresh.user as { role?: unknown } | null)?.role,
      );
      if (role === null) {
        setFormError(strings.errors.generic);
        return;
      }
      router.replace(getHomeRouteForRole(role));
    } catch {
      setFormError(strings.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen center testID="sign-in-screen" title={strings.auth.signIn}>
      <View style={styles.form}>
        <SparklTextField
          autoCapitalize="none"
          error={errors.email}
          keyboardType="email-address"
          label={strings.auth.emailLabel}
          onChangeText={setEmail}
          testID="sign-in-email"
          value={email}
        />
        <SparklTextField
          error={errors.password}
          label={strings.auth.passwordLabel}
          onChangeText={setPassword}
          secureTextEntry
          testID="sign-in-password"
          value={password}
        />
        {formError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.formError}>
            {formError}
          </Text>
        )}
        <SparklButton
          accessibilityLabel={strings.auth.signIn}
          loading={loading}
          onPress={() => {
            void handleSignIn();
          }}
          testID="sign-in-submit"
          title={strings.auth.signIn}
        />
        <SparklButton
          accessibilityLabel={strings.auth.needAccount}
          onPress={() => {
            router.replace("/(auth)/sign-up");
          }}
          testID="sign-in-to-sign-up"
          title={strings.auth.needAccount}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}
