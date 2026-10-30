import { SOLUTION_RANKING_CONFIG } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import type {
  NewSolution,
  SolutionEventInput,
  SolutionRow,
  SolutionsStore,
} from "./solutions-store.js";
import { createSolutionTools, solutionLabel } from "./solutions.js";

const NOW = new Date("2026-10-30T09:00:00Z");

function fakeStore(seed: SolutionRow[] = []) {
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
    async acceptingHostIds() {
      return [];
    },
    async setScore() {},
    async setStatus() {},
  };
  return { store, rows, events, rejected };
}

function row(
  overrides: Partial<SolutionRow> & Pick<SolutionRow, "id">,
): SolutionRow {
  return {
    scope: "global",
    hostId: null,
    kind: "checklist",
    tags: [],
    payload: { items: ["Wipe the hob"] },
    fingerprint: `fp-${overrides.id}`,
    source: "seed",
    status: "active",
    proposed: 0,
    accepted: 3,
    rejected: 0,
    score: 0.5,
    lastAcceptedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function tools(store: SolutionsStore, knownNames: string[] = []) {
  let counter = 0;
  return createSolutionTools({
    store,
    hostId: "host-a",
    sessionId: "session-1",
    knownNames,
    now: NOW,
    newId: () => `id-${++counter}`,
  });
}

describe("solutionLabel", () => {
  it("should label each kind from its payload", () => {
    expect(solutionLabel("checklist", { items: ["a", "b"] })).toBe(
      "Checklist (2 items)",
    );
    expect(
      solutionLabel("window_preference", {
        weekday: 1,
        start: "09:00",
        end: "12:00",
      }),
    ).toBe("Usual window 09:00–12:00");
    expect(
      solutionLabel("offer_preference", {
        offer: "price_hint",
        accepted: true,
      }),
    ).toBe("Price hint");
    expect(solutionLabel("faq", { question: "Do you bring products?" })).toBe(
      "Do you bring products?",
    );
  });
});

describe("find_solutions", () => {
  it("should offer the host's own rows before global ones and log proposals", async () => {
    const { store, events } = fakeStore([
      row({ id: "g1", accepted: 9 }),
      row({ id: "own", scope: "host", hostId: "host-a", accepted: 1 }),
    ]);
    const t = tools(store);
    const result = (await t.run("find_solutions", { kind: "checklist" })) as {
      solutions: Array<{ id: string }>;
    };
    expect(result.solutions.map((s) => s.id)).toEqual(["own", "g1"]);
    expect(events.map((e) => e.event)).toEqual(["proposed", "proposed"]);
    expect(t.proposals().map((p) => p.id)).toEqual(["own", "g1"]);
  });

  it("should never offer another host's rows", async () => {
    const { store } = fakeStore([
      row({ id: "other", scope: "host", hostId: "host-b", accepted: 9 }),
    ]);
    const result = (await tools(store).run("find_solutions", {
      kind: "checklist",
    })) as { solutions: unknown[] };
    expect(result.solutions).toEqual([]);
  });

  it("should skip global rows the host rejected", async () => {
    const { store, rejected } = fakeStore([row({ id: "g1" })]);
    rejected.push({ hostId: "host-a", solutionId: "g1" });
    const result = (await tools(store).run("find_solutions", {
      kind: "checklist",
    })) as { solutions: unknown[] };
    expect(result.solutions).toEqual([]);
  });

  it("should skip a row whose stored payload fails its schema", async () => {
    const { store } = fakeStore([
      row({ id: "bad", payload: { items: [] } }),
      row({ id: "good" }),
    ]);
    const result = (await tools(store).run("find_solutions", {
      kind: "checklist",
    })) as { solutions: Array<{ id: string }> };
    expect(result.solutions.map((s) => s.id)).toEqual(["good"]);
  });

  it("should keep the result within the character cap", async () => {
    const seed = Array.from({ length: 3 }, (_, i) =>
      row({
        id: `g${i}`,
        accepted: 9 - i,
        payload: {
          items: Array.from({ length: 12 }, () => "x".repeat(80)),
        },
      }),
    );
    const { store } = fakeStore(seed);
    const raw = await tools(store).run("find_solutions", { kind: "checklist" });
    expect(JSON.stringify(raw).length).toBeLessThanOrEqual(
      SOLUTION_RANKING_CONFIG.toolResultMaxChars,
    );
  });

  it("should refuse unknown arguments", async () => {
    const { store } = fakeStore();
    expect(
      await tools(store).run("find_solutions", { kind: "access_notes" }),
    ).toEqual({ error: "invalid arguments" });
    expect(
      await tools(store).run("find_solutions", { kind: "faq", extra: 1 }),
    ).toEqual({ error: "invalid arguments" });
  });

  it("should fail open when the store throws", async () => {
    const { store } = fakeStore();
    store.listForHost = async () => {
      throw new Error("db down");
    };
    expect(
      await tools(store).run("find_solutions", { kind: "checklist" }),
    ).toEqual({ error: "solutions unavailable" });
  });
});

describe("save_solution", () => {
  const checklist = { items: ["Wipe the hob", "Vacuum the rugs"] };

  it("should save a host candidate as model-sourced", async () => {
    const { store, rows } = fakeStore();
    const result = await tools(store).run("save_solution", {
      kind: "checklist",
      tags: ["turnover"],
      payload: checklist,
    });
    expect(result).toEqual({ ok: true, id: "id-1", duplicate: false });
    expect(rows[0]).toMatchObject({
      scope: "host",
      hostId: "host-a",
      source: "model",
      status: "candidate",
      tags: ["turnover"],
    });
  });

  it("should refuse kinds the model may not write", async () => {
    const { store } = fakeStore();
    expect(
      await tools(store).run("save_solution", {
        kind: "faq",
        payload: { question: "Q", answer: "A" },
      }),
    ).toEqual({ error: "this kind cannot be saved" });
  });

  it("should refuse an invalid payload", async () => {
    const { store } = fakeStore();
    expect(
      await tools(store).run("save_solution", {
        kind: "checklist",
        payload: { items: [] },
      }),
    ).toEqual({ error: "invalid payload" });
  });

  it("should refuse a checklist with a phone number and name the reasons", async () => {
    const { store, rows } = fakeStore();
    const result = (await tools(store).run("save_solution", {
      kind: "checklist",
      payload: { items: ["Call 0412 345 678 at the gate"] },
    })) as { error: string; reasons: string[] };
    expect(result.error).toContain("personal details");
    expect(result.reasons).toEqual(["phone", "digits"]);
    expect(rows).toEqual([]);
  });

  it("should refuse a checklist naming a known person", async () => {
    const { store } = fakeStore();
    const result = (await tools(store, ["Maria"]).run("save_solution", {
      kind: "checklist",
      payload: { items: ["Ask Maria about the oven"] },
    })) as { reasons: string[] };
    expect(result.reasons).toEqual(["name"]);
  });

  it("should return the existing row for a repeat save", async () => {
    const { store, rows } = fakeStore();
    const t = tools(store);
    await t.run("save_solution", { kind: "checklist", payload: checklist });
    const again = await t.run("save_solution", {
      kind: "checklist",
      payload: checklist,
    });
    expect(again).toEqual({ ok: true, id: rows[0]?.id, duplicate: true });
    expect(rows).toHaveLength(1);
  });

  it("should cap saves per turn when no session reservation is given", async () => {
    const { store } = fakeStore();
    const t = tools(store);
    for (let i = 0; i < SOLUTION_RANKING_CONFIG.maxSavesPerSession; i++) {
      const saved = await t.run("save_solution", {
        kind: "checklist",
        payload: { items: [`Task ${i}`] },
      });
      expect(saved).toMatchObject({ ok: true });
    }
    expect(
      await t.run("save_solution", {
        kind: "checklist",
        payload: { items: ["One too many"] },
      }),
    ).toEqual({ error: "save limit reached for this session" });
  });

  it("should use the session reservation as the cap, across turns", async () => {
    const { store, rows } = fakeStore();
    let budget = 2;
    const reserved = createSolutionTools({
      store,
      hostId: "host-a",
      sessionId: "session-1",
      knownNames: [],
      now: NOW,
      newId: () => `r-${rows.length + 1}`,
      reserveSave: async () => {
        if (budget === 0) return false;
        budget -= 1;
        return true;
      },
    });
    const first = await reserved.run("save_solution", {
      kind: "checklist",
      payload: { items: ["Mop"] },
    });
    const second = await reserved.run("save_solution", {
      kind: "checklist",
      payload: { items: ["Dust"] },
    });
    const third = await reserved.run("save_solution", {
      kind: "checklist",
      payload: { items: ["Bins"] },
    });
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    expect(third).toEqual({ error: "save limit reached for this session" });
    expect(rows).toHaveLength(2);
  });

  it("should return undefined for tools it does not own", async () => {
    const { store } = fakeStore();
    expect(await tools(store).run("update_draft", {})).toBeUndefined();
  });
});
