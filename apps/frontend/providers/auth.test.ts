import { describe, expect, it } from "vitest";
import { getSignOutUrl, parseAppRole } from "./auth.js";

describe("auth provider shell", () => {
  it("parses host/cleaner roles and rejects the rest", () => {
    expect(parseAppRole("host")).toBe("host");
    expect(parseAppRole("cleaner")).toBe("cleaner");
    expect(parseAppRole("admin")).toBeNull();
    expect(parseAppRole(undefined)).toBeNull();
  });

  it("points sign-out at the Better Auth handler", () => {
    expect(getSignOutUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/api/auth/sign-out",
    );
  });
});
