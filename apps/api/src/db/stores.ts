import type {
  CleanerAvailability,
  Job,
  JobStatus,
  Message,
  Review,
  User,
} from "@sparkl/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ChatError, type ChatStore } from "../services/chat.js";
import {
  type Clock,
  JobsServiceError,
  type JobsStore,
} from "../services/jobs.js";
import type { MessagesRead } from "../services/matching.js";
import { ReviewsError, type ReviewsStore } from "../services/reviews.js";
import type { ProfilePatch, UsersStore } from "../services/users.js";
import type { Db } from "./client.js";
import {
  cleanerAvailability,
  jobs,
  messages,
  reviews,
  user,
} from "./schema.js";

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

    async listJobsByCleaner(cleanerId) {
      const rows = await db
        .select()
        .from(jobs)
        .where(eq(jobs.claimedByCleanerId, cleanerId));
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
      if (patch.avgRating !== undefined) set.avgRating = patch.avgRating;
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

    async incrementCompletedJobs(userId) {
      // No Drizzle increment helper exists: a single UPDATE with a SQL
      // expression is the only race-free way to bump the counter.
      const [row] = await db
        .update(user)
        .set({ completedJobCount: sql`${user.completedJobCount} + 1` })
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

    async listCleaners() {
      const rows = await db.select().from(user).where(eq(user.role, "cleaner"));
      return rows.map(toUser);
    },
  };
}

function toMessage(row: typeof messages.$inferSelect): Message {
  return {
    id: row.id,
    jobId: row.jobId,
    senderId: row.senderId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

export function drizzleMessagesRead(db: Db): MessagesRead {
  return {
    async listMessagesByJob(jobId) {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.jobId, jobId));
      return rows.map(toMessage);
    },
  };
}

export function drizzleChatStore(db: Db): ChatStore {
  return {
    async listMessagesByJob(jobId) {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.jobId, jobId));
      return rows.map(toMessage);
    },

    async insertMessage(message) {
      const [row] = await db
        .insert(messages)
        .values({
          id: message.id,
          jobId: message.jobId,
          senderId: message.senderId,
          body: message.body,
          createdAt: new Date(message.createdAt),
        })
        .returning();
      if (!row) throw new ChatError("NOT_FOUND", "Message insert failed.");
      return toMessage(row);
    },

    // One row per job: DISTINCT ON keeps the newest message of each job
    // (messages_job_created_idx covers the ordering).
    async latestMessagesByJobs(jobIds) {
      if (jobIds.length === 0) return [];
      const rows = await db
        .selectDistinctOn([messages.jobId])
        .from(messages)
        .where(inArray(messages.jobId, jobIds))
        .orderBy(messages.jobId, desc(messages.createdAt));
      return rows.map(toMessage);
    },
  };
}

function toReview(row: typeof reviews.$inferSelect): Review {
  return {
    id: row.id,
    jobId: row.jobId,
    authorId: row.authorId,
    subjectId: row.subjectId,
    stars: row.stars,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
  };
}

export function drizzleReviewsStore(db: Db): ReviewsStore {
  return {
    async findReviewByJobAndAuthor(jobId, authorId) {
      const [row] = await db
        .select()
        .from(reviews)
        .where(and(eq(reviews.jobId, jobId), eq(reviews.authorId, authorId)))
        .limit(1);
      return row ? toReview(row) : null;
    },

    async insertReview(review) {
      const [row] = await db
        .insert(reviews)
        .values({
          id: review.id,
          jobId: review.jobId,
          authorId: review.authorId,
          subjectId: review.subjectId,
          stars: review.stars,
          comment: review.comment,
          createdAt: new Date(review.createdAt),
        })
        .returning();
      if (!row) throw new ReviewsError("NOT_FOUND", "Review insert failed.");
      return toReview(row);
    },

    async listReviewsBySubject(subjectId) {
      const rows = await db
        .select()
        .from(reviews)
        .where(eq(reviews.subjectId, subjectId));
      return rows.map(toReview);
    },
  };
}
