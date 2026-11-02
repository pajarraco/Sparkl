import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";
import type { ColorValue } from "react-native";
import type { TabIconName } from "../providers/tabs";

// Decorative tab glyphs (text labels carry the accessible name, so icons
// stay hidden from screen readers). Sizes follow the 4pt grid; the
// prominent Post tab renders larger via the size prop. Color is ColorValue
// (not string) because React Navigation 7 passes its own color value type.

// Shared tab bar sizing for both role shells (design.md Components: 44pt
// minimum touch targets). React Navigation's default bar height is a
// fixed constant that doesn't grow with tabBarItemStyle padding, so on
// narrow phones the icon + label (especially the prominent 30pt icon)
// overflowed it and got clipped. A custom tabBarStyle.height bypasses the
// library's own safe-area inset addition (confirmed in its
// getTabBarHeight source), so the iOS branch below adds a hand-rolled
// home-indicator allowance instead of pulling in
// react-native-safe-area-context for this alone.
export const TAB_BAR_SCREEN_OPTIONS = {
  tabBarStyle: {
    height: Platform.OS === "ios" ? 88 : 64,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 30 : 10,
  },
  tabBarItemStyle: {
    paddingVertical: 2,
  },
  tabBarIconStyle: {
    marginBottom: 2,
  },
} as const;

export interface TabBarIconProps {
  name: TabIconName;
  color: ColorValue;
  size?: number | undefined;
  prominent?: boolean | undefined;
}

export function TabBarIcon(props: TabBarIconProps) {
  // Both tab shells set tabBarActive/InactiveTintColor to theme hex
  // strings, so navigation always hands us a string at runtime; the
  // union only carries number for Android resource IDs, which tabs never
  // use. Feather's color prop excludes that number case, hence the cast.
  const featherColor = props.color as string;
  return (
    <Feather
      accessible={false}
      color={featherColor}
      name={props.name}
      size={props.prominent === true ? 30 : (props.size ?? 24)}
    />
  );
}
