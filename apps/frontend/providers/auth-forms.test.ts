import { describe, expect, it } from "vitest";
import { validateSignIn, validateSignUp } from "./auth-forms.js";
import { getStrings } from "./i18n.js";

const strings = getStrings().errors;

describe("auth forms", () => {
  it("accepts a valid sign-in", () => {
    const result = validateSignIn({
      email: "ada@example.com",
      password: "sparkl123",
    });
    expect(result.errors).toEqual({});
    expect(result.data?.email).toBe("ada@example.com");
  });

  it("maps sign-in failures to i18n messages", () => {
    expect(
      validateSignIn({ email: "bad", password: "sparkl123" }).errors,
    ).toEqual({ email: strings.invalidEmail });
    expect(
      validateSignIn({ email: "ada@example.com", password: "" }).errors,
    ).toEqual({ password: strings.requiredField });
    expect(
      validateSignIn({ email: "ada@example.com", password: "short" }).errors,
    ).toEqual({ password: strings.invalidPassword });
  });

  it("accepts a valid sign-up", () => {
    const result = validateSignUp({
      name: "Ada Host",
      email: "ada@example.com",
      password: "sparkl123",
      role: "host",
    });
    expect(result.errors).toEqual({});
    expect(result.data?.role).toBe("host");
  });

  it("maps sign-up failures to i18n messages", () => {
    expect(
      validateSignUp({
        name: "   ",
        email: "ada@example.com",
        password: "sparkl123",
        role: "cleaner",
      }).errors,
    ).toEqual({ name: strings.requiredField });
    expect(
      validateSignUp({
        name: "Ada Host",
        email: "ada@example.com",
        password: "sparkl123",
        role: "admin",
      }).errors,
    ).toEqual({ role: strings.requiredField });
  });
});
