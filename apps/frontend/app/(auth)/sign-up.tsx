import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RolePicker } from "../../components/RolePicker";
import { Screen } from "../../components/Screen";
import { SparklButton } from "../../components/SparklButton";
import { SparklTextField } from "../../components/SparklTextField";
import type { AppRole } from "../../providers/auth";
import {
  type AuthFieldErrors,
  validateSignUp,
} from "../../providers/auth-forms";
import { authClient } from "../../providers/auth-instance";
import { getHomeRouteForRole } from "../../providers/auth-navigation";
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

export default function SignUpScreen() {
  const strings = getStrings();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole | null>(null);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp(): Promise<void> {
    const result = validateSignUp({ name, email, password, role });
    setErrors(result.errors);
    if (result.data === null) return;
    setLoading(true);
    setFormError(null);
    try {
      const signUp = await authClient.signUp.email({
        name: result.data.name,
        email: result.data.email,
        password: result.data.password,
        role: result.data.role,
      });
      if (signUp.error !== null) {
        setFormError(strings.errors.generic);
        return;
      }
      router.replace(getHomeRouteForRole(result.data.role));
    } catch {
      setFormError(strings.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen center testID="sign-up-screen" title={strings.auth.signUp}>
      <View style={styles.form}>
        <SparklTextField
          error={errors.name}
          label={strings.auth.nameLabel}
          onChangeText={setName}
          testID="sign-up-name"
          value={name}
        />
        <SparklTextField
          autoCapitalize="none"
          error={errors.email}
          keyboardType="email-address"
          label={strings.auth.emailLabel}
          onChangeText={setEmail}
          testID="sign-up-email"
          value={email}
        />
        <SparklTextField
          error={errors.password}
          label={strings.auth.passwordLabel}
          onChangeText={setPassword}
          secureTextEntry
          testID="sign-up-password"
          value={password}
        />
        <RolePicker onSelect={setRole} testID="sign-up-role" value={role} />
        {errors.role === undefined ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.formError}>
            {errors.role}
          </Text>
        )}
        {formError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.formError}>
            {formError}
          </Text>
        )}
        <SparklButton
          accessibilityLabel={strings.auth.signUp}
          loading={loading}
          onPress={() => {
            void handleSignUp();
          }}
          testID="sign-up-submit"
          title={strings.auth.signUp}
        />
        <SparklButton
          accessibilityLabel={strings.auth.haveAccount}
          onPress={() => {
            router.replace("/(auth)/sign-in");
          }}
          testID="sign-up-to-sign-in"
          title={strings.auth.haveAccount}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}
