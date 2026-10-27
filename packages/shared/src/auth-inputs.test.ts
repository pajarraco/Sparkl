import { describe, expect, it } from "vitest";
import { signInInputSchema, signUpInputSchema } from "./auth-inputs";

function validSignUp() {
  return {
    name: "Ada Host",
    email: "ada@example.com",
    password: "sparkl123",
    role: "host",
  } as const;
}

describe("auth inputs", () => {
  it("accepts a complete sign-up", () => {
    expect(signUpInputSchema.safeParse(validSignUp()).success).toBe(true);
  });

  it("rejects a bad email, short password, blank name, or bad role", () => {
    expect(
      signUpInputSchema.safeParse({ ...validSignUp(), email: "not-an-email" })
        .success,
    ).toBe(false);
    expect(
      signUpInputSchema.safeParse({ ...validSignUp(), password: "short" })
        .success,
    ).toBe(false);
    expect(
      signUpInputSchema.safeParse({ ...validSignUp(), name: "   " }).success,
    ).toBe(false);
    expect(
      signUpInputSchema.safeParse({ ...validSignUp(), role: "admin" }).success,
    ).toBe(false);
  });

  it("accepts a valid sign-in and rejects a short password", () => {
    expect(
      signInInputSchema.safeParse({
        email: "ada@example.com",
        password: "sparkl123",
      }).success,
    ).toBe(true);
    expect(
      signInInputSchema.safeParse({ email: "ada@example.com", password: "" })
        .success,
    ).toBe(false);
  });
});
