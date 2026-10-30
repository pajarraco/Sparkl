// Framework-free business logic: no drizzle/fastify imports allowed here.
// Sharing across hosts (04 L1 step 6). When a host accepts their own
// checklist, its copy is also offered as one global row, keyed by the
// fingerprint of the normalised payload. The global row turns active only
// after `sharingMinHosts` distinct hosts, each with a posted job, have
// accepted that fingerprint. The owner can retire any global row.
import {
  SOLUTION_RANKING_CONFIG,
  SPARKL_ERROR_CODES,
  type SparklErrorCode,
} from "@sparkl/shared";
import type { SolutionRow, SolutionsStore } from "./solutions-store.js";

export interface ShareArgs {
  // The host-scope row the host has just accepted.
  solution: SolutionRow;
  at: Date;
  newId: () => string;
}

// Called once a host-scope checklist is accepted. Creates the global copy if
// it is missing and activates it once enough distinct hosts agree. A global
// row the owner retired is never brought back by sharing.
export async function shareAcceptedChecklist(
  store: SolutionsStore,
  args: ShareArgs,
): Promise<void> {
  const { solution, at } = args;
  if (solution.scope !== "host" || solution.kind !== "checklist") return;

  let global = await store.findByFingerprint(
    "global",
    null,
    solution.fingerprint,
  );
  if (!global) {
    await store.insert({
      id: args.newId(),
      scope: "global",
      hostId: null,
      kind: solution.kind,
      tags: solution.tags,
      payload: solution.payload,
      fingerprint: solution.fingerprint,
      source: solution.source,
      status: "candidate",
      at,
    });
    // Read back whichever row won: a concurrent accept may have made it first.
    global = await store.findByFingerprint(
      "global",
      null,
      solution.fingerprint,
    );
    if (!global) return;
  }

  if (global.status !== "candidate") return;
  const hosts = await store.acceptingHostIds(solution.fingerprint);
  if (hosts.length >= SOLUTION_RANKING_CONFIG.sharingMinHosts) {
    await store.setStatus(global.id, "active", at);
  }
}

export type RetireResult =
  | { ok: true }
  | { ok: false; code: SparklErrorCode; message: string };

// The owner's retire script. Only global rows can be retired this way; a
// host's private row is never the owner's to change.
export async function retireGlobalSolution(
  store: SolutionsStore,
  args: { id: string; at: Date },
): Promise<RetireResult> {
  const row = await store.findById(args.id);
  if (!row) {
    return {
      ok: false,
      code: SPARKL_ERROR_CODES.NOT_FOUND,
      message: "solution not found",
    };
  }
  if (row.scope !== "global") {
    return {
      ok: false,
      code: SPARKL_ERROR_CODES.FORBIDDEN,
      message: "only global solutions can be retired",
    };
  }
  if (row.status !== "retired") {
    await store.setStatus(row.id, "retired", args.at);
  }
  return { ok: true };
}
