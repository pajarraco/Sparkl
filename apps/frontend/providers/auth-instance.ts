import * as SecureStore from "expo-secure-store";
import { getApiOrigin, getPageHostname } from "./app-config";
import { createSparklAuthClient } from "./auth-client";
import { readSharedSession } from "./auth-session";

// Shared Better Auth singleton for screens and the root layout.
// SecureStore persists the session cookie on native; the app shell passes
// this same instance's getCookie into the tRPC client.

// Expo inlines EXPO_PUBLIC_* vars at bundle time; without process.env the
// app always targets localhost, which on a physical phone is the phone
// itself and sign-in fails with a generic network error.
const origin = getApiOrigin(
  { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL },
  getPageHostname(),
);

export const authClient = createSparklAuthClient({
  origin,
  storage: SecureStore,
});

// The store useSession subscribers read. The atom always exists: Better
// Auth registers it before any plugin atoms.
const sessionAtom = authClient.$store.atoms.session;
if (sessionAtom === undefined) {
  throw new Error("Better Auth session store is missing.");
}
export const authSessionStore = sessionAtom;

// Reads the session through that store (see readSharedSession).
export const readAuthSession =
  readSharedSession<typeof authClient.$Infer.Session>(sessionAtom);
