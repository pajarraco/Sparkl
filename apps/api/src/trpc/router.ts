import { jobsRouter } from "./routers/jobs.js";
import { storageRouter } from "./routers/storage.js";
import { usersRouter } from "./routers/users.js";
import { router } from "./trpc.js";

export const appRouter = router({
  users: usersRouter,
  jobs: jobsRouter,
  storage: storageRouter,
});

export type AppRouter = typeof appRouter;
