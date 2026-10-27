import { describe, expect, it } from "vitest";
import { sessionHeaders } from "./auth-session.js";

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
