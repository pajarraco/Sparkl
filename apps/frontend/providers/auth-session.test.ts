import { describe, expect, it, vi } from "vitest";
import {
  isSessionExpiredError,
  selectCookieGetter,
  sessionHeaders,
  waitForSessionUser,
} from "./auth-session";

describe("session headers", () => {
  it("sends the stored session cookie", async () => {
    const headers = sessionHeaders(async () => "better-auth.session_token=abc");
    expect(await headers()).toEqual({
      cookie: "better-auth.session_token=abc",
    });
  });

  it("sends no cookie header when signed out", async () => {
    const headers = sessionHeaders(async () => "");
    expect(await headers()).toEqual({});
  });
});

describe("selectCookieGetter", () => {
  it("returns an empty cookie on web without touching SecureStore", async () => {
    const delegate = vi.fn(async () => {
      throw new Error("SecureStore is empty on web");
    });
    const getCookie = selectCookieGetter("web", delegate);
    expect(await getCookie()).toBe("");
    expect(delegate).not.toHaveBeenCalled();
  });

  it("delegates to SecureStore on native", async () => {
    const getCookie = selectCookieGetter(
      "ios",
      async () => "better-auth.session_token=abc",
    );
    expect(await getCookie()).toBe("better-auth.session_token=abc");
  });
});

describe("waitForSessionUser", () => {
  it("resolves immediately when the session already matches", async () => {
    const user = { email: "demo-cleaner@example.com", role: "cleaner" };
    const getSession = async () => ({ data: { user } });
    const sleep = async () => {
      throw new Error("should not sleep");
    };
    await expect(
      waitForSessionUser(getSession, "demo-cleaner@example.com", { sleep }),
    ).resolves.toBe(user);
  });

  it("matches case-insensitively", async () => {
    const user = { email: "Demo-Cleaner@Example.com", role: "cleaner" };
    const found = await waitForSessionUser(
      async () => ({ data: { user } }),
      "demo-cleaner@example.com",
      { sleep: async () => {} },
    );
    expect(found).toBe(user);
  });

  it("retries past a stale session until the new user appears", async () => {
    const stale = { email: "demo-host@example.com", role: "host" };
    const fresh = { email: "demo-cleaner@example.com", role: "cleaner" };
    const snapshots = [{ user: stale }, { data: null }, { user: fresh }];
    let calls = 0;
    const sleeps: number[] = [];
    const found = await waitForSessionUser(
      async () => ({ data: snapshots[calls++] }) as never,
      "demo-cleaner@example.com",
      { attempts: 5, delayMs: 150, sleep: async (ms) => void sleeps.push(ms) },
    );
    expect(found).toBe(fresh);
    expect(calls).toBe(3);
    expect(sleeps).toEqual([150, 150]);
  });

  it("gives up after the bounded attempts", async () => {
    let calls = 0;
    const found = await waitForSessionUser(
      async () => {
        calls++;
        return { data: null };
      },
      "demo-cleaner@example.com",
      { attempts: 3, delayMs: 10, sleep: async () => {} },
    );
    expect(found).toBeNull();
    expect(calls).toBe(3);
  });
});

describe("isSessionExpiredError", () => {
  it("matches tRPC UNAUTHORIZED", () => {
    expect(isSessionExpiredError({ data: { code: "UNAUTHORIZED" } })).toBe(
      true,
    );
  });

  it("ignores other failures", () => {
    expect(isSessionExpiredError({ data: { code: "CONFLICT" } })).toBe(false);
    expect(isSessionExpiredError(new Error("boom"))).toBe(false);
    expect(isSessionExpiredError(null)).toBe(false);
  });
});
