import { describe, expect, it } from "vitest";
import {
  getHomeRouteForRole,
  getInitialRoute,
  routeForRole,
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

describe("routeForRole (03 A2)", () => {
  // Detail URLs exist in both role groups and Expo resolves a reload or
  // deep link to the first one alphabetically ((cleaner)), so the group
  // layouts send a user in the wrong group to the same screen in theirs.
  it("keeps a detail screen, inside the role's first stacked tab", () => {
    expect(routeForRole("host", "/job/j1")).toBe(
      "/host/(tabs)/(my-jobs)/job/j1",
    );
    expect(routeForRole("host", "/chat/j1")).toBe(
      "/host/(tabs)/(my-jobs)/chat/j1",
    );
    expect(routeForRole("cleaner", "/review/j1")).toBe(
      "/(cleaner)/(tabs)/(board)/review/j1",
    );
  });

  it("keeps a tab both roles have", () => {
    expect(routeForRole("host", "/messages")).toBe("/host/messages");
    expect(routeForRole("cleaner", "/profile")).toBe("/(cleaner)/profile");
  });

  it("sends a tab the role does not have to the role's home", () => {
    expect(routeForRole("host", "/board")).toBe("/host/my-jobs");
    expect(routeForRole("cleaner", "/post")).toBe("/(cleaner)/board");
    expect(routeForRole("cleaner", "/")).toBe("/(cleaner)/board");
  });
});
