import { describe, expect, it } from "vitest";
import { userIdSchema, userSchema } from "./users";

const baseUser = {
  id: "1ullxuRzS50XrQvV9XgDJuswd5m6jxOS",
  role: "cleaner",
  name: "Casey Cleaner",
  photoUrl: null,
  serviceLat: 25.7617,
  serviceLng: -80.1918,
  serviceRadiusKm: 10,
  avgRating: null,
  completedJobCount: 0,
  createdAt: "2026-10-28T06:00:00Z",
  updatedAt: "2026-10-28T06:00:00Z",
} as const;

describe("userIdSchema", () => {
  it("accepts Better Auth opaque ids (not UUIDs)", () => {
    expect(userIdSchema.parse("1ullxuRzS50XrQvV9XgDJuswd5m6jxOS")).toBe(
      "1ullxuRzS50XrQvV9XgDJuswd5m6jxOS",
    );
  });

  it("rejects empty ids", () => {
    expect(() => userIdSchema.parse("")).toThrow();
  });
});

describe("userSchema", () => {
  it("accepts a Better Auth user row", () => {
    expect(userSchema.parse(baseUser).role).toBe("cleaner");
  });
});
