// In-memory SolutionsStore for the service tests. Mirrors the Drizzle store
// contract: one event per (solution, session, event), counters bumped on
// each recorded event, and host ids checked on every host-scoped read.
import type {
  NewSolution,
  SolutionEventInput,
  SolutionRow,
  SolutionsStore,
} from "./solutions-store.js";

// postingHosts: hosts with a posted job. Undefined means every host has one.
export function fakeStore(
  seed: SolutionRow[] = [],
  postingHosts?: ReadonlySet<string>,
) {
  const rows = [...seed];
  const events: SolutionEventInput[] = [];
  const rejected: Array<{ hostId: string; solutionId: string }> = [];
  const store: SolutionsStore = {
    async insert(row: NewSolution) {
      const clash = rows.some(
        (r) =>
          r.fingerprint === row.fingerprint &&
          (row.scope === "global"
            ? r.scope === "global"
            : r.scope === "host" && r.hostId === row.hostId),
      );
      if (clash) return false;
      rows.push({
        id: row.id,
        scope: row.scope,
        hostId: row.hostId,
        kind: row.kind,
        tags: row.tags,
        payload: row.payload,
        fingerprint: row.fingerprint,
        source: row.source,
        status: row.status,
        proposed: 0,
        accepted: 0,
        rejected: 0,
        score: 0,
        lastAcceptedAt: null,
        createdAt: row.at,
        updatedAt: row.at,
      });
      return true;
    },
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async findByFingerprint(scope, hostId, fingerprint) {
      return (
        rows.find(
          (r) =>
            r.scope === scope &&
            r.fingerprint === fingerprint &&
            (scope === "global" || r.hostId === hostId),
        ) ?? null
      );
    },
    async listForHost(hostId, kind) {
      return rows.filter(
        (r) => r.kind === kind && (r.scope === "global" || r.hostId === hostId),
      );
    },
    async rejectedByHost(hostId) {
      return rejected
        .filter((r) => r.hostId === hostId)
        .map((r) => r.solutionId);
    },
    async recordEvent(event) {
      const dup = events.some(
        (e) =>
          e.solutionId === event.solutionId &&
          e.sessionId === event.sessionId &&
          e.event === event.event,
      );
      if (dup) return false;
      events.push(event);
      return true;
    },
    async acceptingHostIds(fingerprint) {
      const solutionIds = new Set(
        rows.filter((r) => r.fingerprint === fingerprint).map((r) => r.id),
      );
      const hosts = new Set(
        events
          .filter(
            (e) =>
              solutionIds.has(e.solutionId) &&
              e.event === "accepted" &&
              (postingHosts === undefined || postingHosts.has(e.hostId)),
          )
          .map((e) => e.hostId),
      );
      return [...hosts];
    },
    async proposedSolutionIds(sessionId, hostId) {
      return events
        .filter(
          (e) =>
            e.sessionId === sessionId &&
            e.hostId === hostId &&
            e.event === "proposed",
        )
        .map((e) => e.solutionId);
    },
    async votedSolutionIds(sessionId) {
      return events
        .filter(
          (e) =>
            e.sessionId === sessionId &&
            (e.event === "accepted" || e.event === "rejected"),
        )
        .map((e) => e.solutionId);
    },
    async hostHasVoted(solutionId, hostId) {
      return events.some(
        (e) =>
          e.solutionId === solutionId &&
          e.hostId === hostId &&
          (e.event === "accepted" || e.event === "rejected"),
      );
    },
    async recentVotes(solutionId, n) {
      return events
        .filter(
          (e) =>
            e.solutionId === solutionId &&
            (e.event === "accepted" || e.event === "rejected"),
        )
        .slice(-n)
        .reverse()
        .map((e) => (e.event === "accepted" ? "accepted" : "rejected"));
    },
    async setScore() {},
    async setStatus(id, status, at) {
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.status = status;
        row.updatedAt = at;
      }
    },
  };
  return { store, rows, events, rejected };
}
