import type { Property } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  type Clock,
  PropertiesError,
  type PropertiesStore,
  archiveProperty,
  createProperty,
  listProperties,
  requireActivePropertyForJob,
  updateProperty,
} from "./properties.js";

const HOST = "11111111-1111-4111-8111-111111111111";
const STRANGER = "22222222-2222-4222-8222-222222222222";

const clock: Clock = { nowIso: () => "2026-01-01T10:00:00.000Z" };

let seq = 0;
function uid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: uid(),
    hostId: HOST,
    name: "Beach Studio",
    address: "Calle Falsa 123",
    latitude: 40.4168,
    longitude: -3.7038,
    sizeSqm: 60,
    defaultNotes: "Mop the hall",
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeFakes(seed: Property[] = []): {
  store: PropertiesStore;
  byId: Map<string, Property>;
} {
  const byId = new Map(seed.map((p) => [p.id, { ...p }]));
  const store: PropertiesStore = {
    async insert(property) {
      byId.set(property.id, { ...property });
      return { ...property };
    },
    async findById(id) {
      const p = byId.get(id);
      return p ? { ...p } : null;
    },
    async listByHost(hostId, includeArchived) {
      return [...byId.values()]
        .filter((p) => p.hostId === hostId)
        .filter((p) => includeArchived || p.archivedAt === null)
        .map((p) => ({ ...p }));
    },
    async save(property) {
      byId.set(property.id, { ...property });
      return { ...property };
    },
    async isReferencedByAJob() {
      return false;
    },
  };
  return { store, byId };
}

async function captureCode(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (err) {
    expect(err).toBeInstanceOf(PropertiesError);
    return (err as PropertiesError).code;
  }
}

describe("properties service", () => {
  it("creates a property for a host, rejecting non-hosts", async () => {
    const { store } = makeFakes();
    const property = await createProperty(store, clock, {
      hostId: HOST,
      hostRole: "host",
      input: {
        name: "Beach Studio",
        address: "Calle Falsa 123",
        latitude: 40.4168,
        longitude: -3.7038,
      },
    });
    expect(property.hostId).toBe(HOST);
    expect(property.sizeSqm).toBeNull();
    expect(
      await captureCode(
        createProperty(store, clock, {
          hostId: HOST,
          hostRole: "cleaner",
          input: {
            name: "x",
            address: "x",
            latitude: 0,
            longitude: 0,
          },
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("lists only the caller's own properties, archived filtered by default", async () => {
    const mine = makeProperty({ hostId: HOST });
    const mineArchived = makeProperty({
      hostId: HOST,
      archivedAt: "2026-01-02T00:00:00.000Z",
    });
    const someoneElses = makeProperty({ hostId: STRANGER });
    const { store } = makeFakes([mine, mineArchived, someoneElses]);
    const active = await listProperties(store, {
      hostId: HOST,
      hostRole: "host",
      includeArchived: false,
    });
    expect(active.map((p) => p.id)).toEqual([mine.id]);
    const all = await listProperties(store, {
      hostId: HOST,
      hostRole: "host",
      includeArchived: true,
    });
    expect(all.map((p) => p.id).sort()).toEqual(
      [mine.id, mineArchived.id].sort(),
    );
  });

  it("updates only fields given, and only the owner may update", async () => {
    const property = makeProperty();
    const { store } = makeFakes([property]);
    const updated = await updateProperty(store, clock, {
      hostId: HOST,
      hostRole: "host",
      input: { propertyId: property.id, name: "New Name" },
    });
    expect(updated.name).toBe("New Name");
    expect(updated.address).toBe(property.address);
    expect(
      await captureCode(
        updateProperty(store, clock, {
          hostId: STRANGER,
          hostRole: "host",
          input: { propertyId: property.id, name: "Stolen" },
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("archives a property; only the owner may archive", async () => {
    const property = makeProperty();
    const { store } = makeFakes([property]);
    const archived = await archiveProperty(store, clock, {
      hostId: HOST,
      hostRole: "host",
      propertyId: property.id,
    });
    expect(archived.archivedAt).not.toBeNull();
    expect(
      await captureCode(
        archiveProperty(store, clock, {
          hostId: STRANGER,
          hostRole: "host",
          propertyId: property.id,
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("requireActivePropertyForJob rejects a stranger's or an archived property", async () => {
    const active = makeProperty();
    const archived = makeProperty({ archivedAt: "2026-01-02T00:00:00.000Z" });
    const { store } = makeFakes([active, archived]);
    const ok = await requireActivePropertyForJob(store, {
      hostId: HOST,
      propertyId: active.id,
    });
    expect(ok.id).toBe(active.id);
    expect(
      await captureCode(
        requireActivePropertyForJob(store, {
          hostId: HOST,
          propertyId: archived.id,
        }),
      ),
    ).toBe("VALIDATION_ERROR");
    expect(
      await captureCode(
        requireActivePropertyForJob(store, {
          hostId: STRANGER,
          propertyId: active.id,
        }),
      ),
    ).toBe("FORBIDDEN");
  });
});
