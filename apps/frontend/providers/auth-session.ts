import type { GetTrpcHeaders } from "./trpc-client.js";

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
