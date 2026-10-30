// Framework-free business logic: no drizzle/fastify imports allowed here.
// Pure rules for the solutions store (04 L1): ranking, the personal-data
// check run on every save, and the payload fingerprint used for sharing.
// Nothing here reads a database or the clock; callers pass `now`.
import { createHash } from "node:crypto";
import {
  SOLUTION_RANKING_CONFIG,
  type SolutionKind,
  type SolutionScope,
  type SolutionStatus,
  type SolutionTag,
} from "@sparkl/shared";

// Wilson score lower bound at SOLUTION_RANKING_CONFIG.wilsonZ. 9 of 10
// accepted beats 1 of 1, so one lucky vote cannot top the list.
export function wilsonLowerBound(accepted: number, total: number): number {
  if (total <= 0) return 0;
  const z = SOLUTION_RANKING_CONFIG.wilsonZ;
  const p = accepted / total;
  const z2n = (z * z) / total;
  const centre = p + z2n / 2;
  const margin = z * Math.sqrt((p * (1 - p) + z2n / 4) / total);
  return (centre - margin) / (1 + z2n);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Halves every recencyHalfLifeDays since the last acceptance, so stale
// answers fade. Never accepted means no recency to give.
export function recencyFactor(lastAcceptedAt: Date | null, now: Date): number {
  if (lastAcceptedAt === null) return 0;
  const days = Math.max(
    0,
    (now.getTime() - lastAcceptedAt.getTime()) / MS_PER_DAY,
  );
  return 0.5 ** (days / SOLUTION_RANKING_CONFIG.recencyHalfLifeDays);
}

export interface VoteCounts {
  accepted: number;
  rejected: number;
  lastAcceptedAt: Date | null;
}

// score = wilson(accepted, accepted + rejected) × recency. `proposed` is
// deliberately not an input: showing an answer often never raises it.
export function solutionScore(votes: VoteCounts, now: Date): number {
  return (
    wilsonLowerBound(votes.accepted, votes.accepted + votes.rejected) *
    recencyFactor(votes.lastAcceptedAt, now)
  );
}

export interface RankableSolution extends VoteCounts {
  id: string;
  kind: SolutionKind;
  scope: SolutionScope;
  hostId: string | null;
  status: SolutionStatus;
  tags: readonly SolutionTag[];
}

export interface RankRequest {
  hostId: string;
  kind: SolutionKind;
  tags: readonly SolutionTag[];
  now: Date;
  // Global rows this host has rejected are never proposed to them again.
  rejectedByHost: ReadonlySet<string>;
  limit?: number;
}

export interface RankedSolution<T extends RankableSolution> {
  solution: T;
  score: number;
}

function tagOverlap(
  wanted: readonly SolutionTag[],
  have: readonly SolutionTag[],
): number {
  return have.filter((tag) => wanted.includes(tag)).length;
}

// Host's own rows first, then global rows; each group by score, then by tag
// overlap. Other hosts' rows are never eligible, whatever their score.
export function rankSolutions<T extends RankableSolution>(
  solutions: readonly T[],
  request: RankRequest,
): RankedSolution<T>[] {
  const limit = request.limit ?? SOLUTION_RANKING_CONFIG.topK;
  const eligible = solutions.filter((s) => {
    if (s.kind !== request.kind || s.status !== "active") return false;
    if (s.scope === "host") return s.hostId === request.hostId;
    return !request.rejectedByHost.has(s.id);
  });
  const scored = eligible.map((solution) => ({
    solution,
    score: solutionScore(solution, request.now),
    overlap: tagOverlap(request.tags, solution.tags),
  }));
  scored.sort((a, b) => {
    const scopeOrder =
      Number(b.solution.scope === "host") - Number(a.solution.scope === "host");
    if (scopeOrder !== 0) return scopeOrder;
    if (b.score !== a.score) return b.score - a.score;
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    return a.solution.id < b.solution.id ? -1 : 1;
  });
  return scored
    .slice(0, limit)
    .map(({ solution, score }) => ({ solution, score }));
}

export const PERSONAL_DATA_REASONS = [
  "email",
  "url",
  "phone",
  "digits",
  "address",
  "name",
] as const;
export type PersonalDataReason = (typeof PERSONAL_DATA_REASONS)[number];

export type PersonalDataResult =
  | { ok: true }
  | { ok: false; reasons: PersonalDataReason[] };

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const URL_RE =
  /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|net|org|io|co|au|nz|uk|app|dev)\b/i;
// Any run of 4+ digits: codes, street numbers, years of a lockbox.
const DIGITS_RE = /\d{4}/;
// A loose run of digits with spaces, dashes, dots or brackets in between.
const PHONE_RUN_RE = /\+?\d(?:[\s().-]?\d){6,}/g;
const STREET_TYPES =
  "st|street|rd|road|ave|avenue|dr|drive|ln|lane|ct|court|pl|place|blvd|way|cres|crescent|tce|terrace";
const ADDRESS_RE = new RegExp(
  `\\b\\d+[a-z]?\\s+(?:[a-z'-]+\\s+){0,3}(?:${STREET_TYPES})\\b|\\b(?:${STREET_TYPES})\\.?\\s+\\d+\\b`,
  "i",
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Checks every string in a payload, and the host's and cleaners' names
// (known to the service from host memory). Conservative on purpose: a
// rejected save only asks the model to retry without personal details.
export function checkPersonalData(
  texts: readonly string[],
  knownNames: readonly string[],
): PersonalDataResult {
  const reasons = new Set<PersonalDataReason>();
  const names = knownNames
    .map((name) => name.trim())
    .filter((name) => name.length >= 2);

  for (const text of texts) {
    if (EMAIL_RE.test(text)) reasons.add("email");
    if (URL_RE.test(text)) reasons.add("url");
    if (DIGITS_RE.test(text)) reasons.add("digits");
    if (ADDRESS_RE.test(text)) reasons.add("address");
    for (const run of text.match(PHONE_RUN_RE) ?? []) {
      if (run.replace(/\D/g, "").length >= 7) reasons.add("phone");
    }
    for (const name of names) {
      const wholeWord = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
      if (wholeWord.test(text)) reasons.add("name");
    }
  }

  if (reasons.size === 0) return { ok: true };
  return {
    ok: false,
    reasons: PERSONAL_DATA_REASONS.filter((reason) => reasons.has(reason)),
  };
}

// Normalises case, spacing and key order, so the same checklist saved by
// two hosts gets one fingerprint and counts once in the sharing rule.
function canonical(value: unknown): unknown {
  if (typeof value === "string") {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function payloadFingerprint(
  kind: SolutionKind,
  payload: unknown,
): string {
  const body = JSON.stringify(canonical({ kind, payload }));
  return createHash("sha256").update(body).digest("hex");
}
