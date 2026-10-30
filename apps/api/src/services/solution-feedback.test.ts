import type { JobDraftField, SolutionKind } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import { finishAssistantSession } from "./assistant-sessions.js";
import { createUserRateLimiter } from "./rate-limit.js";
import {
  recordChipVote,
  recordReviewFormVotes,
  targetFieldsOf,
} from "./solution-feedback.js";
import { fakeStore } from "./solutions-fake.js";
import type { SolutionRow, SolutionsStore } from "./solutions-store.js";

const NOW = "2026-10-30T09:00:00.000Z";
const at = new Date(NOW);
const HOST = "host-a";
const CHECKLIST = { items: ["Wipe the hob", "Vacuum the rugs"] };

function row(
  overrides: Partial<SolutionRow> & Pick<SolutionRow, "id">,
): SolutionRow {
  return {
    scope: "host",
    hostId: HOST,
    kind: "checklist",
    tags: [],
    payload: CHECKLIST,
    fingerprint: `fp-${overrides.id}`,
    source: "model",
    status: "candidate",
    proposed: 0,
    accepted: 0,
    rejected: 0,
    score: 0,
    lastAcceptedAt: null,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

// Sessions stub: each session is open for the host unless told otherwise.
function sessionsFor(
  open: Record<
    string,
    { hostId: string; open: boolean; modelFilled?: JobDraftField[] }
  >,
) {
  return {
    async sessionFills(id: string, hostId: string) {
      const session = open[id];
      if (!session || session.hostId !== hostId) return null;
      return { open: session.open, modelFilled: session.modelFilled ?? [] };
    },
  };
}

let ids = 0;
const newId = () => `ev-${++ids}`;
const limiter = createUserRateLimiter({ limit: 1000, windowMs: 60_000 });

// Proposes `solutionId` in `sessionId` as the turn would have.
async function propose(
  store: SolutionsStore,
  solutionId: string,
  sessionId: string,
) {
  await store.recordEvent({
    id: newId(),
    solutionId,
    sessionId,
    hostId: HOST,
    event: "proposed",
    at,
  });
}

const clock = { nowIso: () => NOW };

describe("targetFieldsOf", () => {
  it("maps each kind to the review-form field it sets", () => {
    expect(targetFieldsOf("checklist", CHECKLIST)).toEqual(["notes"]);
    expect(
      targetFieldsOf("window_preference", {
        weekday: 1,
        start: "09:00",
        end: "12:00",
      }),
    ).toEqual(["windowStart", "windowEnd"]);
    expect(
      targetFieldsOf("offer_preference", {
        offer: "price_hint",
        accepted: true,
      }),
    ).toEqual(["price"]);
    expect(
      targetFieldsOf("offer_preference", {
        offer: "usual_cleaner",
        accepted: true,
      }),
    ).toEqual([]);
    expect(
      targetFieldsOf("faq" as SolutionKind, { question: "Q", answer: "A" }),
    ).toEqual([]);
  });
});

describe("recordChipVote", () => {
  it("records an accepted chip and turns a host candidate active", async () => {
    const { store, rows, events } = fakeStore([row({ id: "own" })]);
    await propose(store, "own", "s1");
    await recordChipVote(
      {
        solutions: store,
        sessions: sessionsFor({ s1: { hostId: HOST, open: true } }),
      },
      clock,
      { sessionId: "s1", proposalId: "own", vote: "accepted", hostId: HOST },
      limiter,
      newId,
    );
    expect(events.at(-1)).toMatchObject({
      event: "accepted",
      solutionId: "own",
    });
    expect(rows[0]?.status).toBe("active");
  });

  it("refuses a session that is not the caller's or is finished", async () => {
    const { store } = fakeStore([row({ id: "own" })]);
    await propose(store, "own", "s1");
    const sessions = sessionsFor({
      s1: { hostId: HOST, open: false },
      s2: { hostId: "host-b", open: true },
    });
    const call = (sessionId: string) =>
      recordChipVote(
        { solutions: store, sessions },
        clock,
        {
          sessionId,
          proposalId: "own",
          vote: "accepted",
          hostId: HOST,
        },
        limiter,
        newId,
      );
    await expect(call("s1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(call("s2")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses a solution that was never proposed in this session", async () => {
    const { store } = fakeStore([row({ id: "own" })]);
    await expect(
      recordChipVote(
        {
          solutions: store,
          sessions: sessionsFor({ s1: { hostId: HOST, open: true } }),
        },
        clock,
        { sessionId: "s1", proposalId: "own", vote: "accepted", hostId: HOST },
        limiter,
        newId,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("keeps the first vote in a session", async () => {
    const { store, events } = fakeStore([row({ id: "own" })]);
    await propose(store, "own", "s1");
    const deps = {
      solutions: store,
      sessions: sessionsFor({ s1: { hostId: HOST, open: true } }),
    };
    await recordChipVote(
      deps,
      clock,
      { sessionId: "s1", proposalId: "own", vote: "rejected", hostId: HOST },
      limiter,
      newId,
    );
    await recordChipVote(
      deps,
      clock,
      { sessionId: "s1", proposalId: "own", vote: "accepted", hostId: HOST },
      limiter,
      newId,
    );
    expect(
      events.filter((e) => e.event !== "proposed").map((e) => e.event),
    ).toEqual(["rejected"]);
  });

  it("retires a host candidate after three rejections in a row", async () => {
    const { store, rows } = fakeStore([row({ id: "own", status: "active" })]);
    const sessions = sessionsFor({
      s1: { hostId: HOST, open: true },
      s2: { hostId: HOST, open: true },
      s3: { hostId: HOST, open: true },
    });
    for (const sessionId of ["s1", "s2"]) {
      await propose(store, "own", sessionId);
      await recordChipVote(
        { solutions: store, sessions },
        clock,
        { sessionId, proposalId: "own", vote: "rejected", hostId: HOST },
        limiter,
        newId,
      );
    }
    expect(rows[0]?.status).toBe("active");
    await propose(store, "own", "s3");
    await recordChipVote(
      { solutions: store, sessions },
      clock,
      { sessionId: "s3", proposalId: "own", vote: "rejected", hostId: HOST },
      limiter,
      newId,
    );
    expect(rows[0]?.status).toBe("retired");
  });

  it("does not retire on a streak broken by an acceptance", async () => {
    const { store, rows } = fakeStore([row({ id: "own", status: "active" })]);
    const sessions = sessionsFor({
      s1: { hostId: HOST, open: true },
      s2: { hostId: HOST, open: true },
      s3: { hostId: HOST, open: true },
    });
    const votes = ["rejected", "accepted", "rejected"] as const;
    for (const [i, vote] of votes.entries()) {
      const sessionId = `s${i + 1}`;
      await propose(store, "own", sessionId);
      await recordChipVote(
        { solutions: store, sessions },
        clock,
        { sessionId, proposalId: "own", vote, hostId: HOST },
        limiter,
        newId,
      );
    }
    expect(rows[0]?.status).toBe("active");
  });

  it("counts one vote per host on a global row", async () => {
    const { store, events } = fakeStore([
      row({
        id: "g1",
        scope: "global",
        hostId: null,
        source: "seed",
        status: "active",
      }),
    ]);
    const sessions = sessionsFor({
      s1: { hostId: HOST, open: true },
      s2: { hostId: HOST, open: true },
    });
    for (const sessionId of ["s1", "s2"]) {
      await propose(store, "g1", sessionId);
      await recordChipVote(
        { solutions: store, sessions },
        clock,
        { sessionId, proposalId: "g1", vote: "accepted", hostId: HOST },
        limiter,
        newId,
      );
    }
    expect(events.filter((e) => e.event === "accepted")).toHaveLength(1);
  });
});

describe("recordReviewFormVotes", () => {
  const base = { sessionId: "s1", hostId: HOST, at };

  it("accepts a filled field the host kept", async () => {
    const { store, events } = fakeStore([row({ id: "own" })]);
    await propose(store, "own", "s1");
    await recordReviewFormVotes(
      { solutions: store },
      { ...base, modelFilled: ["notes"], hostChanged: [] },
      newId,
    );
    expect(events.at(-1)).toMatchObject({
      event: "accepted",
      solutionId: "own",
    });
  });

  it("rejects a filled field the host changed", async () => {
    const { store, events } = fakeStore([row({ id: "own" })]);
    await propose(store, "own", "s1");
    await recordReviewFormVotes(
      { solutions: store },
      { ...base, modelFilled: ["notes"], hostChanged: ["notes"] },
      newId,
    );
    expect(events.at(-1)).toMatchObject({
      event: "rejected",
      solutionId: "own",
    });
  });

  it("gives no vote when the model never filled the target field", async () => {
    const { store, events } = fakeStore([row({ id: "own" })]);
    await propose(store, "own", "s1");
    await recordReviewFormVotes(
      { solutions: store },
      { ...base, modelFilled: ["date"], hostChanged: [] },
      newId,
    );
    expect(events.filter((e) => e.event !== "proposed")).toEqual([]);
  });

  it("skips proposals that already have a chip vote", async () => {
    const { store, events } = fakeStore([row({ id: "own" })]);
    await propose(store, "own", "s1");
    await recordChipVote(
      {
        solutions: store,
        sessions: sessionsFor({ s1: { hostId: HOST, open: true } }),
      },
      clock,
      { sessionId: "s1", proposalId: "own", vote: "rejected", hostId: HOST },
      limiter,
      newId,
    );
    await recordReviewFormVotes(
      { solutions: store },
      { ...base, modelFilled: ["notes"], hostChanged: [] },
      newId,
    );
    expect(
      events.filter((e) => e.event !== "proposed").map((e) => e.event),
    ).toEqual(["rejected"]);
  });

  it("gives no review-form vote to an FAQ", async () => {
    const { store, events } = fakeStore([
      row({
        id: "faq",
        kind: "faq",
        scope: "global",
        hostId: null,
        source: "seed",
        status: "active",
        payload: { question: "Q", answer: "A" },
      }),
    ]);
    await propose(store, "faq", "s1");
    await recordReviewFormVotes(
      { solutions: store },
      { ...base, modelFilled: ["notes"], hostChanged: [] },
      newId,
    );
    expect(events.filter((e) => e.event !== "proposed")).toEqual([]);
  });

  it("reads the window fields for a window preference", async () => {
    const { store, events } = fakeStore([
      row({
        id: "win",
        kind: "window_preference",
        payload: { weekday: 2, start: "09:00", end: "12:00" },
      }),
    ]);
    await propose(store, "win", "s1");
    await recordReviewFormVotes(
      { solutions: store },
      {
        ...base,
        modelFilled: ["windowStart", "windowEnd"],
        hostChanged: ["windowEnd"],
      },
      newId,
    );
    expect(events.at(-1)).toMatchObject({
      event: "rejected",
      solutionId: "win",
    });
  });
});

describe("finishAssistantSession with review-form votes", () => {
  it("votes only for a posted job, from the fields the model filled", async () => {
    const { store, events } = fakeStore([row({ id: "own" })]);
    await propose(store, "own", "s1");
    await finishAssistantSession(
      {
        sessions: {
          ...sessionsFor({
            s1: { hostId: HOST, open: true, modelFilled: ["notes"] },
          }),
          finish: async () => true,
        } as never,
        jobs: { findJobById: async () => ({ hostId: HOST }) as never },
        solutions: store,
      },
      clock,
      {
        sessionId: "s1",
        outcome: "posted",
        jobId: "11111111-1111-4111-8111-111111111111",
        hostChanged: [],
        hostId: HOST,
      },
      limiter,
    );
    expect(events.at(-1)).toMatchObject({
      event: "accepted",
      solutionId: "own",
    });
  });

  it("gives no votes when the session is abandoned", async () => {
    const { store, events } = fakeStore([row({ id: "own" })]);
    await propose(store, "own", "s1");
    await finishAssistantSession(
      {
        sessions: {
          ...sessionsFor({
            s1: { hostId: HOST, open: true, modelFilled: ["notes"] },
          }),
          finish: async () => true,
        } as never,
        jobs: { findJobById: async () => ({ hostId: HOST }) as never },
        solutions: store,
      },
      clock,
      { sessionId: "s1", outcome: "abandoned", hostChanged: [], hostId: HOST },
      limiter,
    );
    expect(events.filter((e) => e.event !== "proposed")).toEqual([]);
  });
});
