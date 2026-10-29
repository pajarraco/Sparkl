import { z } from "zod";

export const GEO_PROVIDERS = ["osm"] as const;
export const geoProviderSchema = z.enum(GEO_PROVIDERS);
export type GeoProvider = z.infer<typeof geoProviderSchema>;

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

// A place returned by the geocoder. Coordinates only ever come from here.
export const geoPlaceSchema = z
  .object({
    id: z.string().min(1).max(128),
    label: z.string().min(1).max(500),
    latitude,
    longitude,
  })
  .strict();
export type GeoPlace = z.infer<typeof geoPlaceSchema>;

export const geoAutocompleteInput = z
  .object({
    query: z.string().trim().min(3).max(200),
    near: z.object({ latitude, longitude }).strict().optional(),
    limit: z.number().int().min(1).max(10).default(5),
  })
  .strict();
export type GeoAutocompleteInput = z.infer<typeof geoAutocompleteInput>;

export const geoGeocodeInput = z
  .object({
    query: z.string().trim().min(3).max(200),
  })
  .strict();
export type GeoGeocodeInput = z.infer<typeof geoGeocodeInput>;

export const geoReverseInput = z.object({ latitude, longitude }).strict();
export type GeoReverseInput = z.infer<typeof geoReverseInput>;

export const geoPlacesOutput = z
  .object({
    places: z.array(geoPlaceSchema).max(10),
  })
  .strict();
export type GeoPlacesOutput = z.infer<typeof geoPlacesOutput>;

export const geoReverseOutput = z
  .object({
    place: geoPlaceSchema.nullable(),
  })
  .strict();
export type GeoReverseOutput = z.infer<typeof geoReverseOutput>;
