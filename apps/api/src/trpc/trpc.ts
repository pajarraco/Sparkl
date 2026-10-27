import {
  SPARKL_ERROR_CODES,
  type SparklErrorCode,
  type UserRole,
  userRoleSchema,
} from "@sparkl/shared";
import { TRPCError, initTRPC } from "@trpc/server";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create();

const SPARKL_TO_TRPC: Record<SparklErrorCode, TRPCError["code"]> = {
  [SPARKL_ERROR_CODES.NOT_FOUND]: "NOT_FOUND",
  [SPARKL_ERROR_CODES.FORBIDDEN]: "FORBIDDEN",
  [SPARKL_ERROR_CODES.NOT_JOB_PARTY]: "FORBIDDEN",
  [SPARKL_ERROR_CODES.JOB_NOT_OPEN]: "CONFLICT",
  [SPARKL_ERROR_CODES.JOB_ALREADY_CLAIMED]: "CONFLICT",
  [SPARKL_ERROR_CODES.INVALID_TRANSITION]: "BAD_REQUEST",
  [SPARKL_ERROR_CODES.REVIEW_NOT_ALLOWED]: "FORBIDDEN",
  [SPARKL_ERROR_CODES.REVIEW_DUPLICATE]: "CONFLICT",
  [SPARKL_ERROR_CODES.VALIDATION_ERROR]: "BAD_REQUEST",
};

function isSparklError(
  err: unknown,
): err is { code: SparklErrorCode; message?: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    (Object.values(SPARKL_ERROR_CODES) as string[]).includes(
      (err as { code: string }).code,
    )
  );
}

export function toTRPCError(err: unknown): TRPCError {
  if (err instanceof TRPCError) return err;
  if (isSparklError(err)) {
    return new TRPCError({
      code: SPARKL_TO_TRPC[err.code],
      message: err.message ?? "Something went wrong.",
      cause: err,
    });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: err });
}

const errorMapper = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (err) {
    throw toTRPCError(err);
  }
});

const requireAuth = t.middleware(async ({ ctx, next }) => {
  if (!ctx.sessionUserId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({
    ctx: { ...ctx, sessionUserId: ctx.sessionUserId, role: ctx.role },
  });
});

export const router = t.router;
export const publicProcedure = t.procedure.use(errorMapper);
export const authedProcedure = t.procedure.use(errorMapper).use(requireAuth);

export function roleProcedure(...allowed: UserRole[]) {
  const roles = allowed.map((r) => userRoleSchema.parse(r));
  return authedProcedure.use(
    t.middleware(async ({ ctx, next }) => {
      if (!ctx.role || !roles.includes(ctx.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      return next({ ctx });
    }),
  );
}
