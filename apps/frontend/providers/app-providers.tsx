import type { AppRouter } from "@sparkl/api/src/trpc/router";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import type { ReactNode } from "react";
import { type GetSessionCookie, sessionHeaders } from "./auth-session";
import { createTrpcClient } from "./trpc-client";

// React composition root. Hook-free so it stays directly unit-testable.
// The auth client itself is created in auth-client.ts and passed in here
// only as a getCookie function, keeping this module free of native imports.

export const sparklTrpc = createTRPCReact<AppRouter>();

export interface QueryErrorHandlers {
  onQueryError?: ((err: unknown) => void) | undefined;
  onMutationError?: ((err: unknown) => void) | undefined;
}

export function createQueryClient(
  handlers: QueryErrorHandlers = {},
): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (err) => {
        handlers.onQueryError?.(err);
      },
    }),
    mutationCache: new MutationCache({
      onError: (err) => {
        handlers.onMutationError?.(err);
      },
    }),
  });
}

export function createAuthenticatedTrpcClient(options: {
  origin: string;
  getCookie: GetSessionCookie;
}) {
  return createTrpcClient({
    origin: options.origin,
    getHeaders: sessionHeaders(options.getCookie),
  });
}

export interface SparklProvidersProps {
  queryClient: QueryClient;
  trpcClient: ReturnType<typeof createAuthenticatedTrpcClient>;
  children: ReactNode;
}

export function SparklProviders(props: SparklProvidersProps) {
  const TrpcProvider = sparklTrpc.Provider;
  return (
    <TrpcProvider client={props.trpcClient} queryClient={props.queryClient}>
      <QueryClientProvider client={props.queryClient}>
        {props.children}
      </QueryClientProvider>
    </TrpcProvider>
  );
}
