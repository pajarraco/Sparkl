import type {
  CleanerAvailability,
  Job,
  JobDraftField,
  JobRequest,
  JobStatus,
  Message,
  Review,
  SolutionTag,
  User,
} from "@sparkl/shared";
import {
  jobDraftFieldSchema,
  solutionKindSchema,
  solutionScopeSchema,
  solutionSourceSchema,
  solutionStatusSchema,
  solutionTagSchema,
} from "@sparkl/shared";
import { and, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { AssistantSessionsStore } from "../services/assistant-sessions.js";
import { ChatError, type ChatStore } from "../services/chat.js";
import {
  JobRequestsError,
  type JobRequestsStore,
} from "../services/job-requests.js";
import {
  type Clock,
  JobsServiceError,
  type JobsStore,
} from "../services/jobs.js";
import type { MessagesRead } from "../services/matching.js";
import { ReviewsError, type ReviewsStore } from "../services/reviews.js";
import type {
  NewSolution,
  SolutionEventInput,
  SolutionRow,
  SolutionsStore,
} from "../services/solutions-store.js";
import type { ProfilePatch, UsersStore } from "../services/users.js";
import type { Db } from "./client.js";
import {
  assistantSessions,
  assistantSolutionEvents,
  assistantSolutions,
  cleanerAvailability,
  jobRequests,
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
    preferredCleanerId: row.preferredCleanerId,
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
          preferredCleanerId: job.preferredCleanerId ?? null,
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

    async listJobsForPricing() {
      // Every job, any status: only aggregates leave the price-hint service.
      const rows = await db.select().from(jobs);
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

// Every write is one statement whose WHERE pins the row to the calling host
// and to an open session, so a guessed or replayed session id can't touch
// another host's record or reopen a finished one.
export function drizzleAssistantSessionsStore(db: Db): AssistantSessionsStore {
  const t = assistantSessions;
  const ownOpen = (hostId: string) =>
    sql`${t.hostId} = ${hostId} and ${t.outcome} is null`;
  return {
    async openTurn({ id, hostId, model, nowIso }) {
      const rows = await db
        .insert(t)
        .values({ id, hostId, model, turns: 1, createdAt: new Date(nowIso) })
        .onConflictDoUpdate({
          target: t.id,
          set: { turns: sql`${t.turns} + 1`, model },
          setWhere: ownOpen(hostId),
        })
        .returning({ id: t.id });
      return rows.length === 1;
    },

    async recordTurn(id, hostId, stats) {
      const filled = sql.join(
        stats.modelFilled.map((field) => sql`${field}`),
        sql`, `,
      );
      await db
        .update(t)
        .set({
          toolCalls: sql`${t.toolCalls} + ${stats.toolCalls}`,
          inputTokens: sql`${t.inputTokens} + ${stats.inputTokens}`,
          outputTokens: sql`${t.outputTokens} + ${stats.outputTokens}`,
          latencyMs: sql`${t.latencyMs} + ${stats.latencyMs}`,
          modelFilled: sql`array(select distinct unnest(${t.modelFilled} || ARRAY[${filled}]::text[]) order by 1)`,
        })
        .where(and(eq(t.id, id), ownOpen(hostId)));
    },

    async sessionFills(id, hostId) {
      const [row] = await db
        .select({ outcome: t.outcome, modelFilled: t.modelFilled })
        .from(t)
        .where(and(eq(t.id, id), eq(t.hostId, hostId)))
        .limit(1);
      if (!row) return null;
      const fields = row.modelFilled.filter(
        (value): value is JobDraftField =>
          jobDraftFieldSchema.safeParse(value).success,
      );
      return { open: row.outcome === null, modelFilled: fields };
    },

    async reserveSolutionSave({ id, hostId, max }) {
      const rows = await db
        .update(t)
        .set({ solutionSaves: sql`${t.solutionSaves} + 1` })
        .where(
          and(eq(t.id, id), ownOpen(hostId), sql`${t.solutionSaves} < ${max}`),
        )
        .returning({ id: t.id });
      return rows.length === 1;
    },

    async listFinishedByHost(hostId) {
      const rows = await db
        .select({ modelFilled: t.modelFilled, hostChanged: t.hostChanged })
        .from(t)
        .where(and(eq(t.hostId, hostId), isNotNull(t.outcome)))
        .orderBy(desc(t.createdAt))
        .limit(20);
      // Rows are written by our own session paths, but field names are
      // re-checked so a foreign or legacy value can never reach the prompt.
      const fields = (values: string[]): JobDraftField[] =>
        values.filter(
          (value): value is JobDraftField =>
            jobDraftFieldSchema.safeParse(value).success,
        );
      return rows.map((row) => ({
        modelFilled: fields(row.modelFilled),
        hostChanged: fields(row.hostChanged),
      }));
    },

    async finish({ id, hostId, outcome, jobId, hostChanged, nowIso }) {
      const finishedAt = new Date(nowIso);
      const rows = await db
        .insert(t)
        .values({
          id,
          hostId,
          outcome,
          jobId,
          hostChanged,
          createdAt: finishedAt,
          finishedAt,
        })
        .onConflictDoUpdate({
          target: t.id,
          set: { outcome, jobId, hostChanged, finishedAt },
          setWhere: ownOpen(hostId),
        })
        .returning({ id: t.id });
      return rows.length === 1;
    },
  };
}

type SolutionRecord = typeof assistantSolutions.$inferSelect;

// Re-checks the closed enums on every read, so a foreign or legacy value
// can never reach the ranking or the prompt. Unknown values drop the row.
function toSolutionRow(record: SolutionRecord): SolutionRow | null {
  const scope = solutionScopeSchema.safeParse(record.scope);
  const kind = solutionKindSchema.safeParse(record.kind);
  const source = solutionSourceSchema.safeParse(record.source);
  const status = solutionStatusSchema.safeParse(record.status);
  if (!scope.success || !kind.success || !source.success || !status.success) {
    return null;
  }
  const tags = record.tags.filter(
    (tag): tag is SolutionTag => solutionTagSchema.safeParse(tag).success,
  );
  return {
    id: record.id,
    scope: scope.data,
    hostId: record.hostId,
    kind: kind.data,
    tags,
    payload: record.payload,
    fingerprint: record.fingerprint,
    source: source.data,
    status: status.data,
    proposed: record.proposed,
    accepted: record.accepted,
    rejected: record.rejected,
    score: record.score,
    lastAcceptedAt: record.lastAcceptedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function drizzleSolutionsStore(db: Db): SolutionsStore {
  const s = assistantSolutions;
  const e = assistantSolutionEvents;
  const rowsOf = (records: SolutionRecord[]): SolutionRow[] =>
    records.flatMap((record) => {
      const row = toSolutionRow(record);
      return row ? [row] : [];
    });

  return {
    async insert(row: NewSolution) {
      const inserted = await db
        .insert(s)
        .values({
          id: row.id,
          scope: row.scope,
          hostId: row.hostId,
          kind: row.kind,
          tags: row.tags,
          payload: row.payload,
          fingerprint: row.fingerprint,
          source: row.source,
          status: row.status,
          createdAt: row.at,
          updatedAt: row.at,
        })
        .onConflictDoNothing()
        .returning({ id: s.id });
      return inserted.length === 1;
    },

    async findById(id) {
      const [record] = await db.select().from(s).where(eq(s.id, id)).limit(1);
      return record ? toSolutionRow(record) : null;
    },

    async findByFingerprint(scope, hostId, fingerprint) {
      if (scope === "host" && hostId === null) return null;
      const where =
        scope === "host"
          ? and(
              eq(s.scope, "host"),
              eq(s.hostId, hostId ?? ""),
              eq(s.fingerprint, fingerprint),
            )
          : and(eq(s.scope, "global"), eq(s.fingerprint, fingerprint));
      const [record] = await db.select().from(s).where(where).limit(1);
      return record ? toSolutionRow(record) : null;
    },

    async listForHost(hostId, kind) {
      const records = await db
        .select()
        .from(s)
        .where(
          and(
            eq(s.kind, kind),
            sql`(${s.scope} = 'global' or ${s.hostId} = ${hostId})`,
          ),
        );
      return rowsOf(records);
    },

    async rejectedByHost(hostId) {
      const rows = await db
        .selectDistinct({ solutionId: e.solutionId })
        .from(e)
        .where(and(eq(e.hostId, hostId), eq(e.event, "rejected")));
      return rows.map((row) => row.solutionId);
    },

    async recordEvent(event: SolutionEventInput) {
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(e)
          .values({
            id: event.id,
            solutionId: event.solutionId,
            sessionId: event.sessionId,
            hostId: event.hostId,
            event: event.event,
            at: event.at,
          })
          .onConflictDoNothing()
          .returning({ id: e.id });
        if (inserted.length === 0) return false;
        const counter = {
          proposed: sql`${s.proposed} + 1`,
          accepted: sql`${s.accepted} + 1`,
          rejected: sql`${s.rejected} + 1`,
        }[event.event];
        await tx
          .update(s)
          .set({
            [event.event]: counter,
            ...(event.event === "accepted" ? { lastAcceptedAt: event.at } : {}),
            updatedAt: event.at,
          })
          .where(eq(s.id, event.solutionId));
        return true;
      });
    },

    async acceptingHostIds(fingerprint) {
      // Only hosts with at least one posted job count toward sharing, so a
      // throwaway account cannot promote an answer on its own.
      const rows = await db
        .selectDistinct({ hostId: e.hostId })
        .from(e)
        .innerJoin(s, eq(s.id, e.solutionId))
        .where(
          and(
            eq(s.fingerprint, fingerprint),
            eq(e.event, "accepted"),
            sql`exists (select 1 from ${jobs} where ${jobs.hostId} = ${e.hostId})`,
          ),
        );
      return rows.map((row) => row.hostId);
    },

    async proposedSolutionIds(sessionId, hostId) {
      const rows = await db
        .selectDistinct({ solutionId: e.solutionId })
        .from(e)
        .where(
          and(
            eq(e.sessionId, sessionId),
            eq(e.hostId, hostId),
            eq(e.event, "proposed"),
          ),
        );
      return rows.map((row) => row.solutionId);
    },

    async votedSolutionIds(sessionId) {
      const rows = await db
        .selectDistinct({ solutionId: e.solutionId })
        .from(e)
        .where(
          and(
            eq(e.sessionId, sessionId),
            inArray(e.event, ["accepted", "rejected"]),
          ),
        );
      return rows.map((row) => row.solutionId);
    },

    async hostHasVoted(solutionId, hostId) {
      const rows = await db
        .select({ id: e.id })
        .from(e)
        .where(
          and(
            eq(e.solutionId, solutionId),
            eq(e.hostId, hostId),
            inArray(e.event, ["accepted", "rejected"]),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },

    async recentVotes(solutionId, n) {
      const rows = await db
        .select({ event: e.event })
        .from(e)
        .where(
          and(
            eq(e.solutionId, solutionId),
            inArray(e.event, ["accepted", "rejected"]),
          ),
        )
        .orderBy(desc(e.at))
        .limit(n);
      return rows.map((row) =>
        row.event === "accepted" ? "accepted" : "rejected",
      );
    },

    async setScore(id, score, at) {
      await db.update(s).set({ score, updatedAt: at }).where(eq(s.id, id));
    },

    async setStatus(id, status, at) {
      await db.update(s).set({ status, updatedAt: at }).where(eq(s.id, id));
    },
  };
}

function toJobRequest(row: typeof jobRequests.$inferSelect): JobRequest {
  return {
    id: row.id,
    jobId: row.jobId,
    cleanerId: row.cleanerId,
    initiatedBy: row.initiatedBy as JobRequest["initiatedBy"],
    status: row.status as JobRequest["status"],
    createdAt: row.createdAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
  };
}

export function drizzleJobRequestsStore(db: Db): JobRequestsStore {
  return {
    async insertRequest(request) {
      const [row] = await db
        .insert(jobRequests)
        .values({
          id: request.id,
          jobId: request.jobId,
          cleanerId: request.cleanerId,
          initiatedBy: request.initiatedBy,
          status: request.status,
          createdAt: new Date(request.createdAt),
          respondedAt: request.respondedAt
            ? new Date(request.respondedAt)
            : null,
        })
        .returning();
      if (!row) {
        throw new JobRequestsError("NOT_FOUND", "Request insert failed.");
      }
      return toJobRequest(row);
    },

    async findRequestById(id) {
      const [row] = await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.id, id))
        .limit(1);
      return row ? toJobRequest(row) : null;
    },

    async findPendingByJobAndCleaner(jobId, cleanerId) {
      const [row] = await db
        .select()
        .from(jobRequests)
        .where(
          and(
            eq(jobRequests.jobId, jobId),
            eq(jobRequests.cleanerId, cleanerId),
            eq(jobRequests.status, "pending"),
          ),
        )
        .limit(1);
      return row ? toJobRequest(row) : null;
    },

    async listByJob(jobId) {
      const rows = await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.jobId, jobId));
      return rows.map(toJobRequest);
    },

    async listByCleaner(cleanerId) {
      const rows = await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.cleanerId, cleanerId));
      return rows.map(toJobRequest);
    },

    async countPendingOffersForJob(jobId) {
      const [row] = await db
        .select({ value: count() })
        .from(jobRequests)
        .where(
          and(
            eq(jobRequests.jobId, jobId),
            eq(jobRequests.initiatedBy, "host"),
            eq(jobRequests.status, "pending"),
          ),
        );
      return row?.value ?? 0;
    },

    async countPendingRequestsForCleaner(cleanerId) {
      const [row] = await db
        .select({ value: count() })
        .from(jobRequests)
        .where(
          and(
            eq(jobRequests.cleanerId, cleanerId),
            eq(jobRequests.initiatedBy, "cleaner"),
            eq(jobRequests.status, "pending"),
          ),
        );
      return row?.value ?? 0;
    },

    // One transaction: re-check job open + request pending, claim the job,
    // accept this request, close every other pending request on the job.
    // The loser of a concurrent accept throws from the re-check below.
    async acceptRequest({ requestId, jobId, cleanerId, nowIso }) {
      const now = new Date(nowIso);
      const result = await db.transaction(async (tx) => {
        const [claimedJob] = await tx
          .update(jobs)
          .set({
            status: "claimed",
            claimedByCleanerId: cleanerId,
            updatedAt: now,
          })
          .where(and(eq(jobs.id, jobId), eq(jobs.status, "open")))
          .returning();
        if (!claimedJob) return null;
        const [acceptedRequest] = await tx
          .update(jobRequests)
          .set({ status: "accepted", respondedAt: now })
          .where(
            and(
              eq(jobRequests.id, requestId),
              eq(jobRequests.status, "pending"),
            ),
          )
          .returning();
        if (!acceptedRequest) return null;
        await tx
          .update(jobRequests)
          .set({ status: "closed", respondedAt: now })
          .where(
            and(
              eq(jobRequests.jobId, jobId),
              eq(jobRequests.status, "pending"),
            ),
          );
        return { job: claimedJob, request: acceptedRequest };
      });
      if (result) {
        return {
          job: toJob(result.job),
          request: toJobRequest(result.request),
        };
      }
      const [currentJob] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      if (!currentJob) {
        throw new JobRequestsError("NOT_FOUND", "Job not found.");
      }
      if (currentJob.status === "claimed") {
        throw new JobRequestsError(
          "JOB_ALREADY_CLAIMED",
          "Job was already claimed.",
        );
      }
      if (currentJob.status !== "open") {
        throw new JobRequestsError(
          "JOB_NOT_OPEN",
          `Job is ${currentJob.status}, not open.`,
        );
      }
      throw new JobRequestsError(
        "JOB_REQUEST_NOT_PENDING",
        "Request is no longer pending.",
      );
    },

    async updateStatus({ requestId, status, respondedAt }) {
      const [row] = await db
        .update(jobRequests)
        .set({ status, respondedAt: new Date(respondedAt) })
        .where(
          and(eq(jobRequests.id, requestId), eq(jobRequests.status, "pending")),
        )
        .returning();
      return row ? toJobRequest(row) : null;
    },

    async closeAllPendingForJob(jobId) {
      await db
        .update(jobRequests)
        .set({ status: "closed", respondedAt: new Date() })
        .where(
          and(eq(jobRequests.jobId, jobId), eq(jobRequests.status, "pending")),
        );
    },
  };
}
