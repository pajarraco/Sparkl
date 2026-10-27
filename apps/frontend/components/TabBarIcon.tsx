import { Feather } from "@expo/vector-icons";
import type { TabIconName } from "../providers/tabs.js";

// Decorative tab glyphs (text labels carry the accessible name, so icons
// stay hidden from screen readers). Sizes follow the 4pt grid; the
// prominent Post tab renders larger via the size prop.

export interface TabBarIconProps {
  name: TabIconName;
  color: string;
  size?: number | undefined;
  prominent?: boolean | undefined;
}

export function TabBarIcon(props: TabBarIconProps) {
  return (
    <Feather
      accessible={false}
      color={props.color}
      name={props.name}
      size={props.prominent === true ? 30 : (props.size ?? 24)}
    />
  );
}
