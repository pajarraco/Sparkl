import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { getApiOrigin } from "../providers/app-config";
import {
  SparklProviders,
  createAuthenticatedTrpcClient,
  createQueryClient,
} from "../providers/app-providers";
import { authClient } from "../providers/auth-instance";
import { THEME_COLORS } from "../providers/theme";

// Root composition: theme is token-driven (global.css + THEME_*), auth
// session flows from SecureStore into tRPC headers via the stored cookie.
const origin = getApiOrigin();
const queryClient = createQueryClient();
const trpcClient = createAuthenticatedTrpcClient({
  origin,
  getCookie: () => authClient.getCookie(),
});

export default function RootLayout() {
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
