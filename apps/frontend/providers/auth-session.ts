import type { GetTrpcHeaders } from "./trpc-client";

// Session → tRPC header mapping (pure; the Better Auth client that
// supplies getCookie lives in auth-client.ts).
// Native requests carry the stored session cookie explicitly because there
// is no shared cookie jar; on web the same header is harmless — the
// browser also sends cookies for the same-origin API. The server reads the
// session from headers in apps/api/src/trpc/context.ts.

export type GetSessionCookie = () => Promise<string>;

// Session snapshot shape (structural — works with the Better Auth client
// and with test fakes).
export interface SessionSnapshot {
  user?: { email?: unknown; role?: unknown } | null;
}

// After sign-in the native client persists the session cookie
// asynchronously. When switching accounts (sign out → sign in as someone
// else), the first getSession can still return the stale session or none
// at all, which used to bounce the user back to the login screen while a
// retry worked. Poll until the session belongs to the signed-in email
// (bounded, so the worst case is the same generic error as before).
export async function waitForSessionUser(
  getSession: () => Promise<{ data: SessionSnapshot | null }>,
  email: string,
  options?: {
    attempts?: number;
    delayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<SessionSnapshot["user"] | null> {
  const attempts = options?.attempts ?? 10;
  const delayMs = options?.delayMs ?? 150;
  const sleep =
    options?.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const wanted = email.trim().toLowerCase();
  for (let attempt = 0; attempt < attempts; attempt++) {
    const user = (await getSession())?.data?.user ?? null;
    if (
      typeof user?.email === "string" &&
      user.email.toLowerCase() === wanted
    ) {
      return user;
    }
    if (attempt < attempts - 1) await sleep(delayMs);
  }
  return null;
}

export function sessionHeaders(getCookie: GetSessionCookie): GetTrpcHeaders {
  return async () => {
    const cookie = await getCookie();
    return cookie ? { cookie } : {};
  };
}

// Web cookie sourcing (used in app/_layout.tsx with Platform.OS). On web
// the session lives in the browser cookie jar and SecureStore does not
// exist (empty native module) — calling authClient.getCookie() throws,
// which rejects the tRPC headers and fails every query/mutation before
// any request is sent. The explicit header must stay empty on web anyway:
// browsers forbid setting Cookie via fetch, and credentials:include on
// the tRPC fetch carries the session instead.
export function selectCookieGetter(
  platformOS: string,
  getCookie: GetSessionCookie,
): GetSessionCookie {
  if (platformOS === "web") return () => Promise.resolve("");
  return getCookie;
}

// Expired-session detection for the root layout's cache subscriptions:
// any tRPC UNAUTHORIZED means the server no longer accepts the session,
// so the app signs out locally and returns to welcome instead of
// stranding the user on error states.
export function isSessionExpiredError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const data = (err as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return false;
  return (data as { code?: unknown }).code === "UNAUTHORIZED";
}
