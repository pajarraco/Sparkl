import { useRouter, useSegments } from "expo-router";
import type { AppRole } from "../providers/auth";
import { getStrings } from "../providers/i18n";
import { tabRootHref } from "../providers/tabs";
import { Screen, type ScreenProps } from "./Screen";

// Screen for job, chat and review (03 A2): they push inside the tab they
// were opened from, so the tab bar stays visible, and they get a Back
// button. With history Back pops the tab's stack; on a deep link or after
// a reload it returns to the root of the tab instead of doing nothing.

export interface DetailScreenProps extends ScreenProps {
  userRole: AppRole;
}

export function DetailScreen(props: DetailScreenProps) {
  const { userRole, ...screen } = props;
  const router = useRouter();
  const segments = useSegments();
  function handleBack(): void {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(tabRootHref(userRole, segments));
  }
  return (
    <Screen
      {...screen}
      backLabel={getStrings().navigation.back}
      onBack={handleBack}
    />
  );
}
