import {
  type CleanerAvailability,
  type PublicCleanerProfile,
  SPARKL_ERROR_CODES,
  type ServiceAreaInput,
  type SetAvailabilityInput,
  type SparklErrorCode,
  type UpdateProfileInput,
  type User,
} from "@sparkl/shared";

export class UsersError extends Error {
  readonly code: SparklErrorCode;

  constructor(code: SparklErrorCode, message: string) {
    super(message);
    this.name = "UsersError";
    this.code = code;
  }
}

export interface ProfilePatch {
  name?: string;
  photoUrl?: string | null;
  serviceLat?: number | null;
  serviceLng?: number | null;
  serviceRadiusKm?: number | null;
  avgRating?: number | null;
}

// Port the Drizzle implementation must satisfy. `update` applies only the
// defined patch keys and returns `null` when the user does not exist;
// `replaceAvailability` deletes all of the cleaner's slots, then inserts.
export interface UsersStore {
  findById(userId: string): Promise<User | null>;
  update(userId: string, patch: ProfilePatch): Promise<User | null>;
  /**
   * Atomically bump completedJobCount by one; returns null when the user
   * does not exist. A single UPDATE avoids the lost-update race a
   * read-modify-write in the service would have on concurrent completions.
   */
  incrementCompletedJobs(userId: string): Promise<User | null>;
  replaceAvailability(
    cleanerId: string,
    slots: CleanerAvailability[],
  ): Promise<CleanerAvailability[]>;
  listAvailability(cleanerId: string): Promise<CleanerAvailability[]>;
  listCleaners(): Promise<User[]>;
}

function notFound(what: string): UsersError {
  return new UsersError(SPARKL_ERROR_CODES.NOT_FOUND, `${what} not found`);
}

export async function getProfile(
  store: UsersStore,
  userId: string,
): Promise<User> {
  const user = await store.findById(userId);
  if (!user) throw notFound("profile");
  return user;
}

export async function updateProfile(
  store: UsersStore,
  userId: string,
  input: UpdateProfileInput,
): Promise<User> {
  const patch: ProfilePatch = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.photoUrl !== undefined) patch.photoUrl = input.photoUrl;
  const updated = await store.update(userId, patch);
  if (!updated) throw notFound("profile");
  return updated;
}

export async function updateServiceArea(
  store: UsersStore,
  userId: string,
  input: ServiceAreaInput,
): Promise<User> {
  // Only cleaners have a service area (it feeds distance and ranking).
  const user = await store.findById(userId);
  if (!user) throw notFound("profile");
  if (user.role !== "cleaner") {
    throw new UsersError(
      SPARKL_ERROR_CODES.FORBIDDEN,
      "only cleaners can set a service area",
    );
  }
  const updated = await store.update(userId, {
    serviceLat: input.serviceLat,
    serviceLng: input.serviceLng,
    serviceRadiusKm: input.serviceRadiusKm,
  });
  if (!updated) throw notFound("profile");
  return updated;
}

export async function setAvailability(
  store: UsersStore,
  userId: string,
  input: SetAvailabilityInput,
): Promise<CleanerAvailability[]> {
  const user = await store.findById(userId);
  if (!user) throw notFound("profile");
  if (user.role !== "cleaner") {
    throw new UsersError(
      SPARKL_ERROR_CODES.FORBIDDEN,
      "only cleaners can set availability",
    );
  }
  const slots: CleanerAvailability[] = input.slots.map((slot) => ({
    cleanerId: userId,
    weekday: slot.weekday,
    startTime: slot.startTime,
    endTime: slot.endTime,
  }));
  return store.replaceAvailability(userId, slots);
}

export async function getPublicCleanerProfile(
  store: UsersStore,
  cleanerId: string,
): Promise<PublicCleanerProfile> {
  const user = await store.findById(cleanerId);
  if (!user || user.role !== "cleaner") throw notFound("cleaner");
  const availability = await store.listAvailability(cleanerId);
  return {
    profile: {
      id: user.id,
      role: user.role,
      name: user.name,
      photoUrl: user.photoUrl,
      serviceLat: user.serviceLat,
      serviceLng: user.serviceLng,
      serviceRadiusKm: user.serviceRadiusKm,
      avgRating: user.avgRating,
      completedJobCount: user.completedJobCount,
    },
    availability: availability.map((slot) => ({
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })),
  };
}
