import type { AppRole } from "./auth";

// Auth entry routing. Signed-out users land on welcome; signed-in users
// land on their role home (host jobs, cleaner board). Session-aware
// gating of deep links lands with the session provider.

export function getHomeRouteForRole(role: AppRole): string {
  return role === "host" ? "/host/my-jobs" : "/(cleaner)/board";
}

export function getInitialRoute(role: AppRole | null): string {
  if (role === null) return "/(auth)/welcome";
  return getHomeRouteForRole(role);
}

// Group guard: a signed-in user who lands in the other role's group (an
// old bookmark, a shared link) goes to their own home. Unknown roles stay
// put; the screens' own queries handle them.
export function redirectForGroup(
  group: AppRole,
  role: AppRole | null,
): string | null {
  if (role === null || role === group) return null;
  return getHomeRouteForRole(role);
}
