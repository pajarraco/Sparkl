import type { CleanerAvailability, User } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  UsersError,
  type UsersStore,
  getProfile,
  getPublicCleanerProfile,
  setAvailability,
  updateProfile,
  updateServiceArea,
} from "./users.js";

const CLEANER_ID = "11111111-1111-4111-8111-111111111111";
const HOST_ID = "22222222-2222-4222-8222-222222222222";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: CLEANER_ID,
    role: "cleaner",
    name: "Ada Cleaner",
    photoUrl: null,
    serviceLat: null,
    serviceLng: null,
    serviceRadiusKm: null,
    avgRating: 4.8,
    completedJobCount: 12,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

class InMemoryUsersStore implements UsersStore {
  users = new Map<string, User>();
  availability = new Map<string, CleanerAvailability[]>();

  async findById(userId: string): Promise<User | null> {
    return this.users.get(userId) ?? null;
  }

  async update(
    userId: string,
    patch: Record<string, unknown>,
  ): Promise<User | null> {
    const existing = this.users.get(userId);
    if (!existing) return null;
    const defined = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    const updated = { ...existing, ...defined };
    this.users.set(userId, updated);
    return updated;
  }

  async replaceAvailability(
    cleanerId: string,
    slots: CleanerAvailability[],
  ): Promise<CleanerAvailability[]> {
    this.availability.set(cleanerId, [...slots]);
    return [...slots];
  }

  async listAvailability(cleanerId: string): Promise<CleanerAvailability[]> {
    return [...(this.availability.get(cleanerId) ?? [])];
  }
}

function storeWithCleaner(): InMemoryUsersStore {
  const store = new InMemoryUsersStore();
  store.users.set(CLEANER_ID, makeUser());
  store.users.set(HOST_ID, makeUser({ id: HOST_ID, role: "host" }));
  return store;
}

describe("getProfile", () => {
  it("returns the caller's profile", async () => {
    const user = await getProfile(storeWithCleaner(), CLEANER_ID);
    expect(user.id).toBe(CLEANER_ID);
  });

  it("throws NOT_FOUND for an unknown user", async () => {
    await expect(
      getProfile(storeWithCleaner(), "99999999-9999-4999-8999-999999999999"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("updateProfile", () => {
  it("patches only defined fields; null clears the photo", async () => {
    const store = storeWithCleaner();
    store.users.set(CLEANER_ID, makeUser({ photoUrl: "https://x/y.png" }));
    const updated = await updateProfile(store, CLEANER_ID, {
      name: "New Name",
      photoUrl: null,
    });
    expect(updated.name).toBe("New Name");
    expect(updated.photoUrl).toBeNull();
  });

  it("leaves untouched fields alone when input is empty", async () => {
    const updated = await updateProfile(storeWithCleaner(), CLEANER_ID, {});
    expect(updated.name).toBe("Ada Cleaner");
  });

  it("throws NOT_FOUND for an unknown user", async () => {
    await expect(
      updateProfile(
        storeWithCleaner(),
        "99999999-9999-4999-8999-999999999999",
        { name: "Ghost" },
      ),
    ).rejects.toBeInstanceOf(UsersError);
  });
});

describe("updateServiceArea", () => {
  it("sets lat/lng/radius together", async () => {
    const updated = await updateServiceArea(storeWithCleaner(), CLEANER_ID, {
      serviceLat: 41.39,
      serviceLng: 2.17,
      serviceRadiusKm: 15,
    });
    expect(updated.serviceRadiusKm).toBe(15);
  });
});

describe("setAvailability", () => {
  it("stores slots scoped to the caller and replaces them on resubmission", async () => {
    const store = storeWithCleaner();
    await setAvailability(store, CLEANER_ID, {
      slots: [{ weekday: 1, startTime: "09:00", endTime: "17:00" }],
    });
    const second = await setAvailability(store, CLEANER_ID, {
      slots: [{ weekday: 2, startTime: "10:00", endTime: "14:00" }],
    });
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ cleanerId: CLEANER_ID, weekday: 2 });
    expect(await store.listAvailability(CLEANER_ID)).toHaveLength(1);
  });

  it("clears availability with an empty slot list", async () => {
    const store = storeWithCleaner();
    await setAvailability(store, CLEANER_ID, {
      slots: [{ weekday: 1, startTime: "09:00", endTime: "17:00" }],
    });
    await expect(
      setAvailability(store, CLEANER_ID, { slots: [] }),
    ).resolves.toEqual([]);
  });

  it("rejects hosts with FORBIDDEN", async () => {
    await expect(
      setAvailability(storeWithCleaner(), HOST_ID, { slots: [] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("getPublicCleanerProfile", () => {
  it("returns the profile without timestamps plus availability", async () => {
    const store = storeWithCleaner();
    await setAvailability(store, CLEANER_ID, {
      slots: [{ weekday: 5, startTime: "09:00", endTime: "17:00" }],
    });
    const result = await getPublicCleanerProfile(store, CLEANER_ID);
    expect(result.profile).not.toHaveProperty("createdAt");
    expect(result.profile).toMatchObject({ id: CLEANER_ID, avgRating: 4.8 });
    expect(result.availability).toHaveLength(1);
  });

  it("throws NOT_FOUND for hosts and unknown ids", async () => {
    const store = storeWithCleaner();
    await expect(getPublicCleanerProfile(store, HOST_ID)).rejects.toMatchObject(
      {
        code: "NOT_FOUND",
      },
    );
    await expect(
      getPublicCleanerProfile(store, "99999999-9999-4999-8999-999999999999"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
