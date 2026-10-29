import { Redirect, Stack } from "expo-router";
import { parseAppRole } from "../../providers/auth";
import { authClient } from "../../providers/auth-instance";
import { redirectForGroup } from "../../providers/auth-navigation";

// Host group shell: the tab screens live in (tabs); job detail, chat
// thread and review push onto this Stack. Detail screens used to be
// hidden tab screens (href: null), which web could not resolve — taps
// silently went nowhere. On a Stack every route is addressable on all
// platforms. This folder is a real segment, not a group, so every host
// URL is /host/... and never collides with the cleaner's /profile,
// /my-jobs, /job/:id and the rest (a direct load used to open the
// cleaner screen for hosts on web).
export default function HostGroupLayout() {
  // Logged-out deep links bounce to welcome (E2E navigation suite), and
  // the other role is sent home; the root index handles the signed-in
  // entry.
  const session = authClient.useSession();
  if (session.isPending) return null;
  if (!session.data) return <Redirect href="/(auth)/welcome" />;
  const elsewhere = redirectForGroup(
    "host",
    parseAppRole((session.data as { user?: { role?: unknown } }).user?.role),
  );
  if (elsewhere !== null) return <Redirect href={elsewhere} />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="job/[id]" />
      <Stack.Screen name="chat/[jobId]" />
      <Stack.Screen name="review/[jobId]" />
    </Stack>
  );
}
