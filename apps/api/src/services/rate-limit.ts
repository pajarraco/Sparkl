import { SPARKL_ERROR_CODES, type SparklErrorCode } from "@sparkl/shared";

// In-memory guards for paid or third-party calls (assistant, geo, voice).
// Single API process for the MVP; move to Redis if the API scales out.

export class RateLimitError extends Error {
  readonly code: SparklErrorCode = SPARKL_ERROR_CODES.RATE_LIMITED;

  constructor(message = "too many requests, try again shortly") {
    super(message);
    this.name = "RateLimitError";
  }
}

export interface UserRateLimiter {
  // Throws RateLimitError once `limit` calls land inside one window.
  consume(userId: string): void;
}

export interface UserRateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: (() => number) | undefined;
  // Bound on tracked users so a flood of ids cannot grow memory forever.
  maxUsers?: number;
}

// Fixed window per user: simple and predictable for a demo-sized API.
export function createUserRateLimiter(
  options: UserRateLimiterOptions,
): UserRateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;
  const maxUsers = options.maxUsers ?? 10_000;
  const windows = new Map<string, { start: number; count: number }>();

  return {
    consume(userId) {
      const at = now();
      const current = windows.get(userId);
      if (current === undefined || at - current.start >= windowMs) {
        if (windows.size >= maxUsers && current === undefined) {
          for (const [id, w] of windows) {
            if (at - w.start >= windowMs) windows.delete(id);
          }
          if (windows.size >= maxUsers) {
            const oldest = windows.keys().next().value;
            if (oldest !== undefined) windows.delete(oldest);
          }
        }
        windows.set(userId, { start: at, count: 1 });
        return;
      }
      if (current.count >= limit) throw new RateLimitError();
      current.count += 1;
    },
  };
}

export interface Throttle {
  // Resolves when the caller may send its request; calls are spaced at
  // least `minIntervalMs` apart, in arrival order.
  wait(): Promise<void>;
}

export interface ThrottleOptions {
  minIntervalMs: number;
  now?: (() => number) | undefined;
  sleep?: (ms: number) => Promise<void>;
}

// Global spacing for an upstream with a usage policy (Nominatim: 1 req/s).
export function createThrottle(options: ThrottleOptions): Throttle {
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let nextSlot = 0;

  return {
    async wait() {
      const at = now();
      const slot = Math.max(at, nextSlot);
      nextSlot = slot + options.minIntervalMs;
      if (slot > at) await sleep(slot - at);
    },
  };
}
