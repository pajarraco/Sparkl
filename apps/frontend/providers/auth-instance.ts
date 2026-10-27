import * as SecureStore from "expo-secure-store";
import { getApiOrigin } from "./app-config.js";
import { createSparklAuthClient } from "./auth-client.js";

// Shared Better Auth singleton for screens and the root layout.
// SecureStore persists the session cookie on native; the app shell passes
// this same instance's getCookie into the tRPC client.

const origin = getApiOrigin();

export const authClient = createSparklAuthClient({
  origin,
  storage: SecureStore,
});
