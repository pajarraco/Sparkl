import { z } from "zod";
import { userRoleSchema } from "./users";

// Client-side auth form validation. Better Auth owns the real checks on
// the server (email/password rules live in apps/api/src/plugins/auth.ts);
// these schemas mirror them so forms fail fast with i18n-mapped messages.
// Backend constraints mirrored here: password 8–128 chars.
const emailSchema = z.string().trim().email().max(254);

const passwordSchema = z.string().min(8).max(128);

export const signInInputSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export type SignInInput = z.infer<typeof signInInputSchema>;

export const signUpInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: emailSchema,
    password: passwordSchema,
    role: userRoleSchema,
  })
  .strict();

export type SignUpInput = z.infer<typeof signUpInputSchema>;
