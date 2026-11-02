import { Stack } from "expo-router";

// Host Properties tab stack (03 E): list is the root, add/edit pushes
// inside it so the tab bar stays visible and Back returns to the list.
export const unstable_settings = {
  properties: { initialRouteName: "properties" },
};

export default function PropertiesStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
