import { expoClient } from "@better-auth/expo/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { getAuthBaseUrl } from "./app-config.js";

// Thin Better Auth wiring for Expo (email/password; session persisted in
// SecureStore on native, cookies on web).
// No logic lives here — session → tRPC mapping is in auth-session.ts — so
// this module is covered by tsc + Biome rather than vitest: importing
// @better-auth/expo/client in Node pulls in expo-constants, expo-linking
// and react-native, which need a device runtime. The app shell passes the
// real SecureStore; tests use in-memory fakes against auth-session.ts.

// Storage contract mirrors ExpoClientStorage (expo-secure-store) without
// importing it, so this file stays free of native imports.
export interface SparklAuthStorage {
  getItem(key: string): string | null;
  getItemAsync(key: string): Promise<string | null>;
  setItem(key: string, value: string): void;
  setItemAsync(key: string, value: string): Promise<void>;
}

export interface SparklAuthOptions {
  /** API origin, e.g. http://localhost:3000. Build it with getApiOrigin(). */
  origin: string;
  /** SecureStore on device; an in-memory map in tests. */
  storage: SparklAuthStorage;
  scheme?: string | undefined;
  storagePrefix?: string | undefined;
}

export const SPARKL_AUTH_SCHEME = "sparkl" as const;
export const SPARKL_AUTH_STORAGE_PREFIX = "sparkl" as const;

export function createSparklAuthClient(options: SparklAuthOptions) {
  return createAuthClient({
    baseURL: getAuthBaseUrl(options.origin),
    plugins: [
      expoClient({
        scheme: options.scheme ?? SPARKL_AUTH_SCHEME,
        storage: options.storage,
        storagePrefix: options.storagePrefix ?? SPARKL_AUTH_STORAGE_PREFIX,
      }),
      // Mirrors the server's user.additionalFields in
      // apps/api/src/plugins/auth.ts so sign-up accepts a role.
      inferAdditionalFields({
        user: {
          role: { type: "string", required: true, input: true },
        },
      }),
    ],
  });
}

export type SparklAuthClient = ReturnType<typeof createSparklAuthClient>;
