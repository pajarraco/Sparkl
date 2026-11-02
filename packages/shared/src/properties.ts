import { z } from "zod";

// A host's cleaning property (03 E): added once, reused across many jobs.
// Address and coordinates come from the same AddressMapPicker as the job
// form; defaultNotes seeds the checklist on each new job for it.

export const propertySchema = z
  .object({
    id: z.string().uuid(),
    hostId: z.string().min(1),
    name: z.string().min(1).max(200),
    address: z.string().min(1).max(500),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    sizeSqm: z.number().positive().max(100000).nullable(),
    defaultNotes: z.string().max(2000).nullable(),
    archivedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type Property = z.infer<typeof propertySchema>;

export const createPropertyInput = z
  .object({
    name: z.string().min(1).max(200),
    address: z.string().min(1).max(500),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    sizeSqm: z.number().positive().max(100000).optional(),
    defaultNotes: z.string().max(2000).optional(),
  })
  .strict();
export type CreatePropertyInput = z.infer<typeof createPropertyInput>;

export const updatePropertyInput = z
  .object({
    propertyId: z.string().uuid(),
    name: z.string().min(1).max(200).optional(),
    address: z.string().min(1).max(500).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    sizeSqm: z.number().positive().max(100000).nullable().optional(),
    defaultNotes: z.string().max(2000).nullable().optional(),
  })
  .strict();
export type UpdatePropertyInput = z.infer<typeof updatePropertyInput>;

export const archivePropertyInput = z
  .object({ propertyId: z.string().uuid() })
  .strict();
export type ArchivePropertyInput = z.infer<typeof archivePropertyInput>;

export const listPropertiesInput = z
  .object({ includeArchived: z.boolean().default(false) })
  .strict();
export type ListPropertiesInput = z.infer<typeof listPropertiesInput>;

export const listPropertiesOutput = z.array(propertySchema);
