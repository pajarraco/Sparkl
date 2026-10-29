import { SPARKL_ERROR_CODES } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  RateLimitError,
  createThrottle,
  createUserRateLimiter,
} from "./rate-limit.js";

describe("createUserRateLimiter", () => {
  it("allows up to the limit and then throws", () => {
    const t = 0;
    const now = () => t;
    const limiter = createUserRateLimiter({ limit: 3, windowMs: 1000, now });

    // Should allow 3 calls
    limiter.consume("u1");
    limiter.consume("u1");
    limiter.consume("u1");

    // Should throw on 4th call
    expect(() => limiter.consume("u1")).toThrow(RateLimitError);
  });

  it("throws RateLimitError with correct code", () => {
    const t = 0;
    const now = () => t;
    const limiter = createUserRateLimiter({ limit: 1, windowMs: 1000, now });

    expect(() => limiter.consume("u1")).not.toThrow();
    expect(() => limiter.consume("u1")).toThrow(RateLimitError);

    try {
      limiter.consume("u1");
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      expect((e as RateLimitError).code).toBe(SPARKL_ERROR_CODES.RATE_LIMITED);
    }
  });

  it("users are independent", () => {
    const t = 0;
    const now = () => t;
    const limiter = createUserRateLimiter({ limit: 1, windowMs: 1000, now });

    // u1 exhausted
    limiter.consume("u1");
    expect(() => limiter.consume("u1")).toThrow(RateLimitError);

    // u2 should still be able to consume
    expect(() => limiter.consume("u2")).not.toThrow();
  });

  it("window resets correctly", () => {
    let t = 0;
    const now = () => t;
    const limiter = createUserRateLimiter({ limit: 1, windowMs: 1000, now });

    // Exhaust u1
    limiter.consume("u1");
    expect(() => limiter.consume("u1")).toThrow(RateLimitError);

    // Just before the reset it still throws
    t = 999;
    expect(() => limiter.consume("u1")).toThrow(RateLimitError);

    // At the window boundary it resets
    t = 1000;
    expect(() => limiter.consume("u1")).not.toThrow();
  });

  it("maxUsers works correctly", () => {
    const t = 0;
    const now = () => t;
    const limiter = createUserRateLimiter({
      limit: 1,
      windowMs: 1000,
      now,
      maxUsers: 2,
    });

    // Consume a, b, c (all pass)
    limiter.consume("a");
    limiter.consume("b");
    limiter.consume("c");

    // a should be evicted and able to consume again
    expect(() => limiter.consume("a")).not.toThrow();

    // c should still be blocked
    expect(() => limiter.consume("c")).toThrow(RateLimitError);
  });
});

describe("createThrottle", () => {
  it("does not sleep on first call", async () => {
    let t = 0;
    const now = () => t;
    const slept: number[] = [];
    const sleep = async (ms: number) => {
      slept.push(ms);
      t += ms;
    };
    const throttle = createThrottle({ minIntervalMs: 1000, now, sleep });

    await throttle.wait();

    expect(slept).toEqual([]);
  });

  it("sleeps appropriately on subsequent calls", async () => {
    let t = 0;
    const now = () => t;
    const slept: number[] = [];
    const sleep = async (ms: number) => {
      slept.push(ms);
      t += ms;
    };
    const throttle = createThrottle({ minIntervalMs: 1000, now, sleep });

    await throttle.wait(); // First call - no sleep
    await throttle.wait(); // Second call - sleep 1000
    await throttle.wait(); // Third call - sleep 1000 again

    expect(slept).toEqual([1000, 1000]);
  });

  it("does not sleep after sufficient time has passed", async () => {
    let t = 0;
    const now = () => t;
    const slept: number[] = [];
    const sleep = async (ms: number) => {
      slept.push(ms);
      t += ms;
    };
    const throttle = createThrottle({ minIntervalMs: 1000, now, sleep });

    await throttle.wait(); // First call - no sleep
    t += 5000; // Advance time by 5 seconds
    await throttle.wait(); // Should not sleep

    expect(slept).toEqual([]);
  });

  it("sleeps remaining time when time has partially passed", async () => {
    let t = 0;
    const now = () => t;
    const slept: number[] = [];
    const sleep = async (ms: number) => {
      slept.push(ms);
      t += ms;
    };
    const throttle = createThrottle({ minIntervalMs: 1000, now, sleep });

    await throttle.wait(); // First call - no sleep
    t += 400; // Advance time by 400ms
    await throttle.wait(); // Should sleep 600ms

    expect(slept).toEqual([600]);
  });

  it("handles concurrent calls correctly", async () => {
    const t = 0;
    const now = () => t;
    const slept: number[] = [];
    const sleep = async (ms: number) => {
      slept.push(ms);
      // Don't advance t here - simulate that sleep doesn't advance time
    };
    const throttle = createThrottle({ minIntervalMs: 1000, now, sleep });

    const w = () => throttle.wait();

    await Promise.all([w(), w(), w()]);

    expect(slept).toEqual([1000, 2000]);
  });
});
