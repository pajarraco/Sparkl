import { describe, expect, it, vi } from "vitest";
import { selectCookieGetter, sessionHeaders } from "./auth-session";

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
