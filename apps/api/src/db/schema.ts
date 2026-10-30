import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Single-table choice: role + Sparkl profile columns live on Better Auth's
// `user` table (no separate profile table, no join on session lookup).
// `image` is Better Auth's column name; services map it to shared `photoUrl`.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull(), // shared userRoleSchema: "host" | "cleaner"
  serviceLat: doublePrecision("service_lat"),
  serviceLng: doublePrecision("service_lng"),
  serviceRadiusKm: doublePrecision("service_radius_km"),
  avgRating: doublePrecision("avg_rating"),
  completedJobCount: integer("completed_job_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
    mode: "date",
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
    mode: "date",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const cleanerAvailability = pgTable(
  "cleaner_availability",
  {
    cleanerId: text("cleaner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(), // 0-6, see shared availability.ts
    startTime: text("start_time").notNull(), // "HH:MM"
    endTime: text("end_time").notNull(), // "HH:MM"
  },
  (t) => [primaryKey({ columns: [t.cleanerId, t.weekday, t.startTime] })],
);

export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    windowStart: timestamp("window_start", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    windowEnd: timestamp("window_end", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    sizeSqm: doublePrecision("size_sqm"),
    notes: text("notes"),
    priceMinorUnits: integer("price_minor_units").notNull(),
    status: text("status").notNull().default("open"), // shared jobStatusSchema
    claimedByCleanerId: text("claimed_by_cleaner_id").references(
      () => user.id,
      {
        onDelete: "set null",
      },
    ),
    // The host's usual cleaner, pinned by the assistant (02 P2). A hint only:
    // it never assigns the job.
    preferredCleanerId: text("preferred_cleaner_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("jobs_status_window_idx").on(t.status, t.windowStart)],
);

// A cleaner's request or a host's offer on one job (03 D). At most one
// pending row per (job, cleaner): mutual interest resolves by accepting
// the other side's existing row instead of inserting a second one.
export const jobRequests = pgTable(
  "job_requests",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    cleanerId: text("cleaner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    initiatedBy: text("initiated_by").notNull(), // "host" | "cleaner"
    status: text("status").notNull().default("pending"), // shared jobRequestStatusSchema
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    respondedAt: timestamp("responded_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (t) => [
    index("job_requests_job_idx").on(t.jobId),
    index("job_requests_cleaner_idx").on(t.cleanerId),
    uniqueIndex("job_requests_job_cleaner_pending_unique")
      .on(t.jobId, t.cleanerId)
      .where(sql`${t.status} = 'pending'`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("messages_job_created_idx").on(t.jobId, t.createdAt)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stars: integer("stars").notNull(), // 1-5 enforced by shared reviewSchema
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("reviews_subject_idx").on(t.subjectId),
    uniqueIndex("reviews_job_author_unique").on(t.jobId, t.authorId),
  ],
);

// Post-tab assistant learning (02). Counts and draft field names only:
// never message text, addresses or prices. The id is the client's session
// uuid; host_id pins it to one host. outcome is null while the session is
// open (shared assistantOutcomeSchema once finished).
export const assistantSessions = pgTable(
  "assistant_sessions",
  {
    id: text("id").primaryKey(),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    model: text("model"),
    turns: integer("turns").notNull().default(0),
    toolCalls: integer("tool_calls").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    modelFilled: text("model_filled")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    hostChanged: text("host_changed")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    outcome: text("outcome"),
    // Solutions saved in this session (04), capped by reserveSolutionSave.
    solutionSaves: integer("solution_saves").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("assistant_sessions_host_idx").on(t.hostId, t.createdAt)],
);

// Solutions store (04 L1). `payload` is checked against the shared Zod
// schema for its kind on every write and read. No message text is stored.
export const assistantSolutions = pgTable(
  "assistant_solutions",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull(), // shared solutionScopeSchema: "host" | "global"
    hostId: text("host_id").references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // shared solutionKindSchema
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    payload: jsonb("payload").notNull(),
    fingerprint: text("fingerprint").notNull(),
    source: text("source").notNull(), // shared solutionSourceSchema
    status: text("status").notNull().default("candidate"), // shared solutionStatusSchema
    proposed: integer("proposed").notNull().default(0),
    accepted: integer("accepted").notNull().default(0),
    rejected: integer("rejected").notNull().default(0),
    score: doublePrecision("score").notNull().default(0),
    lastAcceptedAt: timestamp("last_accepted_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("assistant_solutions_kind_status_idx").on(t.kind, t.status),
    index("assistant_solutions_tags_idx").using("gin", t.tags),
    uniqueIndex("assistant_solutions_host_fingerprint_unique")
      .on(t.hostId, t.fingerprint)
      .where(sql`${t.scope} = 'host'`),
    uniqueIndex("assistant_solutions_global_fingerprint_unique")
      .on(t.fingerprint)
      .where(sql`${t.scope} = 'global'`),
  ],
);

// One row per (solution, session, event): the audit trail behind the
// counters, and the one-vote-per-session rule.
export const assistantSolutionEvents = pgTable(
  "assistant_solution_events",
  {
    id: text("id").primaryKey(),
    solutionId: text("solution_id")
      .notNull()
      .references(() => assistantSolutions.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => assistantSessions.id, { onDelete: "cascade" }),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    event: text("event").notNull(), // "proposed" | "accepted" | "rejected"
    at: timestamp("at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("assistant_solution_events_once_unique").on(
      t.solutionId,
      t.sessionId,
      t.event,
    ),
    index("assistant_solution_events_host_idx").on(t.hostId, t.solutionId),
  ],
);
