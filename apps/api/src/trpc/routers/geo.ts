import {
  geoAutocompleteInput,
  geoGeocodeInput,
  geoPlacesOutput,
  geoReverseInput,
  geoReverseOutput,
} from "@sparkl/shared";
import { getGeoService } from "../../services/geo.js";
import { authedProcedure, router } from "../trpc.js";

// Address search for the Post Job and service-area map pickers.
export const geoRouter = router({
  autocomplete: authedProcedure
    .input(geoAutocompleteInput)
    .output(geoPlacesOutput)
    .query(async ({ ctx, input }) => ({
      places: await getGeoService().autocomplete(ctx.sessionUserId, input),
    })),
  geocode: authedProcedure
    .input(geoGeocodeInput)
    .output(geoPlacesOutput)
    .query(async ({ ctx, input }) => ({
      places: await getGeoService().geocode(ctx.sessionUserId, input),
    })),
  reverse: authedProcedure
    .input(geoReverseInput)
    .output(geoReverseOutput)
    .query(async ({ ctx, input }) => ({
      place: await getGeoService().reverse(ctx.sessionUserId, input),
    })),
});
