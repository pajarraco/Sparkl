import { Tabs } from "expo-router";
import { TabBarIcon } from "../../components/TabBarIcon";
import { getTabsForRole } from "../../providers/tabs";
import { THEME_COLORS } from "../../providers/theme";

// Cleaner tab shell (design.md Navigation): Board, My Jobs, Messages,
// Profile. Board, My Jobs and job detail are real; Messages and Profile
// still render their designed empty states until their slices land.
const tabs = getTabsForRole("cleaner");

export default function CleanerTabsLayout() {
  return (
    <Tabs
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
      <Tabs.Screen name="job/[id]" options={{ href: null }} />
    </Tabs>
  );
}
