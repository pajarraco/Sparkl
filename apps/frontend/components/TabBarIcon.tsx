import { Feather } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import type { TabIconName } from "../providers/tabs";

// Decorative tab glyphs (text labels carry the accessible name, so icons
// stay hidden from screen readers). Sizes follow the 4pt grid; the
// prominent Post tab renders larger via the size prop. Color is ColorValue
// (not string) because React Navigation 7 passes its own color value type.

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
