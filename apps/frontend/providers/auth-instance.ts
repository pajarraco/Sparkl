import * as SecureStore from "expo-secure-store";
import { getApiOrigin, getPageHostname } from "./app-config";
import { createSparklAuthClient } from "./auth-client";

// Shared Better Auth singleton for screens and the root layout.
// SecureStore persists the session cookie on native; the app shell passes
// this same instance's getCookie into the tRPC client.

// Expo inlines EXPO_PUBLIC_* vars at bundle time; without process.env the
// app always targets localhost, which on a physical phone is the phone
// itself and sign-in fails with a generic network error.
const origin = getApiOrigin(process.env, getPageHostname());

export const authClient = createSparklAuthClient({
  origin,
  storage: SecureStore,
});
