import { describe, expect, it } from "vitest";
import {
  getHomeRouteForRole,
  getInitialRoute,
  redirectForGroup,
} from "./auth-navigation";

describe("auth navigation", () => {
  it("sends signed-out users to welcome", () => {
    expect(getInitialRoute(null)).toBe("/(auth)/welcome");
  });

  it("sends hosts to their jobs and cleaners to the board", () => {
    expect(getHomeRouteForRole("host")).toBe("/host/my-jobs");
    expect(getHomeRouteForRole("cleaner")).toBe("/(cleaner)/board");
    expect(getInitialRoute("host")).toBe("/host/my-jobs");
    expect(getInitialRoute("cleaner")).toBe("/(cleaner)/board");
  });
});

describe("redirectForGroup", () => {
  it("keeps each role in its own group", () => {
    expect(redirectForGroup("host", "host")).toBeNull();
    expect(redirectForGroup("cleaner", "cleaner")).toBeNull();
  });

  it("sends a role in the other group to its own home", () => {
    expect(redirectForGroup("cleaner", "host")).toBe("/host/my-jobs");
    expect(redirectForGroup("host", "cleaner")).toBe("/(cleaner)/board");
  });

  it("leaves unknown roles where they are", () => {
    expect(redirectForGroup("host", null)).toBeNull();
    expect(redirectForGroup("cleaner", null)).toBeNull();
  });
});
