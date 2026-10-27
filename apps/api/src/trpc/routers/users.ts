import {
  cleanerAvailabilitySchema,
  publicCleanerProfileInputSchema,
  publicCleanerProfileSchema,
  serviceAreaInputSchema,
  setAvailabilityInputSchema,
  updateProfileInputSchema,
  userSchema,
} from "@sparkl/shared";
import { drizzleUsersStore } from "../../db/stores.js";
import {
  getProfile,
  getPublicCleanerProfile,
  setAvailability,
  updateProfile,
  updateServiceArea,
} from "../../services/users.js";
import { authedProcedure, publicProcedure, router } from "../trpc.js";

// The caller's identity always comes from the session — no procedure takes
// a userId from the client.
export const usersRouter = router({
  getProfile: authedProcedure.output(userSchema).query(async ({ ctx }) => {
    return getProfile(drizzleUsersStore(ctx.db), ctx.sessionUserId);
  }),

  updateProfile: authedProcedure
    .input(updateProfileInputSchema)
    .output(userSchema)
    .mutation(async ({ ctx, input }) => {
      return updateProfile(drizzleUsersStore(ctx.db), ctx.sessionUserId, input);
    }),

  setServiceArea: authedProcedure
    .input(serviceAreaInputSchema)
    .output(userSchema)
    .mutation(async ({ ctx, input }) => {
      return updateServiceArea(
        drizzleUsersStore(ctx.db),
        ctx.sessionUserId,
        input,
      );
    }),

  setAvailability: authedProcedure
    .input(setAvailabilityInputSchema)
    .output(cleanerAvailabilitySchema.array())
    .mutation(async ({ ctx, input }) => {
      return setAvailability(
        drizzleUsersStore(ctx.db),
        ctx.sessionUserId,
        input,
      );
    }),

  getPublicCleanerProfile: publicProcedure
    .input(publicCleanerProfileInputSchema)
    .output(publicCleanerProfileSchema)
    .query(async ({ ctx, input }) => {
      return getPublicCleanerProfile(
        drizzleUsersStore(ctx.db),
        input.cleanerId,
      );
    }),
});
