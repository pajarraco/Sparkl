import { describe, expect, it } from "vitest";
import { formatMatchReasons } from "./match-reasons";

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
