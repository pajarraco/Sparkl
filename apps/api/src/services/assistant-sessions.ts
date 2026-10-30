// Framework-free business logic: no drizzle/fastify imports allowed here.
// Assistant session records (02 learning). A session is opened by its first
// turn (or by finish, when the host left before sending anything), counted
// on every turn and closed once with an outcome. Only counts and draft field
// names are stored, never message text. The session id comes from the
// client, so every write is pinned to the calling host and to an open row.
import { randomUUID } from "node:crypto";
import {
  type AssistantFinishInput,
  type JobDraftField,
  SPARKL_ERROR_CODES,
  type SparklErrorCode,
} from "@sparkl/shared";
import type { Clock, JobsStore } from "./jobs.js";
import { type UserRateLimiter, createUserRateLimiter } from "./rate-limit.js";
import { recordReviewFormVotes } from "./solution-feedback.js";
import { recordFinishOffers } from "./solution-offers.js";
import type { SolutionsStore } from "./solutions-store.js";

export class AssistantSessionError extends Error {
  readonly code: SparklErrorCode;

  constructor(code: SparklErrorCode, message: string) {
    super(message);
    this.name = "AssistantSessionError";
    this.code = code;
  }
}

export interface AssistantTurnStats {
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  modelFilled: JobDraftField[];
}

// One finished session's learning counts: what the model filled vs what the
// host changed on the review form. Backs the correction-rate prompt hints.
export interface SessionCorrections {
  modelFilled: JobDraftField[];
  hostChanged: JobDraftField[];
}

export interface AssistantSessionsStore {
  // Inserts the session, or counts one more turn on it. False when the id
  // belongs to another host or the session is already finished. Atomic.
  openTurn(args: {
    id: string;
    hostId: string;
    model: string;
    nowIso: string;
  }): Promise<boolean>;
  // Adds the turn's counts and unions modelFilled; open rows of hostId only.
  recordTurn(
    id: string,
    hostId: string,
    stats: AssistantTurnStats,
  ): Promise<void>;
  // Finished sessions of one host, newest first, for correction-rate
  // hints. Counts and field names only, never message text.
  listFinishedByHost(hostId: string): Promise<SessionCorrections[]>;
  // What the model filled in this session, and whether it is still open. Null
  // when the session is not hostId's, so ids cannot be probed.
  sessionFills(
    id: string,
    hostId: string,
  ): Promise<{ open: boolean; modelFilled: JobDraftField[] } | null>;
  // Reserves one solution save for an open session of hostId. Atomic: the
  // row is updated only while it is under `max`. False at the cap, for
  // another host's session, or once the session is finished.
  reserveSolutionSave(args: {
    id: string;
    hostId: string;
    max: number;
  }): Promise<boolean>;
  // Closes the session (inserting it when it never had a turn). False when
  // the id belongs to another host or the session is already finished.
  finish(args: {
    id: string;
    hostId: string;
    outcome: AssistantFinishInput["outcome"];
    jobId: string | null;
    hostChanged: JobDraftField[];
    nowIso: string;
  }): Promise<boolean>;
}

export const FINISH_LIMITS = {
  perWindow: 30,
  windowMs: 10 * 60 * 1000,
} as const;

const defaultFinishLimiter = createUserRateLimiter({
  limit: FINISH_LIMITS.perWindow,
  windowMs: FINISH_LIMITS.windowMs,
});

function notFound(message: string): AssistantSessionError {
  return new AssistantSessionError(SPARKL_ERROR_CODES.NOT_FOUND, message);
}

export async function finishAssistantSession(
  stores: {
    sessions: AssistantSessionsStore;
    jobs: Pick<JobsStore, "findJobById">;
    solutions?: SolutionsStore;
  },
  clock: Clock,
  args: AssistantFinishInput & { hostId: string },
  limiter: UserRateLimiter = defaultFinishLimiter,
): Promise<void> {
  limiter.consume(args.hostId);
  let usualCleanerPinned = false;
  if (args.jobId !== undefined) {
    // Same answer for a missing job and someone else's, so ids can't be
    // probed.
    const job = await stores.jobs.findJobById(args.jobId);
    if (job === null || job.hostId !== args.hostId) {
      throw notFound("job not found");
    }
    usualCleanerPinned = Boolean(job.preferredCleanerId);
  }
  // Read before closing: what the model filled is needed for the votes.
  const fills =
    stores.solutions && args.outcome === "posted"
      ? await stores.sessions.sessionFills(args.sessionId, args.hostId)
      : null;
  const finished = await stores.sessions.finish({
    id: args.sessionId,
    hostId: args.hostId,
    outcome: args.outcome,
    jobId: args.jobId ?? null,
    hostChanged: [...new Set(args.hostChanged)].sort(),
    nowIso: clock.nowIso(),
  });
  if (!finished) throw notFound("no open assistant session");

  if (stores.solutions && args.outcome === "posted") {
    try {
      await recordFinishOffers(stores.solutions, {
        hostId: args.hostId,
        sessionId: args.sessionId,
        priceHintResponse: args.priceHintResponse,
        usualCleanerPinned,
        at: new Date(clock.nowIso()),
        newId: randomUUID,
      });
    } catch {
      // Best effort, as for the review-form votes above.
    }
  }

  if (stores.solutions && fills?.open) {
    try {
      await recordReviewFormVotes(
        { solutions: stores.solutions },
        {
          sessionId: args.sessionId,
          hostId: args.hostId,
          modelFilled: fills.modelFilled,
          hostChanged: args.hostChanged,
          at: new Date(clock.nowIso()),
        },
      );
    } catch {
      // Best effort: the job is posted and the session closed. A failed
      // vote only means this session teaches nothing.
    }
  }
}
