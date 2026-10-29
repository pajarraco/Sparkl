import { Tabs, router, usePathname } from "expo-router";
import { Platform } from "react-native";
import { TabBarIcon } from "../../../components/TabBarIcon";
import { getTabsForRole } from "../../../providers/tabs";
import { THEME_COLORS } from "../../../providers/theme";

// Host tab shell (design.md Navigation): My Jobs, prominent Post,
// Messages, Profile. Real tab content lands in tasks 6–7; the screens
// below render the designed empty states until then.
const tabs = getTabsForRole("host");

export default function HostTabsLayout() {
  const pathname = usePathname();
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
          name={tab.route.split("/").pop() ?? tab.key}
          listeners={{
            // Web-only: every tab tap pushes a real history entry (E2E
            // navigation suite) so the browser back button walks back
            // through tabs. One router.push owns both the focus and the
            // history write: the earlier hand-rolled pushState + navigate
            // pair raced (navigate pushed a duplicate of the just-pushed
            // entry), so goBack stayed on the same tab. Native is
            // untouched (hardware back is governed by backBehavior).
            tabPress: (event) => {
              if (Platform.OS !== "web") return;
              event.preventDefault();
              const target = tab.route.split("/").pop();
              const current = pathname.split("/").pop();
              if (target === current || target === undefined) return;
              router.push(tab.route);
            },
          }}
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
