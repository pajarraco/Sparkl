import type { AppRole } from "./auth";
import { getStrings } from "./i18n";

// Role-based tab definitions (design.md Navigation). Titles come from the
// i18n package; routes match the expo-router group layouts in app/.
// Icons are Feather names rendered by components/TabBarIcon.tsx.

export type TabKey = "board" | "myJobs" | "post" | "messages" | "profile";

export type TabIconName =
  | "list"
  | "briefcase"
  | "plus-circle"
  | "message-circle"
  | "user";

export interface TabDef {
  key: TabKey;
  title: string;
  route: string;
  /**
   * Tabs.Screen name. Tabs with a detail stack are route groups, e.g.
   * "(my-jobs)"; job, chat and review push inside them (03 A2).
   */
  screen: string;
  icon: TabIconName;
  /** The center Post tab renders larger than its siblings. */
  prominent?: boolean | undefined;
}

export function getTabsForRole(role: AppRole): TabDef[] {
  const tabs = getStrings().tabs;
  if (role === "host") {
    return [
      {
        key: "myJobs",
        title: tabs.myJobs,
        route: "/(host)/my-jobs",
        screen: "(my-jobs)",
        icon: "briefcase",
      },
      {
        key: "post",
        title: tabs.post,
        route: "/(host)/post",
        screen: "post",
        icon: "plus-circle",
        prominent: true,
      },
      {
        key: "messages",
        title: tabs.messages,
        route: "/(host)/messages",
        screen: "(messages)",
        icon: "message-circle",
      },
      {
        key: "profile",
        title: tabs.profile,
        route: "/(host)/profile",
        screen: "profile",
        icon: "user",
      },
    ];
  }
  return [
    {
      key: "board",
      title: tabs.board,
      route: "/(cleaner)/board",
      screen: "(board)",
      icon: "list",
    },
    {
      key: "myJobs",
      title: tabs.myJobs,
      route: "/(cleaner)/my-jobs",
      screen: "(my-jobs)",
      icon: "briefcase",
    },
    {
      key: "messages",
      title: tabs.messages,
      route: "/(cleaner)/messages",
      screen: "(messages)",
      icon: "message-circle",
    },
    {
      key: "profile",
      title: tabs.profile,
      route: "/(cleaner)/profile",
      screen: "profile",
      icon: "user",
    },
  ];
}

function isStackGroup(screen: string): boolean {
  return screen.startsWith("(");
}

// Detail screens (job, chat, review) are shared routes inside every
// stacked tab, so a push names the tab group it belongs to: the one the
// user is in (segments[2], e.g. "(messages)"), or the role's first
// stacked tab when the push starts outside a stack. That keeps the detail
// in the tab it was opened from, with the tab bar still visible.
export function stackHref(
  role: AppRole,
  segments: readonly string[],
  path: string,
): string {
  const stacked = getTabsForRole(role).filter((tab) =>
    isStackGroup(tab.screen),
  );
  const current = stacked.find((tab) => tab.screen === segments[2]);
  const group = current?.screen ?? stacked[0]?.screen ?? "";
  return `/(${role})/(tabs)/${group}/${path}`;
}

// Where Back goes when a detail screen has no history (a deep link or a
// reload): the root of the tab it sits in.
export function tabRootHref(
  role: AppRole,
  segments: readonly string[],
): string {
  const tabs = getTabsForRole(role);
  const current = tabs.find((tab) => tab.screen === segments[2]);
  return current?.route ?? tabs[0]?.route ?? "/";
}
