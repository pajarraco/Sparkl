// Framework-free business logic: no drizzle/fastify imports allowed here.
// Feedback for the solutions store (04 L1 step 5). Votes come only from the
// host's response: the "Use this" / "Not this" chips, and whether the host
// kept a proposed field on the review form when posting. The model never
// votes. Every vote goes through applyVote, so the rules live in one place.
import { randomUUID } from "node:crypto";
import {
  type AssistantFeedbackInput,
  type JobDraftField,
  SOLUTION_PAYLOAD_SCHEMAS,
  SOLUTION_RANKING_CONFIG,
  SPARKL_ERROR_CODES,
  type SolutionKind,
  type SolutionVote,
} from "@sparkl/shared";
import {
  AssistantSessionError,
  type AssistantSessionsStore,
} from "./assistant-sessions.js";
import type { Clock } from "./jobs.js";
import { type UserRateLimiter, createUserRateLimiter } from "./rate-limit.js";
import { shareAcceptedChecklist } from "./solution-sharing.js";
import type { SolutionRow, SolutionsStore } from "./solutions-store.js";

export const FEEDBACK_LIMITS = {
  perWindow: 60,
  windowMs: 10 * 60 * 1000,
} as const;

const defaultFeedbackLimiter = createUserRateLimiter({
  limit: FEEDBACK_LIMITS.perWindow,
  windowMs: FEEDBACK_LIMITS.windowMs,
});

function notFound(message: string): AssistantSessionError {
  return new AssistantSessionError(SPARKL_ERROR_CODES.NOT_FOUND, message);
}

// The draft fields a proposal of this kind sets, so the review form can say
// whether the host kept it. Offers with no review-form field (a usual
// cleaner pin, an FAQ) get chip votes only.
export function targetFieldsOf(
  kind: SolutionKind,
  payload: unknown,
): JobDraftField[] {
  if (kind === "checklist") return ["notes"];
  if (kind === "window_preference") return ["windowStart", "windowEnd"];
  if (kind === "offer_preference") {
    return (payload as { offer: string }).offer === "price_hint"
      ? ["price"]
      : [];
  }
  return [];
}

export interface VoteContext {
  store: SolutionsStore;
  solution: SolutionRow;
  sessionId: string;
  hostId: string;
  vote: SolutionVote;
  at: Date;
  newId: () => string;
}

// Records one vote and applies its status change. Global rows count one
// vote per host, so a host repeating their own checklist does not inflate
// it. A host candidate turns active on its first acceptance, and is retired
// after `retireAfterRejections` rejections in a row.
export async function applyVote(ctx: VoteContext): Promise<void> {
  const { store, solution, at } = ctx;
  if (
    solution.scope === "global" &&
    (await store.hostHasVoted(solution.id, ctx.hostId))
  ) {
    return;
  }
  const recorded = await store.recordEvent({
    id: ctx.newId(),
    solutionId: solution.id,
    sessionId: ctx.sessionId,
    hostId: ctx.hostId,
    event: ctx.vote,
    at,
  });
  if (!recorded) return;

  if (ctx.vote === "accepted") {
    if (solution.status === "candidate") {
      await store.setStatus(solution.id, "active", at);
    }
    await shareAcceptedChecklist(store, { solution, at, newId: ctx.newId });
    return;
  }
  if (ctx.vote === "rejected" && solution.scope === "host") {
    const recent = await store.recentVotes(
      solution.id,
      SOLUTION_RANKING_CONFIG.retireAfterRejections,
    );
    const streak =
      recent.length === SOLUTION_RANKING_CONFIG.retireAfterRejections &&
      recent.every((vote) => vote === "rejected");
    if (streak && solution.status !== "retired") {
      await store.setStatus(solution.id, "retired", at);
    }
  }
}

// POST jobAssistant.feedback: one chip tap. The session must be the caller's
// and still open, and the solution must have been proposed in it. Answers
// NOT_FOUND alike for the two, so ids cannot be probed.
export async function recordChipVote(
  stores: {
    solutions: SolutionsStore;
    sessions: Pick<AssistantSessionsStore, "sessionFills">;
  },
  clock: Clock,
  args: AssistantFeedbackInput & { hostId: string },
  limiter: UserRateLimiter = defaultFeedbackLimiter,
  newId: () => string = randomUUID,
): Promise<void> {
  limiter.consume(args.hostId);
  const fills = await stores.sessions.sessionFills(args.sessionId, args.hostId);
  if (!fills?.open) throw notFound("no open assistant session");

  const proposed = await stores.solutions.proposedSolutionIds(
    args.sessionId,
    args.hostId,
  );
  if (!proposed.includes(args.proposalId)) {
    throw notFound("proposal not found in this session");
  }
  // The first vote in a session stands; a later tap changes nothing.
  const voted = await stores.solutions.votedSolutionIds(args.sessionId);
  if (voted.includes(args.proposalId)) return;

  const solution = await stores.solutions.findById(args.proposalId);
  if (!solution) throw notFound("proposal not found in this session");
  await applyVote({
    store: stores.solutions,
    solution,
    sessionId: args.sessionId,
    hostId: args.hostId,
    vote: args.vote,
    at: new Date(clock.nowIso()),
    newId,
  });
}

// At jobAssistant.finish, after a posted job: for each proposal with no chip
// vote, the review form decides. A field the model filled and the host kept
// is an accepted vote; a field the model filled and the host changed is a
// rejected one. Abandoned or fell-back sessions never reach here.
export async function recordReviewFormVotes(
  stores: { solutions: SolutionsStore },
  args: {
    sessionId: string;
    hostId: string;
    modelFilled: readonly JobDraftField[];
    hostChanged: readonly JobDraftField[];
    at: Date;
  },
  newId: () => string = randomUUID,
): Promise<void> {
  const proposed = await stores.solutions.proposedSolutionIds(
    args.sessionId,
    args.hostId,
  );
  const voted = await stores.solutions.votedSolutionIds(args.sessionId);
  for (const solutionId of proposed) {
    if (voted.includes(solutionId)) continue;
    const solution = await stores.solutions.findById(solutionId);
    if (!solution) continue;
    const payload = SOLUTION_PAYLOAD_SCHEMAS[solution.kind].safeParse(
      solution.payload,
    );
    if (!payload.success) continue;

    const targets = targetFieldsOf(solution.kind, payload.data);
    const filled = targets.filter((field) => args.modelFilled.includes(field));
    if (filled.length === 0) continue;
    const changed = filled.some((field) => args.hostChanged.includes(field));
    await applyVote({
      store: stores.solutions,
      solution,
      sessionId: args.sessionId,
      hostId: args.hostId,
      vote: changed ? "rejected" : "accepted",
      at: args.at,
      newId,
    });
  }
}
