// Framework-free store contract for the solutions store (04 L1). The Drizzle
// implementation lives in src/db/stores.ts. Every method takes ids and
// timestamps from the caller, so the service stays deterministic in tests.
import type {
  SolutionKind,
  SolutionScope,
  SolutionSource,
  SolutionStatus,
  SolutionTag,
} from "@sparkl/shared";

export type SolutionEventName = "proposed" | "accepted" | "rejected";

export interface SolutionRow {
  id: string;
  scope: SolutionScope;
  hostId: string | null;
  kind: SolutionKind;
  tags: SolutionTag[];
  payload: unknown; // re-checked against the kind's schema by the service
  fingerprint: string;
  source: SolutionSource;
  status: SolutionStatus;
  proposed: number;
  accepted: number;
  rejected: number;
  score: number;
  lastAcceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewSolution {
  id: string;
  scope: SolutionScope;
  hostId: string | null;
  kind: SolutionKind;
  tags: SolutionTag[];
  payload: unknown;
  fingerprint: string;
  source: SolutionSource;
  status: SolutionStatus;
  at: Date;
}

export interface SolutionEventInput {
  id: string;
  solutionId: string;
  sessionId: string;
  hostId: string;
  event: SolutionEventName;
  at: Date;
}

export interface SolutionsStore {
  // False when the row would break a uniqueness rule (the same fingerprint
  // already exists for this host, or as a global row). Nothing is overwritten.
  insert(row: NewSolution): Promise<boolean>;
  findById(id: string): Promise<SolutionRow | null>;
  findByFingerprint(
    scope: SolutionScope,
    hostId: string | null,
    fingerprint: string,
  ): Promise<SolutionRow | null>;
  // Candidates for ranking: the host's own rows of this kind plus every
  // global row of this kind. Other hosts' host rows are never returned.
  listForHost(hostId: string, kind: SolutionKind): Promise<SolutionRow[]>;
  // Global solution ids this host has rejected, so they are never proposed
  // to them again.
  rejectedByHost(hostId: string): Promise<string[]>;
  // Inserts the event once per (solution, session, event) and bumps the
  // counter in the same transaction. False when the event already exists.
  recordEvent(event: SolutionEventInput): Promise<boolean>;
  // Distinct hosts with an accepted event on any row with this fingerprint.
  acceptingHostIds(fingerprint: string): Promise<string[]>;
  setScore(id: string, score: number, at: Date): Promise<void>;
  setStatus(id: string, status: SolutionStatus, at: Date): Promise<void>;
}
