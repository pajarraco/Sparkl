import { Redirect } from "expo-router";
import { parseAppRole } from "../providers/auth";
import { authClient } from "../providers/auth-instance";
import { getInitialRoute } from "../providers/auth-navigation";

// Entry route: signed-out users land on welcome, signed-in users on
// their role home (the deep-link guard for the tab groups lives in the
// group layouts).
export default function Index() {
  const session = authClient.useSession();
  if (session.isPending) return null;
  const role = parseAppRole(
    (session.data as { user?: { role?: unknown } } | null)?.user?.role,
  );
  return <Redirect href={getInitialRoute(role)} />;
}
