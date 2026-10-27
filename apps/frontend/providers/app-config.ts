// API endpoint config for apps/frontend (pure TS, no React/Expo yet).
// Backend reality (apps/api/src/index.ts, plugins/auth.ts):
// - tRPC served by fastifyTRPCPlugin at prefix /trpc on API_PORT (3000).
// - Chat subscription (chat.onMessage) rides SSE over the same HTTP
//   endpoint — there is no separate WebSocket URL, even though tasks.md
//   still says "HTTP + WS". Do not invent a ws:// URL.
// - Better Auth handler mounted at /api/auth/*.

export const DEFAULT_API_ORIGIN = "http://localhost:3000" as const;
export const TRPC_PREFIX = "/trpc" as const;
export const AUTH_PREFIX = "/api/auth" as const;

export function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

export function getApiOrigin(env?: {
  EXPO_PUBLIC_API_URL?: string | undefined;
}): string {
  const raw = env?.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_ORIGIN;
  return normalizeOrigin(raw);
}

export function getTrpcUrl(origin: string): string {
  return `${normalizeOrigin(origin)}${TRPC_PREFIX}`;
}

export function getAuthBaseUrl(origin: string): string {
  return `${normalizeOrigin(origin)}${AUTH_PREFIX}`;
}
