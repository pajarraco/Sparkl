import { z } from "zod";
import { userIdSchema } from "./users";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const cleanerAvailabilitySchema = z
  .object({
    cleanerId: userIdSchema,
    weekday: z.number().int().min(0).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .strict()
  .refine((v) => v.startTime < v.endTime, {
    message: "startTime must be before endTime",
    path: ["endTime"],
  });

export type CleanerAvailability = z.infer<typeof cleanerAvailabilitySchema>;
