import {
  archivePropertyInput,
  createPropertyInput,
  listPropertiesInput,
  listPropertiesOutput,
  propertySchema,
  updatePropertyInput,
} from "@sparkl/shared";
import { drizzlePropertiesStore, systemClock } from "../../db/stores.js";
import * as propertiesService from "../../services/properties.js";
import { authedProcedure, router } from "../trpc.js";

export const propertiesRouter = router({
  create: authedProcedure
    .input(createPropertyInput)
    .output(propertySchema)
    .mutation(async ({ ctx, input }) => {
      return propertiesService.createProperty(
        drizzlePropertiesStore(ctx.db),
        systemClock,
        { hostId: ctx.sessionUserId, hostRole: ctx.role, input },
      );
    }),

  list: authedProcedure
    .input(listPropertiesInput)
    .output(listPropertiesOutput)
    .query(async ({ ctx, input }) => {
      return propertiesService.listProperties(drizzlePropertiesStore(ctx.db), {
        hostId: ctx.sessionUserId,
        hostRole: ctx.role,
        includeArchived: input.includeArchived,
      });
    }),

  update: authedProcedure
    .input(updatePropertyInput)
    .output(propertySchema)
    .mutation(async ({ ctx, input }) => {
      return propertiesService.updateProperty(
        drizzlePropertiesStore(ctx.db),
        systemClock,
        { hostId: ctx.sessionUserId, hostRole: ctx.role, input },
      );
    }),

  archive: authedProcedure
    .input(archivePropertyInput)
    .output(propertySchema)
    .mutation(async ({ ctx, input }) => {
      return propertiesService.archiveProperty(
        drizzlePropertiesStore(ctx.db),
        systemClock,
        {
          hostId: ctx.sessionUserId,
          hostRole: ctx.role,
          propertyId: input.propertyId,
        },
      );
    }),
});
