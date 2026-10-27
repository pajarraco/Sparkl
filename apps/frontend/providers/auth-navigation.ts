import type { AppRole } from "./auth.js";

// Auth entry routing. Signed-out users land on welcome; signed-in users
// land on their role home (host jobs, cleaner board). Session-aware
// gating of deep links lands with the session provider.

export function getHomeRouteForRole(role: AppRole): string {
  return role === "host" ? "/(host)/my-jobs" : "/(cleaner)/board";
}

export function getInitialRoute(role: AppRole | null): string {
  if (role === null) return "/(auth)/welcome";
  return getHomeRouteForRole(role);
}
