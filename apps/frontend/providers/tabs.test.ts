import { describe, expect, it } from "vitest";
import { getStrings } from "./i18n";
import { getTabsForRole, stackHref, tabRootHref } from "./tabs";

const tabs = getStrings().tabs;

describe("role tabs", () => {
  it("gives hosts My Jobs, a prominent Post tab, Messages, Profile", () => {
    const defs = getTabsForRole("host");
    expect(defs.map((d) => d.key)).toEqual([
      "myJobs",
      "post",
      "messages",
      "profile",
    ]);
    expect(defs.map((d) => d.title)).toEqual([
      tabs.myJobs,
      tabs.post,
      tabs.messages,
      tabs.profile,
    ]);
    expect(defs.filter((d) => d.prominent).map((d) => d.key)).toEqual(["post"]);
    for (const def of defs) {
      expect(def.route.startsWith("/host/")).toBe(true);
    }
  });

  it("gives cleaners Board first and no Post tab", () => {
    const defs = getTabsForRole("cleaner");
    expect(defs.map((d) => d.key)).toEqual([
      "board",
      "myJobs",
      "messages",
      "profile",
    ]);
    expect(defs.some((d) => d.prominent)).toBe(false);
    for (const def of defs) {
      expect(def.route.startsWith("/(cleaner)/")).toBe(true);
    }
  });

  it("keeps every route distinct", () => {
    const routes = [
      ...getTabsForRole("host"),
      ...getTabsForRole("cleaner"),
    ].map((d) => d.route);
    expect(new Set(routes).size).toBe(routes.length);
  });
});

describe("tab stacks (03 A2)", () => {
  it("names a group screen for every tab with a detail stack", () => {
    expect(getTabsForRole("host").map((d) => d.screen)).toEqual([
      "(my-jobs)",
      "post",
      "(messages)",
      "profile",
    ]);
    expect(getTabsForRole("cleaner").map((d) => d.screen)).toEqual([
      "(board)",
      "(my-jobs)",
      "(messages)",
      "profile",
    ]);
  });

  it("pushes a detail screen into the tab the user is in", () => {
    expect(
      stackHref(
        "host",
        ["host", "(tabs)", "(messages)", "messages"],
        "chat/j1",
      ),
    ).toBe("/host/(tabs)/(messages)/chat/j1");
    expect(
      stackHref(
        "cleaner",
        ["(cleaner)", "(tabs)", "(my-jobs)", "job", "[id]"],
        "chat/j1",
      ),
    ).toBe("/(cleaner)/(tabs)/(my-jobs)/chat/j1");
  });

  it("falls back to the role's first stacked tab outside a stack", () => {
    expect(stackHref("host", ["host", "(tabs)", "post"], "job/j1")).toBe(
      "/host/(tabs)/(my-jobs)/job/j1",
    );
    expect(stackHref("cleaner", [], "job/j1")).toBe(
      "/(cleaner)/(tabs)/(board)/job/j1",
    );
  });

  it("finds the tab root to return to when there is no history", () => {
    expect(
      tabRootHref("host", ["host", "(tabs)", "(messages)", "chat", "[jobId]"]),
    ).toBe("/host/messages");
    expect(
      tabRootHref("cleaner", ["(cleaner)", "(tabs)", "(board)", "job"]),
    ).toBe("/(cleaner)/board");
    expect(tabRootHref("host", [])).toBe("/host/my-jobs");
  });
});
