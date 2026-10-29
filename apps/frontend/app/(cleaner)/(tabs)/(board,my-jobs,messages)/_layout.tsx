import { Stack } from "expo-router";

// Cleaner tab stacks (03 A2): Board, My Jobs and Messages each get their
// own Stack from this shared-routes layout, so job detail, chat and review
// push inside the tab they were opened from and the tab bar stays
// visible. initialRouteName puts the tab's list under a deep-linked
// detail, so Back has somewhere to go.
export const unstable_settings = {
  board: { initialRouteName: "board" },
  "my-jobs": { initialRouteName: "my-jobs" },
  messages: { initialRouteName: "messages" },
};

export default function CleanerTabStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
