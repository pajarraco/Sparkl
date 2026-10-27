import { Tabs } from "expo-router";
import { TabBarIcon } from "../../components/TabBarIcon";
import { getTabsForRole } from "../../providers/tabs";
import { THEME_COLORS } from "../../providers/theme";

// Host tab shell (design.md Navigation): My Jobs, prominent Post, Messages,
// Profile. Real tab content lands in tasks 6–7; the screens below render
// the designed empty states until then.
const tabs = getTabsForRole("host");

export default function HostTabsLayout() {
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
      <Tabs.Screen name="chat/[jobId]" options={{ href: null }} />
      <Tabs.Screen name="review/[jobId]" options={{ href: null }} />
    </Tabs>
  );
}
