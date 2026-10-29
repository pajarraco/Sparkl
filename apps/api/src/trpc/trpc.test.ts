import type { UserRole } from "@sparkl/shared";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import type { Context } from "./context.js";
import { roleProcedure, router } from "./trpc.js";

// Only the fields the auth middlewares read; the rest of Context is never
// touched by these procedures.
function ctx(sessionUserId: string | null, role: UserRole | null): Context {
  return { sessionUserId, role } as unknown as Context;
}

const testRouter = router({
  hostOnly: roleProcedure("host").query(({ ctx }) => ctx.sessionUserId),
});

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  const err = await promise.catch((e: unknown) => e);
  return err instanceof TRPCError ? err.code : undefined;
}

describe("roleProcedure", () => {
  it("lets the allowed role through with a narrowed user id", async () => {
    const caller = testRouter.createCaller(ctx("host-1", "host"));
    await expect(caller.hostOnly()).resolves.toBe("host-1");
  });

  it("rejects other roles with FORBIDDEN", async () => {
    const caller = testRouter.createCaller(ctx("cleaner-1", "cleaner"));
    expect(await codeOf(caller.hostOnly())).toBe("FORBIDDEN");
  });

  it("rejects a session without a role with FORBIDDEN", async () => {
    const caller = testRouter.createCaller(ctx("user-1", null));
    expect(await codeOf(caller.hostOnly())).toBe("FORBIDDEN");
  });

  it("rejects signed-out callers with UNAUTHORIZED", async () => {
    const caller = testRouter.createCaller(ctx(null, null));
    expect(await codeOf(caller.hostOnly())).toBe("UNAUTHORIZED");
  });
});

describe("error mapping", () => {
  // Services throw plain errors carrying a Sparkl code; routers must turn
  // them into the matching tRPC code, never a 500.
  function failing(code: string) {
    return router({
      run: roleProcedure("host").query(() => {
        throw Object.assign(new Error(`failed with ${code}`), { code });
      }),
    }).createCaller(ctx("host-1", "host"));
  }

  it.each([
    ["NOT_FOUND", "NOT_FOUND"],
    ["FORBIDDEN", "FORBIDDEN"],
    ["JOB_ALREADY_CLAIMED", "CONFLICT"],
    ["VALIDATION_ERROR", "BAD_REQUEST"],
    ["RATE_LIMITED", "TOO_MANY_REQUESTS"],
    ["UPSTREAM_UNAVAILABLE", "SERVICE_UNAVAILABLE"],
  ])("maps %s to %s and keeps the message", async (sparkl, trpc) => {
    const err = await failing(sparkl)
      .run()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe(trpc);
    expect((err as TRPCError).message).toBe(`failed with ${sparkl}`);
  });

  it("keeps unknown errors as INTERNAL_SERVER_ERROR", async () => {
    const caller = router({
      run: roleProcedure("host").query(() => {
        throw new Error("boom");
      }),
    }).createCaller(ctx("host-1", "host"));
    expect(await codeOf(caller.run())).toBe("INTERNAL_SERVER_ERROR");
  });
});
