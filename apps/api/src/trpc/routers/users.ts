import {
  cleanerAvailabilitySchema,
  publicCleanerProfileInputSchema,
  publicCleanerProfileSchema,
  serviceAreaInputSchema,
  setAvailabilityInputSchema,
  updateProfileInputSchema,
  userRatingsInputSchema,
  userRatingsOutputSchema,
  userSchema,
} from "@sparkl/shared";
import { drizzleUsersStore } from "../../db/stores.js";
import {
  getProfile,
  getPublicCleanerProfile,
  getRatingsForUsers,
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

  // Job card trust row (design.md Signature Element): one batched call per
  // screen for the other party's rating, never one per card.
  ratingsFor: authedProcedure
    .input(userRatingsInputSchema)
    .output(userRatingsOutputSchema)
    .query(async ({ ctx, input }) => {
      return getRatingsForUsers(drizzleUsersStore(ctx.db), input.userIds);
    }),
});
