import { Redirect } from "expo-router";

// Entry route. Session-aware gating (signed-in users skip welcome) lands
// with the session provider; until then everyone starts at welcome.
export default function Index() {
  return <Redirect href="/(auth)/welcome" />;
}
