import { Redirect, Stack, usePathname } from "expo-router";
import { parseAppRole } from "../../providers/auth";
import { authClient } from "../../providers/auth-instance";
import { routeForRole } from "../../providers/auth-navigation";

// Host group shell: everything lives in (tabs). Job detail, chat
// and review are shared routes inside each tab's own Stack (see the
// tab-stack layout), so they keep the tab bar visible (03 A2). Host
// screens live under /host/..., so they never share a URL with the
// cleaner's /my-jobs, /job/:id and the rest.
export default function HostGroupLayout() {
  // Logged-out deep links bounce to welcome (E2E navigation suite);
  // the root index handles the signed-in entry.
  const session = authClient.useSession();
  const pathname = usePathname();
  if (session.isPending) return null;
  if (!session.data) return <Redirect href="/(auth)/welcome" />;
  // A cleaner who lands here (a reload or deep link on a URL both groups
  // share resolves to (cleaner) first) goes to the same screen in their
  // own group.
  const role = parseAppRole(
    (session.data.user as { role?: unknown } | undefined)?.role,
  );
  if (role === null) return <Redirect href="/(auth)/welcome" />;
  if (role !== "host") return <Redirect href={routeForRole(role, pathname)} />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
