import { type UserRole, userRoleSchema } from "@sparkl/shared";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import { type Db, db } from "../db/client.js";
import { auth } from "../plugins/auth.js";

// Service singletons only; business logic stays in apps/api/src/services/.
export interface Services {
  readonly db: Db;
}

export interface Context {
  req: FastifyRequest;
  reply: FastifyReply;
  db: Db;
  services: Services;
  sessionUserId: string | null;
  role: UserRole | null;
}

export async function createContext({
  req,
  res,
}: CreateFastifyContextOptions): Promise<Context> {
  const data = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  const parsed = userRoleSchema.safeParse(
    (data?.user as { role?: unknown } | undefined)?.role,
  );
  return {
    req,
    reply: res,
    db,
    services: { db },
    sessionUserId: data?.user?.id ?? null,
    role: parsed.success ? parsed.data : null,
  };
}
