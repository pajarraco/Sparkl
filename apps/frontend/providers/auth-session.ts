import type { GetTrpcHeaders } from "./trpc-client";

// Session → tRPC header mapping (pure; the Better Auth client that
// supplies getCookie lives in auth-client.ts).
// Native requests carry the stored session cookie explicitly because there
// is no shared cookie jar; on web the same header is harmless — the
// browser also sends cookies for the same-origin API. The server reads the
// session from headers in apps/api/src/trpc/context.ts.

export type GetSessionCookie = () => Promise<string>;

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
