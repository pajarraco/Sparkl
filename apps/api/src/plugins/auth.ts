import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      role: { type: "string", required: true, input: true },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
});

export type Auth = typeof auth;

export async function authPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    handler: async (req, reply) => {
      const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v !== undefined)
          headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
      }
      const hasBody =
        req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined;
      const request = new Request(url, {
        method: req.method,
        headers,
        ...(hasBody
          ? {
              body:
                typeof req.body === "string"
                  ? req.body
                  : JSON.stringify(req.body),
            }
          : {}),
      });
      const res = await auth.handler(request);
      reply.status(res.status);
      res.headers.forEach((v, k) => reply.header(k, v));
      return reply.send(
        res.body ? Buffer.from(await res.arrayBuffer()) : undefined,
      );
    },
  });
}
