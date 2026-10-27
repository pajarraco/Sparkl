import { Stack } from "expo-router";

// Auth stack: welcome, sign in, sign up with role pick. Screens render
// their own titles (design.md), so the native header stays hidden.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
