import { describe, expect, it, vi } from "vitest";
import {
  isSessionExpiredError,
  readSharedSession,
  selectCookieGetter,
  sessionHeaders,
  trackSessionOwner,
  waitForSessionEmail,
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

describe("waitForSessionEmail", () => {
  it("resolves immediately when the session already matches", async () => {
    const data = {
      user: { email: "demo-cleaner@example.com", role: "cleaner" },
    };
    const getSession = async () => ({ data });
    const sleep = async () => {
      throw new Error("should not sleep");
    };
    await expect(
      waitForSessionEmail(getSession, "demo-cleaner@example.com", { sleep }),
    ).resolves.toBe(data);
  });

  it("matches case-insensitively", async () => {
    const data = {
      user: { email: "Demo-Cleaner@Example.com", role: "cleaner" },
    };
    const found = await waitForSessionEmail(
      async () => ({ data }),
      "demo-cleaner@example.com",
      { sleep: async () => {} },
    );
    expect(found).toBe(data);
  });

  it("retries past a stale session until the new user appears", async () => {
    const stale = { user: { email: "demo-host@example.com", role: "host" } };
    const fresh = {
      user: { email: "demo-cleaner@example.com", role: "cleaner" },
    };
    const snapshots = [stale, null, fresh];
    let calls = 0;
    const sleeps: number[] = [];
    const found = await waitForSessionEmail(
      async () => ({ data: snapshots[calls++] ?? null }),
      "demo-cleaner@example.com",
      { attempts: 5, delayMs: 150, sleep: async (ms) => void sleeps.push(ms) },
    );
    expect(found).toBe(fresh);
    expect(calls).toBe(3);
    expect(sleeps).toEqual([150, 150]);
  });

  it("gives up after the bounded attempts", async () => {
    let calls = 0;
    const found = await waitForSessionEmail(
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

describe("readSharedSession", () => {
  // 03 A1: the sign-in poll must refresh the store the layouts read, not
  // a side fetch, or the second sign-in in one tab navigates while the
  // store still says signed out.
  function fakeStore(next: { user: { email: string } } | null) {
    const state: {
      data: { user: { email: string } } | null;
      refetch: () => Promise<void>;
    } = {
      data: null,
      refetch: vi.fn(async () => {
        state.data = next;
      }),
    };
    return { state, store: { get: () => state } };
  }

  it("refetches the shared store before reading it", async () => {
    const { state, store } = fakeStore({ user: { email: "c@example.com" } });
    const read = readSharedSession(store);
    expect(await read()).toEqual({
      data: { user: { email: "c@example.com" } },
    });
    expect(state.refetch).toHaveBeenCalledTimes(1);
  });

  it("drives waitForSessionEmail until the store holds the new account", async () => {
    const { store } = fakeStore({ user: { email: "cleaner@example.com" } });
    const found = await waitForSessionEmail(
      readSharedSession(store),
      "cleaner@example.com",
      { sleep: async () => undefined },
    );
    expect(found?.user.email).toBe("cleaner@example.com");
    expect(store.get().data?.user.email).toBe("cleaner@example.com");
  });
});

describe("trackSessionOwner", () => {
  const signedIn = (id: string) => ({
    data: { user: { id } },
    isPending: false,
  });
  const signedOut = { data: null, isPending: false };
  const pending = { data: null, isPending: true };

  it("records the first settled owner without resetting", () => {
    const onChange = vi.fn();
    const track = trackSessionOwner(onChange);
    track(pending);
    track(signedIn("host-1"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores refetches of the same account", () => {
    const onChange = vi.fn();
    const track = trackSessionOwner(onChange);
    track(signedIn("host-1"));
    track(signedIn("host-1"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("resets on sign-out and again when another account signs in", () => {
    const onChange = vi.fn();
    const track = trackSessionOwner(onChange);
    track(signedIn("host-1"));
    track(signedOut);
    track(pending);
    track(signedIn("cleaner-1"));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("resets when one account replaces another directly", () => {
    const onChange = vi.fn();
    const track = trackSessionOwner(onChange);
    track(signedIn("host-1"));
    track(signedIn("cleaner-1"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
