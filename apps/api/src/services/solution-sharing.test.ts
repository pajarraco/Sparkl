import { describe, expect, it } from "vitest";
import { applyVote } from "./solution-feedback.js";
import {
  retireGlobalSolution,
  shareAcceptedChecklist,
} from "./solution-sharing.js";
import { fakeStore } from "./solutions-fake.js";
import type { SolutionRow } from "./solutions-store.js";

const NOW = new Date("2026-10-30T09:00:00Z");
const FP = "fp-shared-checklist";
const PAYLOAD = { items: ["Wipe the hob", "Vacuum the rugs"] };
const hosts = ["host-a", "host-b", "host-c", "host-d"];

function hostRow(
  hostId: string,
  overrides: Partial<SolutionRow> = {},
): SolutionRow {
  return {
    id: `own-${hostId}`,
    scope: "host",
    hostId,
    kind: "checklist",
    tags: ["turnover"],
    payload: PAYLOAD,
    fingerprint: FP,
    source: "model",
    status: "candidate",
    proposed: 0,
    accepted: 0,
    rejected: 0,
    score: 0,
    lastAcceptedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

let ids = 0;
const newId = () => `id-${++ids}`;

// Each host accepts their own copy through the real vote path.
async function acceptAs(
  store: ReturnType<typeof fakeStore>["store"],
  rows: SolutionRow[],
  hostId: string,
) {
  const solution = rows.find((r) => r.hostId === hostId);
  if (!solution) throw new Error(`no row for ${hostId}`);
  await applyVote({
    store,
    solution,
    sessionId: `session-${hostId}`,
    hostId,
    vote: "accepted",
    at: NOW,
    newId,
  });
}

function globalRow(rows: SolutionRow[]) {
  return rows.find((r) => r.scope === "global" && r.fingerprint === FP);
}

describe("sharing an accepted checklist", () => {
  it("creates one global candidate copy and keeps it a candidate with two hosts", async () => {
    const seeds = hosts.slice(0, 3).map((h) => hostRow(h));
    const { store, rows } = fakeStore(seeds);
    await acceptAs(store, rows, "host-a");
    await acceptAs(store, rows, "host-b");

    const copies = rows.filter(
      (r) => r.scope === "global" && r.fingerprint === FP,
    );
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({
      status: "candidate",
      tags: ["turnover"],
    });
  });

  it("activates the global copy once three distinct hosts accept", async () => {
    const seeds = hosts.slice(0, 3).map((h) => hostRow(h));
    const { store, rows } = fakeStore(seeds);
    await acceptAs(store, rows, "host-a");
    await acceptAs(store, rows, "host-b");
    expect(globalRow(rows)?.status).toBe("candidate");
    await acceptAs(store, rows, "host-c");
    expect(globalRow(rows)?.status).toBe("active");
  });

  it("does not count a host with no posted job toward sharing", async () => {
    const seeds = hosts.slice(0, 3).map((h) => hostRow(h));
    const posting = new Set(["host-a", "host-b"]);
    const { store, rows } = fakeStore(seeds, posting);
    await acceptAs(store, rows, "host-a");
    await acceptAs(store, rows, "host-b");
    await acceptAs(store, rows, "host-c");
    expect(globalRow(rows)?.status).toBe("candidate");
  });

  it("counts one host once even when it accepts more than one copy", async () => {
    const seeds = [
      hostRow("host-a"),
      hostRow("host-a", { id: "own-a-2", fingerprint: FP, scope: "host" }),
      hostRow("host-b"),
    ];
    const { store, rows } = fakeStore(seeds);
    await acceptAs(store, rows, "host-a");
    await applyVote({
      store,
      solution: rows[1] as SolutionRow,
      sessionId: "session-a-2",
      hostId: "host-a",
      vote: "accepted",
      at: NOW,
      newId,
    });
    await acceptAs(store, rows, "host-b");
    expect(globalRow(rows)?.status).toBe("candidate");
  });

  it("never shares a non-checklist kind", async () => {
    const { store, rows } = fakeStore([
      hostRow("host-a", {
        kind: "window_preference",
        payload: { weekday: 1, start: "09:00", end: "12:00" },
      }),
    ]);
    await shareAcceptedChecklist(store, {
      solution: rows[0] as SolutionRow,
      at: NOW,
      newId,
    });
    expect(rows.filter((r) => r.scope === "global")).toEqual([]);
  });

  it("never brings back a global copy the owner retired", async () => {
    const seeds = hosts.slice(0, 3).map((h) => hostRow(h));
    const { store, rows } = fakeStore(seeds);
    await acceptAs(store, rows, "host-a");
    await acceptAs(store, rows, "host-b");
    const copy = globalRow(rows);
    if (copy) copy.status = "retired";
    await acceptAs(store, rows, "host-c");
    expect(globalRow(rows)?.status).toBe("retired");
  });
});

describe("retireGlobalSolution", () => {
  it("retires a global row", async () => {
    const { store, rows } = fakeStore([
      hostRow("host-a", {
        id: "g1",
        scope: "global",
        hostId: null,
        source: "seed",
        status: "active",
      }),
    ]);
    expect(await retireGlobalSolution(store, { id: "g1", at: NOW })).toEqual({
      ok: true,
    });
    expect(rows[0]?.status).toBe("retired");
  });

  it("is idempotent for an already retired row", async () => {
    const { store } = fakeStore([
      hostRow("host-a", {
        id: "g1",
        scope: "global",
        hostId: null,
        status: "retired",
      }),
    ]);
    expect(await retireGlobalSolution(store, { id: "g1", at: NOW })).toEqual({
      ok: true,
    });
  });

  it("refuses a host's private row", async () => {
    const { store, rows } = fakeStore([hostRow("host-a", { id: "own" })]);
    expect(
      await retireGlobalSolution(store, { id: "own", at: NOW }),
    ).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(rows[0]?.status).toBe("candidate");
  });

  it("answers NOT_FOUND for an unknown id", async () => {
    const { store } = fakeStore([]);
    expect(
      await retireGlobalSolution(store, { id: "missing", at: NOW }),
    ).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});
