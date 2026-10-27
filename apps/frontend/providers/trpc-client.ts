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
        true: httpSubscriptionLink({ url }),
        false: httpBatchLink({ url, headers }),
      }),
    ],
  });
}
