import { describe, expect, it } from "vitest";
import { getHomeRouteForRole, getInitialRoute } from "./auth-navigation";

describe("auth navigation", () => {
  it("sends signed-out users to welcome", () => {
    expect(getInitialRoute(null)).toBe("/(auth)/welcome");
  });

  it("sends hosts to their jobs and cleaners to the board", () => {
    expect(getHomeRouteForRole("host")).toBe("/(host)/my-jobs");
    expect(getHomeRouteForRole("cleaner")).toBe("/(cleaner)/board");
    expect(getInitialRoute("host")).toBe("/(host)/my-jobs");
    expect(getInitialRoute("cleaner")).toBe("/(cleaner)/board");
  });
});
