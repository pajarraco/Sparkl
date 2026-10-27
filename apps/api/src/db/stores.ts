import type { CleanerAvailability, Job, JobStatus, User } from "@sparkl/shared";
import { and, eq } from "drizzle-orm";
import {
  type Clock,
  JobsServiceError,
  type JobsStore,
} from "../services/jobs.js";
import type { ProfilePatch, UsersStore } from "../services/users.js";
import type { Db } from "./client.js";
import { cleanerAvailability, jobs, user } from "./schema.js";

export const systemClock: Clock = { nowIso: () => new Date().toISOString() };

function toJob(row: typeof jobs.$inferSelect): Job {
  return {
    id: row.id,
    hostId: row.hostId,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    windowStart: row.windowStart.toISOString(),
    windowEnd: row.windowEnd.toISOString(),
    sizeSqm: row.sizeSqm,
    notes: row.notes,
    priceMinorUnits: row.priceMinorUnits,
    status: row.status as JobStatus,
    claimedByCleanerId: row.claimedByCleanerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toUser(row: typeof user.$inferSelect): User {
  return {
    id: row.id,
    role: row.role as User["role"],
    name: row.name,
    photoUrl: row.image,
    serviceLat: row.serviceLat,
    serviceLng: row.serviceLng,
    serviceRadiusKm: row.serviceRadiusKm,
    avgRating: row.avgRating,
    completedJobCount: row.completedJobCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function drizzleJobsStore(db: Db): JobsStore {
  return {
    async insertJob(job) {
      const [row] = await db
        .insert(jobs)
        .values({
          id: job.id,
          hostId: job.hostId,
          address: job.address,
          latitude: job.latitude,
          longitude: job.longitude,
          windowStart: new Date(job.windowStart),
          windowEnd: new Date(job.windowEnd),
          sizeSqm: job.sizeSqm,
          notes: job.notes,
          priceMinorUnits: job.priceMinorUnits,
          status: job.status,
          claimedByCleanerId: job.claimedByCleanerId,
          createdAt: new Date(job.createdAt),
          updatedAt: new Date(job.updatedAt),
        })
        .returning();
      if (!row) throw new JobsServiceError("NOT_FOUND", "Job insert failed.");
      return toJob(row);
    },

    async findJobById(jobId) {
      const [row] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      return row ? toJob(row) : null;
    },

    async listOpenJobs() {
      const rows = await db.select().from(jobs).where(eq(jobs.status, "open"));
      return rows.map(toJob);
    },

    async listJobsByHost(hostId) {
      const rows = await db.select().from(jobs).where(eq(jobs.hostId, hostId));
      return rows.map(toJob);
    },

    async claimIfOpen(jobId, cleanerId, nowIso) {
      const claimed = await db.transaction(async (tx) => {
        const rows = await tx
          .update(jobs)
          .set({
            status: "claimed",
            claimedByCleanerId: cleanerId,
            updatedAt: new Date(nowIso),
          })
          .where(and(eq(jobs.id, jobId), eq(jobs.status, "open")))
          .returning();
        return rows[0] ?? null;
      });
      if (claimed) return toJob(claimed);
      const current = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      const row = current[0];
      if (!row) throw new JobsServiceError("NOT_FOUND", "Job not found.");
      if (row.status === "claimed") {
        throw new JobsServiceError(
          "JOB_ALREADY_CLAIMED",
          "Job was already claimed.",
        );
      }
      throw new JobsServiceError(
        "JOB_NOT_OPEN",
        `Job is ${row.status}, not open.`,
      );
    },

    async saveJob(job) {
      const [row] = await db
        .update(jobs)
        .set({
          address: job.address,
          latitude: job.latitude,
          longitude: job.longitude,
          windowStart: new Date(job.windowStart),
          windowEnd: new Date(job.windowEnd),
          sizeSqm: job.sizeSqm,
          notes: job.notes,
          priceMinorUnits: job.priceMinorUnits,
          status: job.status,
          claimedByCleanerId: job.claimedByCleanerId,
          updatedAt: new Date(job.updatedAt),
        })
        .where(eq(jobs.id, job.id))
        .returning();
      if (!row) throw new JobsServiceError("NOT_FOUND", "Job not found.");
      return toJob(row);
    },
  };
}

export function drizzleUsersStore(db: Db): UsersStore {
  return {
    async findById(userId) {
      const [row] = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      return row ? toUser(row) : null;
    },

    async update(userId, patch: ProfilePatch) {
      const set: Partial<typeof user.$inferInsert> = {};
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.photoUrl !== undefined) set.image = patch.photoUrl;
      if (patch.serviceLat !== undefined) set.serviceLat = patch.serviceLat;
      if (patch.serviceLng !== undefined) set.serviceLng = patch.serviceLng;
      if (patch.serviceRadiusKm !== undefined)
        set.serviceRadiusKm = patch.serviceRadiusKm;
      if (Object.keys(set).length === 0) {
        const [row] = await db
          .select()
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);
        return row ? toUser(row) : null;
      }
      const [row] = await db
        .update(user)
        .set(set)
        .where(eq(user.id, userId))
        .returning();
      return row ? toUser(row) : null;
    },

    async replaceAvailability(cleanerId, slots: CleanerAvailability[]) {
      return db.transaction(async (tx) => {
        await tx
          .delete(cleanerAvailability)
          .where(eq(cleanerAvailability.cleanerId, cleanerId));
        if (slots.length > 0) {
          await tx.insert(cleanerAvailability).values(
            slots.map((s) => ({
              cleanerId,
              weekday: s.weekday,
              startTime: s.startTime,
              endTime: s.endTime,
            })),
          );
        }
        const rows = await tx
          .select()
          .from(cleanerAvailability)
          .where(eq(cleanerAvailability.cleanerId, cleanerId));
        return rows.map((r) => ({
          cleanerId: r.cleanerId,
          weekday: r.weekday,
          startTime: r.startTime,
          endTime: r.endTime,
        }));
      });
    },

    async listAvailability(cleanerId) {
      const rows = await db
        .select()
        .from(cleanerAvailability)
        .where(eq(cleanerAvailability.cleanerId, cleanerId));
      return rows.map((r) => ({
        cleanerId: r.cleanerId,
        weekday: r.weekday,
        startTime: r.startTime,
        endTime: r.endTime,
      }));
    },
  };
}
