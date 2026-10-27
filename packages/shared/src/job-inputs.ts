import { z } from "zod";
import { jobStatusSchema } from "./lifecycle.js";

const isoDatetime = z.string().datetime();

// hostId comes from the session, never from the client.
export const createJobInput = z
  .object({
    address: z.string().min(1).max(500),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    windowStart: isoDatetime,
    windowEnd: isoDatetime,
    sizeSqm: z.number().positive().max(100000).optional(),
    notes: z.string().max(2000).optional(),
    priceMinorUnits: z.number().int().min(0),
  })
  .strict()
  .refine((v) => v.windowEnd > v.windowStart, {
    message: "windowEnd must be after windowStart",
    path: ["windowEnd"],
  });

export type CreateJobInput = z.infer<typeof createJobInput>;

export const listOpenJobsInput = z
  .object({
    dateFrom: isoDatetime.optional(),
    dateTo: isoDatetime.optional(),
    centerLat: z.number().min(-90).max(90).optional(),
    centerLng: z.number().min(-180).max(180).optional(),
    maxDistanceKm: z.number().positive().max(20000).optional(),
    minPriceMinorUnits: z.number().int().min(0).optional(),
    maxPriceMinorUnits: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
  })
  .strict()
  .refine((v) => (v.centerLat === undefined) === (v.centerLng === undefined), {
    message: "centerLat and centerLng must be provided together",
    path: ["centerLng"],
  })
  .refine((v) => v.maxDistanceKm === undefined || v.centerLat !== undefined, {
    message: "maxDistanceKm requires centerLat/centerLng",
    path: ["maxDistanceKm"],
  })
  .refine(
    (v) =>
      v.minPriceMinorUnits === undefined ||
      v.maxPriceMinorUnits === undefined ||
      v.minPriceMinorUnits <= v.maxPriceMinorUnits,
    {
      message: "minPriceMinorUnits must be <= maxPriceMinorUnits",
      path: ["maxPriceMinorUnits"],
    },
  )
  .refine(
    (v) =>
      v.dateFrom === undefined ||
      v.dateTo === undefined ||
      v.dateFrom <= v.dateTo,
    { message: "dateFrom must be <= dateTo", path: ["dateTo"] },
  );

export type ListOpenJobsInput = z.infer<typeof listOpenJobsInput>;

export const myJobsInput = z
  .object({
    status: jobStatusSchema.optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
  })
  .strict();

export type MyJobsInput = z.infer<typeof myJobsInput>;

export const claimJobInput = z.object({ jobId: z.string().uuid() }).strict();

export type ClaimJobInput = z.infer<typeof claimJobInput>;

export const transitionJobInput = z
  .object({ jobId: z.string().uuid(), toStatus: jobStatusSchema })
  .strict();

export type TransitionJobInput = z.infer<typeof transitionJobInput>;

export const cancelJobInput = z.object({ jobId: z.string().uuid() }).strict();

export type CancelJobInput = z.infer<typeof cancelJobInput>;
