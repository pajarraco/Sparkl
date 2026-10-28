import { z } from "zod";
import { jobStatusSchema } from "./lifecycle";
import { userIdSchema } from "./users";

export const jobSchema = z
  .object({
    id: z.string().uuid(),
    hostId: userIdSchema,
    address: z.string().min(1).max(500),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    windowStart: z.string().datetime(),
    windowEnd: z.string().datetime(),
    sizeSqm: z.number().positive().max(100000).nullable(),
    notes: z.string().max(2000).nullable(),
    priceMinorUnits: z.number().int().min(0),
    status: jobStatusSchema,
    claimedByCleanerId: userIdSchema.nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .refine((v) => v.windowEnd > v.windowStart, {
    message: "windowEnd must be after windowStart",
    path: ["windowEnd"],
  });

export type Job = z.infer<typeof jobSchema>;
