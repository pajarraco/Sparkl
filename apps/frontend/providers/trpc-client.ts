import type { AppRouter } from "@sparkl/api/src/trpc/router";
import {
  createTRPCClient,
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
} from "@trpc/client";
import { getTrpcUrl } from "./app-config";

// Typed tRPC client for apps/frontend (vanilla — React Query wiring is the
// next slice). Transport mirrors apps/api/src/index.ts: one Fastify origin
// serves /trpc (fastifyTRPCPlugin prefix) and /api/auth/* (Better Auth).
// Chat (chat.onMessage) rides SSE over the same HTTP endpoint — there is no
// ws:// URL, so subscriptions use httpSubscriptionLink behind splitLink.
// The AppRouter import is type-only (verbatimModuleSyntax): it is erased at
// build time, so no server code ships in the Expo bundle.

export type TrpcHeaders = Record<string, string>;

export type GetTrpcHeaders = () => TrpcHeaders | Promise<TrpcHeaders>;

export interface TrpcClientOptions {
  /** API origin, e.g. http://localhost:3000. Build it with getApiOrigin(). */
  origin: string;
  /** Optional auth headers. Session wiring lands with the auth slice. */
  getHeaders?: GetTrpcHeaders | undefined;
}

export function isSubscriptionOperation(op: { type: string }): boolean {
  return op.type === "subscription";
}

export function getTrpcClientUrl(origin: string): string {
  return getTrpcUrl(origin);
}

export function createTrpcClient(options: TrpcClientOptions) {
  const url = getTrpcUrl(options.origin);
  const headers: GetTrpcHeaders | TrpcHeaders = options.getHeaders ?? {};
  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: isSubscriptionOperation,
        true: httpSubscriptionLink({
          url,
          eventSourceOptions: { withCredentials: true },
        }),
        false: httpBatchLink({
          url,
          headers,
          fetch: fetchWithCredentials,
        }),
      }),
    ],
  });
}

// Cross-origin web (Expo web on :8081 → API on :3000) sends no cookies by
// default, and browsers forbid setting Cookie via fetch — so without this
// every authed call 401s on web while native works. credentials:include
// carries the Better Auth session cookie from the browser jar; React
// Native ignores the option (no cookie jar — the explicit header carries
// the session there instead).
function fetchWithCredentials(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, { ...init, credentials: "include" });
}
