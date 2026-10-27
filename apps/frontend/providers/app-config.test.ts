import { describe, expect, it } from "vitest";
import {
  DEFAULT_API_ORIGIN,
  getApiOrigin,
  getAuthBaseUrl,
  getTrpcUrl,
  normalizeOrigin,
} from "./app-config.js";

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

  it("builds tRPC and auth URLs on the same origin", () => {
    expect(getTrpcUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/trpc",
    );
    expect(getAuthBaseUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/api/auth",
    );
  });
});
