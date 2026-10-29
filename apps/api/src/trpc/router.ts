import { chatRouter } from "./routers/chat.js";
import { geoRouter } from "./routers/geo.js";
import { jobAssistantRouter } from "./routers/job-assistant.js";
import { jobsRouter } from "./routers/jobs.js";
import { reviewsRouter } from "./routers/reviews.js";
import { storageRouter } from "./routers/storage.js";
import { suggestionsRouter } from "./routers/suggestions.js";
import { usersRouter } from "./routers/users.js";
import { router } from "./trpc.js";

export const appRouter = router({
  users: usersRouter,
  jobs: jobsRouter,
  suggestions: suggestionsRouter,
  chat: chatRouter,
  reviews: reviewsRouter,
  storage: storageRouter,
  geo: geoRouter,
  jobAssistant: jobAssistantRouter,
});

export type AppRouter = typeof appRouter;
