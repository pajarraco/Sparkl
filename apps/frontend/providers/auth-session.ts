import type { GetTrpcHeaders } from "./trpc-client";

// Session → tRPC header mapping (pure; the Better Auth client that
// supplies getCookie lives in auth-client.ts).
// Native requests carry the stored session cookie explicitly because there
// is no shared cookie jar; on web the same header is harmless — the
// browser also sends cookies for the same-origin API. The server reads the
// session from headers in apps/api/src/trpc/context.ts.

export type GetSessionCookie = () => Promise<string>;

// After sign-in the client persists the session cookie asynchronously.
// Poll until the session belongs to the signed-in email (bounded, so the
// worst case is the same generic error as before). Callers pass
// readSharedSession, so the store the tab layouts read is up to date
// before they navigate.
export async function waitForSessionEmail<
  TData extends { user?: { email?: unknown } | null },
>(
  getSession: () => Promise<{ data: TData | null }>,
  email: string,
  options?: {
    attempts?: number;
    delayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<TData | null> {
  const attempts = options?.attempts ?? 10;
  const delayMs = options?.delayMs ?? 150;
  const sleep =
    options?.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const wanted = email.trim().toLowerCase();
  for (let attempt = 0; attempt < attempts; attempt++) {
    const data = (await getSession())?.data ?? null;
    const address = data?.user?.email;
    if (typeof address === "string" && address.toLowerCase() === wanted) {
      return data;
    }
    if (attempt < attempts - 1) await sleep(delayMs);
  }
  return null;
}

// The Better Auth session store that useSession subscribers (the group
// layouts) read.
export interface SharedSessionStore<TData> {
  get(): { data: TData | null; refetch: () => Promise<void> };
}

// Session reads for the sign-in/sign-up poll: refetch the shared store,
// then read it. authClient.getSession() fetches without touching the
// store, and hydrateSession() only applies once per page load — so the
// second sign-in in one tab (a role switch) navigated while the store
// still said signed out, and the group layout bounced back to welcome
// (03 A1).
export function readSharedSession<TData>(
  store: SharedSessionStore<TData>,
): () => Promise<{ data: TData | null }> {
  return async () => {
    await store.get().refetch();
    return { data: store.get().data };
  };
}

// Session-owner tracking for the root layout's cache reset: calls
// onChange whenever the signed-in user changes (sign-out, expiry, or
// another account signing in on the same device), so one account's
// cached data never shows for, or stays in memory under, the next.
// Pending states are skipped; the first settled value only records the
// owner.
export function trackSessionOwner(onChange: () => void): (value: {
  data: { user?: { id?: unknown } | null } | null;
  isPending: boolean;
}) => void {
  let owner: string | null | undefined;
  return (value) => {
    if (value.isPending) return;
    const id = value.data?.user?.id;
    const next = typeof id === "string" ? id : null;
    if (owner !== undefined && next !== owner) onChange();
    owner = next;
  };
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
