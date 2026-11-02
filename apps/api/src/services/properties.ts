// Framework-free business logic: no drizzle/fastify imports allowed here.
// A host's cleaning properties (03 E): added once, picked on every job for
// it. Archived rather than deleted once a job references it, so job
// history never dangles on a missing property.
import { randomUUID } from "node:crypto";
import type {
  CreatePropertyInput,
  Property,
  SparklErrorCode,
  UpdatePropertyInput,
  UserRole,
} from "@sparkl/shared";

export class PropertiesError extends Error {
  readonly code: SparklErrorCode;

  constructor(code: SparklErrorCode, message: string) {
    super(message);
    this.name = "PropertiesError";
    this.code = code;
  }
}

export interface PropertiesStore {
  insert(property: Property): Promise<Property>;
  findById(id: string): Promise<Property | null>;
  listByHost(hostId: string, includeArchived: boolean): Promise<Property[]>;
  save(property: Property): Promise<Property>;
  /** Whether any job still references this property (blocks a hard delete). */
  isReferencedByAJob(propertyId: string): Promise<boolean>;
}

export interface Clock {
  nowIso(): string;
}

async function requireOwnedProperty(
  store: PropertiesStore,
  propertyId: string,
  hostId: string,
): Promise<Property> {
  const property = await store.findById(propertyId);
  if (property === null) {
    throw new PropertiesError("NOT_FOUND", "Property not found.");
  }
  if (property.hostId !== hostId) {
    throw new PropertiesError(
      "FORBIDDEN",
      "Only the property's host can act on it.",
    );
  }
  return property;
}

function requireHostRole(role: UserRole | null): void {
  if (role !== "host") {
    throw new PropertiesError("FORBIDDEN", "Only hosts have properties.");
  }
}

export async function createProperty(
  store: PropertiesStore,
  clock: Clock,
  args: {
    hostId: string;
    hostRole: UserRole | null;
    input: CreatePropertyInput;
  },
): Promise<Property> {
  requireHostRole(args.hostRole);
  const now = clock.nowIso();
  return store.insert({
    id: randomUUID(),
    hostId: args.hostId,
    name: args.input.name,
    address: args.input.address,
    latitude: args.input.latitude,
    longitude: args.input.longitude,
    sizeSqm: args.input.sizeSqm ?? null,
    defaultNotes: args.input.defaultNotes ?? null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function listProperties(
  store: PropertiesStore,
  args: {
    hostId: string;
    hostRole: UserRole | null;
    includeArchived: boolean;
  },
): Promise<Property[]> {
  requireHostRole(args.hostRole);
  return store.listByHost(args.hostId, args.includeArchived);
}

export async function updateProperty(
  store: PropertiesStore,
  clock: Clock,
  args: {
    hostId: string;
    hostRole: UserRole | null;
    input: UpdatePropertyInput;
  },
): Promise<Property> {
  requireHostRole(args.hostRole);
  const existing = await requireOwnedProperty(
    store,
    args.input.propertyId,
    args.hostId,
  );
  const updated: Property = {
    ...existing,
    name: args.input.name ?? existing.name,
    address: args.input.address ?? existing.address,
    latitude: args.input.latitude ?? existing.latitude,
    longitude: args.input.longitude ?? existing.longitude,
    sizeSqm:
      args.input.sizeSqm === undefined ? existing.sizeSqm : args.input.sizeSqm,
    defaultNotes:
      args.input.defaultNotes === undefined
        ? existing.defaultNotes
        : args.input.defaultNotes,
    updatedAt: clock.nowIso(),
  };
  return store.save(updated);
}

// Archive is the only way to remove a property once any job references it;
// a never-used property could be hard-deleted, but archiving is simpler
// and keeps one code path.
export async function archiveProperty(
  store: PropertiesStore,
  clock: Clock,
  args: { hostId: string; hostRole: UserRole | null; propertyId: string },
): Promise<Property> {
  requireHostRole(args.hostRole);
  const existing = await requireOwnedProperty(
    store,
    args.propertyId,
    args.hostId,
  );
  return store.save({
    ...existing,
    archivedAt: clock.nowIso(),
    updatedAt: clock.nowIso(),
  });
}

// Called by jobs.create (03 E) when the host picked a property: re-checks
// ownership and that it is not archived, then hands back the fields the
// job snapshots onto itself.
export async function requireActivePropertyForJob(
  store: PropertiesStore,
  args: { hostId: string; propertyId: string },
): Promise<Property> {
  const property = await requireOwnedProperty(
    store,
    args.propertyId,
    args.hostId,
  );
  if (property.archivedAt !== null) {
    throw new PropertiesError(
      "VALIDATION_ERROR",
      "This property has been archived.",
    );
  }
  return property;
}
