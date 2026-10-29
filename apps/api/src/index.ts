import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { closeDb } from "./db/client.js";
import { authPlugin } from "./plugins/auth.js";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/router.js";

const port = Number(process.env.API_PORT ?? 3000);

// Request logs drop the query string: tRPC queries carry their input in
// the URL (e.g. geo.autocomplete addresses), and inputs are never logged.
const app = Fastify({
  logger: {
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: req.url.split("?")[0] ?? "",
          hostname: req.hostname,
          remoteAddress: req.ip,
        };
      },
    },
  },
});

// Local-dev posture: the Expo web client (:8081) talks to the API
// (:3000), so browsers send CORS preflights for auth + tRPC calls.
// Reflect the caller origin and allow cookies (Better Auth session).
// Revisit with an explicit origin allowlist before any production deploy.
await app.register(cors, { origin: true, credentials: true });

await app.register(authPlugin);
await app.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: { router: appRouter, createContext },
});

app.addHook("onClose", async () => {
  await closeDb();
});

await app.listen({ port, host: "0.0.0.0" });
