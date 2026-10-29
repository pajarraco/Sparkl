import { describe, expect, it } from "vitest";
import { getStrings } from "./i18n";
import { getTabsForRole } from "./tabs";

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
