import { describe, expect, it } from "vitest";
import { getApiOrigin } from "./app-config";
import {
  createTrpcClient,
  getTrpcClientUrl,
  isSubscriptionOperation,
} from "./trpc-client";

describe("trpc-client", () => {
  it("targets the /trpc prefix on the configured origin", () => {
    expect(getTrpcClientUrl(getApiOrigin())).toBe("http://localhost:3000/trpc");
    expect(getTrpcClientUrl("http://192.168.1.5:3000///")).toBe(
      "http://192.168.1.5:3000/trpc",
    );
  });

  it("routes only subscriptions to the SSE link", () => {
    expect(isSubscriptionOperation({ type: "subscription" })).toBe(true);
    expect(isSubscriptionOperation({ type: "query" })).toBe(false);
    expect(isSubscriptionOperation({ type: "mutation" })).toBe(false);
  });

  it("creates a client without network side effects", () => {
    expect(createTrpcClient({ origin: getApiOrigin() })).toBeDefined();
  });
});
