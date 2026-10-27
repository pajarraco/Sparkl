import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import "../env.js";

// Kept private: the inferred instance type is not portable — the expo
// plugin's endpoint types reach into zod/v4/core through a nested copy,
// which declaration emit cannot name (TS2742). The wrappers below expose
// exactly what the API uses, with nameable inferred types.
const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // The Expo web client runs on :8081 while the API is on :3000, which
  // Better Auth treats as cross-origin and rejects without this list.
  // Override with TRUSTED_ORIGINS (comma-separated) for other setups.
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "http://localhost:8081")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== ""),
  // Native session-cookie protocol (SecureStore-backed cookie storage on
  // the client). Web behavior is unchanged; the plugin only adds
  // trusted origins and origin handling for native schemes.
  plugins: [expo()],
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

export function getAuthSession(options: { headers: Headers }) {
  return auth.api.getSession(options);
}

export function handleAuthRequest(request: Request): Promise<Response> {
  return auth.handler(request);
}

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
      const request = new Request(url.toString(), {
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
      const res = await handleAuthRequest(request);
      reply.status(res.status);
      res.headers.forEach((v: string, k: string) => reply.header(k, v));
      return reply.send(
        res.body ? Buffer.from(await res.arrayBuffer()) : undefined,
      );
    },
  });
}
