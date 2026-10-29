import { Redirect, Stack } from "expo-router";
import { parseAppRole } from "../../providers/auth";
import { authClient } from "../../providers/auth-instance";
import { redirectForGroup } from "../../providers/auth-navigation";

// Cleaner group shell: the tab screens live in (tabs); job detail,
// chat thread and review push onto this Stack. Detail screens used to
// be hidden tab screens (href: null), which web could not resolve —
// taps silently went nowhere. On a Stack every route is addressable on
// all platforms. Groups stay out of URLs, so /board, /job/:id and the
// rest are unchanged.
export default function CleanerGroupLayout() {
  // Logged-out deep links bounce to welcome (E2E navigation suite), and
  // the other role is sent home; the root index handles the signed-in
  // entry.
  const session = authClient.useSession();
  if (session.isPending) return null;
  if (!session.data) return <Redirect href="/(auth)/welcome" />;
  const elsewhere = redirectForGroup(
    "cleaner",
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
