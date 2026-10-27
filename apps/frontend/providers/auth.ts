import { type UserRole, userRoleSchema } from "@sparkl/shared";
import { getAuthBaseUrl } from "./app-config";

// Auth provider contract (pure TS shell — Expo/Better Auth wiring lands
// when Expo is installed; prototype notes Expo is not installed yet).
// Re-check role in services, never trust this client value (code-standard).

export const APP_ROLES = ["host", "cleaner"] as const;

export type AppRole = UserRole;

export function parseAppRole(value: unknown): AppRole | null {
  const parsed = userRoleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getSignOutUrl(origin: string): string {
  return `${getAuthBaseUrl(origin)}/sign-out`;
}
