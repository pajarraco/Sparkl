import { describe, expect, it } from "vitest";
import {
  DEFAULT_API_ORIGIN,
  getApiOrigin,
  getAuthBaseUrl,
  getPageHostname,
  getTrpcUrl,
  normalizeOrigin,
} from "./app-config";

describe("app-config", () => {
  it("defaults to the local API origin", () => {
    expect(getApiOrigin()).toBe(DEFAULT_API_ORIGIN);
    expect(getApiOrigin({})).toBe(DEFAULT_API_ORIGIN);
  });

  it("prefers EXPO_PUBLIC_API_URL and trims slashes", () => {
    expect(
      getApiOrigin({ EXPO_PUBLIC_API_URL: "http://192.168.1.5:3000///" }),
    ).toBe("http://192.168.1.5:3000");
    expect(normalizeOrigin("http://x:3000/")).toBe("http://x:3000");
  });

  it("uses the page hostname on web so cookies stay same-site", () => {
    expect(
      getApiOrigin(
        { EXPO_PUBLIC_API_URL: "http://192.168.0.13:3000" },
        "localhost",
      ),
    ).toBe("http://localhost:3000");
    expect(getApiOrigin(undefined, "192.168.0.13")).toBe(
      "http://192.168.0.13:3000",
    );
  });

  it("ignores a blank page hostname", () => {
    expect(
      getApiOrigin({ EXPO_PUBLIC_API_URL: "http://192.168.0.13:3000" }, "  "),
    ).toBe("http://192.168.0.13:3000");
  });

  it("reads no page hostname on native", () => {
    expect(getPageHostname()).toBeUndefined();
  });

  it("builds tRPC and auth URLs on the same origin", () => {
    expect(getTrpcUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/trpc",
    );
    expect(getAuthBaseUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/api/auth",
    );
  });
});
