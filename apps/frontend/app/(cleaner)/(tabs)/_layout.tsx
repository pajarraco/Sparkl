import { Tabs, router } from "expo-router";
import { Platform } from "react-native";
import { TabBarIcon } from "../../../components/TabBarIcon";
import { getTabsForRole } from "../../../providers/tabs";
import { THEME_COLORS } from "../../../providers/theme";

// Cleaner tab shell (design.md Navigation): Board, My Jobs, Messages,
// Profile. Board, My Jobs and job detail are real; Messages and Profile
// still render their designed empty states until their slices land.
const tabs = getTabsForRole("cleaner");

export default function CleanerTabsLayout() {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME_COLORS.indigo,
        tabBarInactiveTintColor: THEME_COLORS.inkMute,
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.key}
          name={tab.screen}
          listeners={({ navigation }) => ({
            // Web-only: tapping another tab pushes a real history entry
            // (E2E navigation suite) so the browser back button walks back
            // through tabs. One router.push owns both the focus and the
            // history write: the earlier hand-rolled pushState + navigate
            // pair raced (navigate pushed a duplicate of the just-pushed
            // entry), so goBack stayed on the same tab. Tapping the active
            // tab keeps the default, which pops its stack to the root
            // (design.md Navigation). Native is untouched (hardware back
            // is governed by backBehavior).
            tabPress: (event) => {
              if (Platform.OS !== "web" || navigation.isFocused()) return;
              event.preventDefault();
              router.push(tab.route);
            },
          })}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon
                color={color}
                name={tab.icon}
                prominent={tab.prominent}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
