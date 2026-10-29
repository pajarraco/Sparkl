import { Redirect, Stack, usePathname } from "expo-router";
import { parseAppRole } from "../../providers/auth";
import { authClient } from "../../providers/auth-instance";
import { routeForRole } from "../../providers/auth-navigation";

// Cleaner group shell: everything lives in (tabs). Job detail, chat
// and review are shared routes inside each tab's own Stack (see the
// tab-stack layout), so they keep the tab bar visible (03 A2). Groups stay
// out of URLs, so /board, /job/:id and the rest are unchanged.
export default function CleanerGroupLayout() {
  // Logged-out deep links bounce to welcome (E2E navigation suite);
  // the root index handles the signed-in entry.
  const session = authClient.useSession();
  const pathname = usePathname();
  if (session.isPending) return null;
  if (!session.data) return <Redirect href="/(auth)/welcome" />;
  // A host who lands here (a reload or deep link on a URL both groups
  // share resolves to (cleaner) first) goes to the same screen in their
  // own group.
  const role = parseAppRole(
    (session.data.user as { role?: unknown } | undefined)?.role,
  );
  if (role === null) return <Redirect href="/(auth)/welcome" />;
  if (role !== "cleaner")
    return <Redirect href={routeForRole(role, pathname)} />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
