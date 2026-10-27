import {
  type SignInInput,
  type SignUpInput,
  signInInputSchema,
  signUpInputSchema,
} from "@sparkl/shared";
import { getStrings } from "./i18n";

// Thin Zod parsing for the auth screens so components stay free of
// validation logic (rules.md). Every message comes from the i18n package.

export type AuthField = "name" | "email" | "password" | "role";

export type AuthFieldErrors = Partial<Record<AuthField, string>>;

export interface AuthFormResult<T> {
  data: T | null;
  errors: AuthFieldErrors;
}

function toFieldErrors(
  issues: { path: (string | number)[]; message: string }[],
  messages: Record<AuthField, string>,
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (
      field === "name" ||
      field === "email" ||
      field === "password" ||
      field === "role"
    ) {
      errors[field] ??= messages[field];
    }
  }
  return errors;
}

export function validateSignIn(input: {
  email?: unknown;
  password?: unknown;
}): AuthFormResult<SignInInput> {
  const strings = getStrings().errors;
  const parsed = signInInputSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data, errors: {} };
  return {
    data: null,
    errors: toFieldErrors(parsed.error.issues, {
      name: strings.requiredField,
      email: strings.invalidEmail,
      password:
        typeof input.password === "string" && input.password.length > 0
          ? strings.invalidPassword
          : strings.requiredField,
      role: strings.requiredField,
    }),
  };
}

export function validateSignUp(input: {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
}): AuthFormResult<SignUpInput> {
  const strings = getStrings().errors;
  const parsed = signUpInputSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data, errors: {} };
  return {
    data: null,
    errors: toFieldErrors(parsed.error.issues, {
      name:
        typeof input.name === "string" && input.name.trim().length > 0
          ? strings.invalidName
          : strings.requiredField,
      email: strings.invalidEmail,
      password:
        typeof input.password === "string" && input.password.length > 0
          ? strings.invalidPassword
          : strings.requiredField,
      role: strings.requiredField,
    }),
  };
}
