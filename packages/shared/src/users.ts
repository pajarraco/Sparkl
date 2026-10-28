import { z } from "zod";

export const userRoleSchema = z.enum(["host", "cleaner"]);

// User ids are minted by Better Auth (opaque non-UUID strings) — the users
// table IS Better Auth's table (see apps/api/src/db/schema.ts). Every
// user-id field across the contracts uses this; entity ids (jobs,
// messages, reviews) stay uuid() because services mint them with
// randomUUID().
export const userIdSchema = z.string().min(1).max(256);

export const userSchema = z
  .object({
    id: userIdSchema,
    role: userRoleSchema,
    name: z.string().min(1).max(100),
    photoUrl: z.string().url().max(2048).nullable(),
    serviceLat: z.number().min(-90).max(90).nullable(),
    serviceLng: z.number().min(-180).max(180).nullable(),
    serviceRadiusKm: z.number().positive().max(500).nullable(),
    avgRating: z.number().min(0).max(5).nullable(),
    completedJobCount: z.number().int().min(0),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type UserRole = z.infer<typeof userRoleSchema>;
export type User = z.infer<typeof userSchema>;
