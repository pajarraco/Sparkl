import type { MatchSignal, UserRatingSummary } from "@sparkl/shared";
import { getStrings } from "./i18n";

// Pure formatter for deterministic match reasons (02 P4). The backend
// picks the keys with the active weights; here we only translate them
// via i18n and join with "·". Empty list renders nothing.
export function formatMatchReasons(reasons: MatchSignal[]): string | null {
  if (reasons.length === 0) return null;
  const strings = getStrings().matchReasons;
  return reasons.map((reason) => strings[reason]).join(" · ");
}

// Counterpart trust line for job detail screens: the same ★ rating +
// completed-job count the lists show, from one batched ratingsFor lookup
// (never one query per card — here, one query per screen). Returns null
// when the counterpart has no rating data yet, so the screen omits the
// line exactly like the cards do.
export function detailTrustLine(
  ratings: Record<string, UserRatingSummary>,
  userId: string | null,
  trustLine: (profile: UserRatingSummary) => string,
): string | null {
  if (userId === null) return null;
  const summary = ratings[userId];
  if (summary === undefined) return null;
  return trustLine(summary);
}
