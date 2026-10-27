import { chatRouter } from "./routers/chat.js";
import { jobsRouter } from "./routers/jobs.js";
import { storageRouter } from "./routers/storage.js";
import { suggestionsRouter } from "./routers/suggestions.js";
import { usersRouter } from "./routers/users.js";
import { router } from "./trpc.js";

export const appRouter = router({
  users: usersRouter,
  jobs: jobsRouter,
  suggestions: suggestionsRouter,
  chat: chatRouter,
  storage: storageRouter,
});

export type AppRouter = typeof appRouter;
