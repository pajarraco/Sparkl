import type { AppRouter } from "@sparkl/api/src/trpc/router.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import type { ReactNode } from "react";
import { type GetSessionCookie, sessionHeaders } from "./auth-session.js";
import { createTrpcClient } from "./trpc-client.js";

// React composition root. Hook-free so it stays directly unit-testable.
// The auth client itself is created in auth-client.ts and passed in here
// only as a getCookie function, keeping this module free of native imports.

export const sparklTrpc = createTRPCReact<AppRouter>();

export function createQueryClient(): QueryClient {
  return new QueryClient();
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
