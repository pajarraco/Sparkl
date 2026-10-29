import {
  ElmsSans_400Regular,
  ElmsSans_500Medium,
  ElmsSans_600SemiBold,
  ElmsSans_700Bold,
  useFonts,
} from "@expo-google-fonts/elms-sans";
import { Stack, router } from "expo-router";
import { Platform, StatusBar } from "react-native";
import { getApiOrigin, getPageHostname } from "../providers/app-config";
import {
  SparklProviders,
  createAuthenticatedTrpcClient,
  createQueryClient,
} from "../providers/app-providers";
import { authClient } from "../providers/auth-instance";
import {
  isSessionExpiredError,
  selectCookieGetter,
} from "../providers/auth-session";

// Root composition: theme is token-driven (global.css + THEME_*), auth
// session flows from SecureStore into tRPC headers via the stored cookie.
// Same localhost note as providers/auth-instance: read the bundled env so
// physical devices can target the dev PC's LAN address. On web the page
// hostname wins so cookies stay same-site.
const origin = getApiOrigin(
  { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL },
  getPageHostname(),
);
const queryClient = createQueryClient({
  onQueryError: handleExpiredSession,
  onMutationError: handleExpiredSession,
});
const trpcClient = createAuthenticatedTrpcClient({
  origin,
  getCookie: selectCookieGetter(Platform.OS, () => authClient.getCookie()),
});

// Expired sessions return to welcome (E2E navigation suite): any tRPC
// UNAUTHORIZED from queries or mutations signs out locally, and the
// group layouts' session check then bounces to welcome.
function handleExpiredSession(err: unknown): void {
  if (!isSessionExpiredError(err)) return;
  void authClient
    .signOut()
    .catch(() => undefined)
    .finally(() => {
      router.replace("/(auth)/welcome");
    });
}

export default function RootLayout() {
  // design.md Typography: Elms Sans for display and body. Nothing renders
  // until the four cuts load — otherwise every screen silently falls back
  // to the system font (the reported bug). Returning null keeps the native
  // splash up; on web expo-font injects @font-face for the same names.
  const [fontsLoaded] = useFonts({
    ElmsSans_400Regular,
    ElmsSans_500Medium,
    ElmsSans_600SemiBold,
    ElmsSans_700Bold,
  });
  if (!fontsLoaded) return null;
  return (
    <SparklProviders queryClient={queryClient} trpcClient={trpcClient}>
      <StatusBar barStyle="dark-content" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(host)" />
        <Stack.Screen name="(cleaner)" />
      </Stack>
    </SparklProviders>
  );
}
