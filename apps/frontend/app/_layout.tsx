import {
  ElmsSans_400Regular,
  ElmsSans_500Medium,
  ElmsSans_600SemiBold,
  ElmsSans_700Bold,
  useFonts,
} from "@expo-google-fonts/elms-sans";
import { Stack } from "expo-router";
import { Platform, StatusBar } from "react-native";
import { getApiOrigin } from "../providers/app-config";
import {
  SparklProviders,
  createAuthenticatedTrpcClient,
  createQueryClient,
} from "../providers/app-providers";
import { authClient } from "../providers/auth-instance";
import { selectCookieGetter } from "../providers/auth-session";
import { THEME_COLORS } from "../providers/theme";

// Root composition: theme is token-driven (global.css + THEME_*), auth
// session flows from SecureStore into tRPC headers via the stored cookie.
const origin = getApiOrigin();
const queryClient = createQueryClient();
const trpcClient = createAuthenticatedTrpcClient({
  origin,
  getCookie: selectCookieGetter(Platform.OS, () => authClient.getCookie()),
});

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
      <StatusBar backgroundColor={THEME_COLORS.paper} barStyle="dark-content" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(host)" />
        <Stack.Screen name="(cleaner)" />
      </Stack>
    </SparklProviders>
  );
}
