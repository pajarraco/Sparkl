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
        icon: "briefcase",
      },
      {
        key: "post",
        title: tabs.post,
        route: "/(host)/post",
        icon: "plus-circle",
        prominent: true,
      },
      {
        key: "messages",
        title: tabs.messages,
        route: "/(host)/messages",
        icon: "message-circle",
      },
      {
        key: "profile",
        title: tabs.profile,
        route: "/(host)/profile",
        icon: "user",
      },
    ];
  }
  return [
    {
      key: "board",
      title: tabs.board,
      route: "/(cleaner)/board",
      icon: "list",
    },
    {
      key: "myJobs",
      title: tabs.myJobs,
      route: "/(cleaner)/my-jobs",
      icon: "briefcase",
    },
    {
      key: "messages",
      title: tabs.messages,
      route: "/(cleaner)/messages",
      icon: "message-circle",
    },
    {
      key: "profile",
      title: tabs.profile,
      route: "/(cleaner)/profile",
      icon: "user",
    },
  ];
}
