import type { AppRole } from "./auth";
import { getTabsForRole, roleSegment, stackHref } from "./tabs";

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

const DETAIL_ROUTES = new Set(["job", "chat", "review"]);

// Where a signed-in user belongs when they land in the other role's group
// (03 A2). /job/:id, /chat/:jobId, /review/:jobId, /my-jobs, /messages
// and /profile exist in both groups, and Expo resolves a reload or deep
// link to the first one alphabetically, so a host could end up on the
// cleaner's screens. Detail screens keep their path inside the role's
// first stacked tab; tabs the role also has keep their path; anything
// else goes to the role's home.
export function routeForRole(role: AppRole, pathname: string): string {
  const parts = pathname.split("/").filter((part) => part !== "");
  const first = parts[0];
  if (first !== undefined && DETAIL_ROUTES.has(first)) {
    return stackHref(role, [], parts.join("/"));
  }
  const tab = getTabsForRole(role).find(
    (candidate) => candidate.route === `/${roleSegment(role)}/${first ?? ""}`,
  );
  return tab?.route ?? getHomeRouteForRole(role);
}
