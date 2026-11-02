import { z } from "zod";
import { userIdSchema, userSchema } from "./users";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

// users.updateProfile input: every field is optional (`undefined` = leave
// unchanged); nullable fields accept `null` to clear the stored value.
export const updateProfileInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    photoUrl: z.string().url().max(2048).nullable().optional(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

export const availabilitySlotInputSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .strict()
  .refine((v) => v.startTime < v.endTime, {
    message: "startTime must be before endTime",
    path: ["endTime"],
  });

export type AvailabilitySlotInput = z.infer<typeof availabilitySlotInputSchema>;

// users.setAvailability input: the caller's full weekly schedule. The
// service replaces all slots, so an empty array clears availability.
export const setAvailabilityInputSchema = z
  .object({
    slots: z.array(availabilitySlotInputSchema).max(28),
  })
  .strict()
  .refine(
    (v) => {
      const seen = new Set(
        v.slots.map((s) => `${s.weekday}|${s.startTime}|${s.endTime}`),
      );
      return seen.size === v.slots.length;
    },
    { message: "duplicate availability slots", path: ["slots"] },
  );

export type SetAvailabilityInput = z.infer<typeof setAvailabilityInputSchema>;

// users.setServiceArea input: lat/lng + radius are always set together.
export const serviceAreaInputSchema = z
  .object({
    serviceLat: z.number().min(-90).max(90),
    serviceLng: z.number().min(-180).max(180),
    serviceRadiusKm: z.number().positive().max(500),
  })
  .strict();

export type ServiceAreaInput = z.infer<typeof serviceAreaInputSchema>;

export const publicCleanerProfileInputSchema = z
  .object({ cleanerId: userIdSchema })
  .strict();

export type PublicCleanerProfileInput = z.infer<
  typeof publicCleanerProfileInputSchema
>;

// users.getPublicCleanerProfile output: the User row carries nothing
// sensitive (no email/phone), so the public profile drops only the internal
// timestamps and pairs the profile with weekly availability.
export const publicCleanerProfileSchema = z
  .object({
    profile: userSchema.omit({ createdAt: true, updatedAt: true }),
    availability: z.array(availabilitySlotInputSchema),
  })
  .strict();

export type PublicCleanerProfile = z.infer<typeof publicCleanerProfileSchema>;

// users.ratingsFor input/output: a batched lookup of the review-based trust
// row (design.md Signature Element) for a set of users — the host on a
// board/My Jobs card, or the claimed cleaner on a host's My Jobs card.
// Public, like reviews.listBySubject: the same two fields are already
// public on getPublicCleanerProfile. One call per screen, never per card.
export const userRatingsInputSchema = z
  .object({ userIds: z.array(userIdSchema).min(1).max(100) })
  .strict();

export type UserRatingsInput = z.infer<typeof userRatingsInputSchema>;

export const userRatingSummarySchema = z
  .object({
    avgRating: z.number().min(0).max(5).nullable(),
    completedJobCount: z.number().int().min(0),
  })
  .strict();

export type UserRatingSummary = z.infer<typeof userRatingSummarySchema>;

export const userRatingsOutputSchema = z.record(
  userIdSchema,
  userRatingSummarySchema,
);

export type UserRatingsOutput = z.infer<typeof userRatingsOutputSchema>;
