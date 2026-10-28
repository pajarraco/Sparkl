import { Redirect, Tabs, router, usePathname } from "expo-router";
import { Platform } from "react-native";
import { TabBarIcon } from "../../components/TabBarIcon";
import { authClient } from "../../providers/auth-instance";
import { getTabsForRole } from "../../providers/tabs";
import { THEME_COLORS } from "../../providers/theme";

// Host tab shell (design.md Navigation): My Jobs, prominent Post, Messages,
// Profile. Real tab content lands in tasks 6–7; the screens below render
// the designed empty states until then.
const tabs = getTabsForRole("host");

export default function HostTabsLayout() {
  // Logged-out deep links bounce to welcome (E2E navigation suite);
  // the root index handles the signed-in entry.
  const session = authClient.useSession();
  const pathname = usePathname();
  if (session.isPending) return null;
  if (!session.data) return <Redirect href="/(auth)/welcome" />;
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
            // through tabs. Default focusing and router.push both
            // collapse a return-to-visited-tab into a replace, popping
            // the very entry back needs. So the entry is pushed by hand
            // (public path, no group syntax) BEFORE focusing: the
            // focus's own URL write then lands on the identical URL and
            // is a harmless no-op. Browser-back restores tab state
            // through the router's popstate linking. Native is untouched
            // (hardware back is governed by backBehavior).
            tabPress: (event) => {
              if (Platform.OS !== "web") return;
              event.preventDefault();
              const target = tab.route.split("/").pop();
              const current = pathname.split("/").pop();
              if (target === current || target === undefined) return;
              (
                globalThis as unknown as {
                  history: {
                    pushState(state: unknown, title: string, url: string): void;
                  };
                }
              ).history.pushState(null, "", `/${target}`);
              router.navigate(tab.route);
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
      <Tabs.Screen name="job/[id]" options={{ href: null }} />
      <Tabs.Screen name="chat/[jobId]" options={{ href: null }} />
      <Tabs.Screen name="review/[jobId]" options={{ href: null }} />
    </Tabs>
  );
}
