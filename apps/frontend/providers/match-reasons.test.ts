import type { UserRatingSummary } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import { suggestionTrustLine } from "./job-detail";
import { detailTrustLine, formatMatchReasons } from "./match-reasons";

describe("formatMatchReasons", () => {
  it("joins translated reasons and omits empty lists", () => {
    expect(formatMatchReasons(["rating", "distance"])).toBe(
      "Highly rated · Nearby",
    );
    expect(formatMatchReasons([])).toBeNull();
  });
  it("translates the usual-cleaner pin", () => {
    expect(formatMatchReasons(["usual", "rating"])).toBe(
      "Your usual cleaner · Highly rated",
    );
  });
});

describe("detailTrustLine", () => {
  const ratings: Record<string, UserRatingSummary> = {
    "host-1": { avgRating: 4.8, completedJobCount: 12 },
  };
  it("formats the counterpart trust row exactly like the lists", () => {
    expect(detailTrustLine(ratings, "host-1", suggestionTrustLine)).toBe(
      "4.8 · 12 jobs completed",
    );
  });
  it("omits the line without a counterpart or rating data", () => {
    expect(detailTrustLine(ratings, null, suggestionTrustLine)).toBeNull();
    expect(detailTrustLine(ratings, "ghost", suggestionTrustLine)).toBeNull();
    expect(detailTrustLine({}, "host-1", suggestionTrustLine)).toBeNull();
  });
});
