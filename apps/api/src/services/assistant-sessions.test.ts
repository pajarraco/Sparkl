import type { Job } from "@sparkl/shared";
import { describe, expect, it, vi } from "vitest";
import {
  AssistantSessionError,
  type AssistantSessionsStore,
  finishAssistantSession,
} from "./assistant-sessions.js";
import { createUserRateLimiter } from "./rate-limit.js";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_HOST_ID = "22222222-2222-4222-8222-222222222222";
const JOB_ID = "33333333-3333-4333-8333-333333333333";
const SESSION_ID = "44444444-4444-4444-8444-444444444444";
const NOW = "2026-10-29T03:00:00.000Z";

const clock = { nowIso: () => NOW };

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: JOB_ID,
    hostId: HOST_ID,
    address: "Calle Falsa 123",
    latitude: 40.4168,
    longitude: -3.7038,
    windowStart: "2026-11-01T10:00:00.000Z",
    windowEnd: "2026-11-01T12:00:00.000Z",
    sizeSqm: 80,
    notes: null,
    priceMinorUnits: 5000,
    status: "open",
    claimedByCleanerId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

type FinishArgs = Parameters<AssistantSessionsStore["finish"]>[0];

// finish records its argument and answers `result`; a turn never runs here.
function sessionsFake(result = true) {
  const calls: FinishArgs[] = [];
  const store: AssistantSessionsStore = {
    openTurn: () => Promise.reject(new Error("not used")),
    recordTurn: () => Promise.reject(new Error("not used")),
    finish: async (args) => {
      calls.push(args);
      return result;
    },
  };
  return { store, calls };
}

function jobsWith(job: Job | null) {
  return { findJobById: vi.fn(async () => job) };
}

// A fresh limiter per test, so tests never share the module default.
function limiter(limit = 100) {
  return createUserRateLimiter({ limit, windowMs: 60_000, now: () => 0 });
}

describe("finishAssistantSession", () => {
  it("closes a posted session on the host's own job with a clean diff", async () => {
    const { store, calls } = sessionsFake();

    await finishAssistantSession(
      { sessions: store, jobs: jobsWith(makeJob()) },
      clock,
      {
        sessionId: SESSION_ID,
        outcome: "posted",
        jobId: JOB_ID,
        hostChanged: ["windowEnd", "price", "windowEnd"],
        hostId: HOST_ID,
      },
      limiter(),
    );

    expect(calls).toEqual([
      {
        id: SESSION_ID,
        hostId: HOST_ID,
        outcome: "posted",
        jobId: JOB_ID,
        hostChanged: ["price", "windowEnd"],
        nowIso: NOW,
      },
    ]);
  });

  it("closes an abandoned session without looking up a job", async () => {
    const { store, calls } = sessionsFake();
    const jobs = jobsWith(null);

    await finishAssistantSession(
      { sessions: store, jobs },
      clock,
      {
        sessionId: SESSION_ID,
        outcome: "abandoned",
        hostChanged: [],
        hostId: HOST_ID,
      },
      limiter(),
    );

    expect(calls.map((c) => [c.outcome, c.jobId])).toEqual([
      ["abandoned", null],
    ]);
    expect(jobs.findJobById).not.toHaveBeenCalled();
  });

  it.each([
    ["another host's job", makeJob({ hostId: OTHER_HOST_ID })],
    ["a job that does not exist", null],
  ])("rejects %s with NOT_FOUND and records nothing", async (_, job) => {
    const { store, calls } = sessionsFake();

    const error = await finishAssistantSession(
      { sessions: store, jobs: jobsWith(job) },
      clock,
      {
        sessionId: SESSION_ID,
        outcome: "posted",
        jobId: JOB_ID,
        hostChanged: [],
        hostId: HOST_ID,
      },
      limiter(),
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(AssistantSessionError);
    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "job not found",
    });
    expect(calls).toEqual([]);
  });

  it("rejects a foreign or already finished session with NOT_FOUND", async () => {
    const { store, calls } = sessionsFake(false);

    const error = await finishAssistantSession(
      { sessions: store, jobs: jobsWith(null) },
      clock,
      {
        sessionId: SESSION_ID,
        outcome: "fell_back",
        hostChanged: [],
        hostId: HOST_ID,
      },
      limiter(),
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(AssistantSessionError);
    expect(error).toMatchObject({ code: "NOT_FOUND" });
    expect(calls).toHaveLength(1);
  });

  it("rate-limits each host separately", async () => {
    const { store, calls } = sessionsFake();
    const shared = limiter(2);
    const finish = (hostId: string) =>
      finishAssistantSession(
        { sessions: store, jobs: jobsWith(null) },
        clock,
        {
          sessionId: SESSION_ID,
          outcome: "abandoned",
          hostChanged: [],
          hostId,
        },
        shared,
      );

    await finish(HOST_ID);
    await finish(HOST_ID);
    await expect(finish(HOST_ID)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    await expect(finish(OTHER_HOST_ID)).resolves.toBeUndefined();
    expect(calls).toHaveLength(3);
  });
});
