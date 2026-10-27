import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { getApiOrigin } from "./app-config.js";
import {
  SparklProviders,
  createAuthenticatedTrpcClient,
  createQueryClient,
  sparklTrpc,
} from "./app-providers.js";

describe("app providers", () => {
  it("creates a query client with library defaults", () => {
    expect(createQueryClient()).toBeInstanceOf(QueryClient);
  });

  it("exposes typed tRPC React bindings", () => {
    expect(sparklTrpc).toBeDefined();
    expect(sparklTrpc.Provider).toBeDefined();
  });

  it("creates an authenticated tRPC client without network side effects", () => {
    const client = createAuthenticatedTrpcClient({
      origin: getApiOrigin(),
      getCookie: async () => "",
    });
    expect(client).toBeDefined();
  });

  it("nests the tRPC provider outside the query provider", () => {
    const queryClient = createQueryClient();
    const trpcClient = createAuthenticatedTrpcClient({
      origin: getApiOrigin(),
      getCookie: async () => "",
    });
    const element = SparklProviders({
      queryClient,
      trpcClient,
      children: null,
    });
    expect(element.type).toBe(sparklTrpc.Provider);
    expect(element.props.client).toBe(trpcClient);
    expect(element.props.queryClient).toBe(queryClient);
    expect(element.props.children.type).toBe(QueryClientProvider);
    expect(element.props.children.props.client).toBe(queryClient);
    expect(element.props.children.props.children).toBeNull();
  });
});
