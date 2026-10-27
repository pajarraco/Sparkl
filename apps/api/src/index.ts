import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { closeDb } from "./db/client.js";
import { authPlugin } from "./plugins/auth.js";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/router.js";

const port = Number(process.env.API_PORT ?? 3000);

const app = Fastify({ logger: true });

await app.register(authPlugin);
await app.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: { router: appRouter, createContext },
});

app.addHook("onClose", async () => {
  await closeDb();
});

await app.listen({ port, host: "0.0.0.0" });
