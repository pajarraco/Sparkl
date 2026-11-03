import type { MatchSignal } from "@sparkl/shared";
import { getStrings } from "./i18n";

// Pure formatter for deterministic match reasons (02 P4). The backend
// picks the keys with the active weights; here we only translate them
// via i18n and join with "·". Empty list renders nothing.
export function formatMatchReasons(reasons: MatchSignal[]): string | null {
  if (reasons.length === 0) return null;
  const strings = getStrings().matchReasons;
  return reasons.map((reason) => strings[reason]).join(" · ");
}
