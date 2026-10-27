import type { Job, Message, SparklErrorCode } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  ChatError,
  type ChatEvents,
  type ChatStore,
  type ChatStores,
  assertJobParty,
  createChatEvents,
  listMessages,
  listNewMessagesSince,
  sendMessage,
} from "./chat.js";
import type { Clock, JobsStore } from "./jobs.js";

const HOST = "11111111-1111-4111-8111-111111111111";
const CLEANER = "22222222-2222-4222-8222-222222222222";
const STRANGER = "33333333-3333-4333-8333-333333333333";

const clock: Clock = { nowIso: () => "2026-01-01T10:00:00.000Z" };

let seq = 0;
function uid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: uid(),
    hostId: HOST,
    address: "Calle Falsa 123",
    latitude: 40.4168,
    longitude: -3.7038,
    windowStart: "2026-02-01T10:00:00.000Z",
    windowEnd: "2026-02-01T12:00:00.000Z",
    sizeSqm: 80,
    notes: null,
    priceMinorUnits: 5000,
    status: "claimed",
    claimedByCleanerId: CLEANER,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: uid(),
    jobId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    senderId: HOST,
    body: "Hello",
    createdAt: "2026-02-01T10:00:00.000Z",
    ...overrides,
  };
}

interface Fakes {
  stores: ChatStores;
  events: ChatEvents;
  messages: Message[];
}

function makeFakes(jobs: Job[], seed: Message[] = []): Fakes {
  const byId = new Map(jobs.map((j) => [j.id, { ...j }]));
  const messages = seed.map((m) => ({ ...m }));
  const jobsStore: Pick<JobsStore, "findJobById"> = {
    findJobById: async (jobId) =>
      byId.has(jobId) ? { ...(byId.get(jobId) as Job) } : null,
  };
  const chatStore: ChatStore = {
    listMessagesByJob: async (jobId) =>
      messages.filter((m) => m.jobId === jobId).map((m) => ({ ...m })),
    insertMessage: async (message) => {
      messages.push({ ...message });
      return { ...message };
    },
  };
  return {
    stores: { jobs: jobsStore, chat: chatStore },
    events: createChatEvents(),
    messages,
  };
}

async function captureCode(
  promise: Promise<unknown>,
): Promise<SparklErrorCode | null> {
  try {
    await promise;
    return null;
  } catch (err) {
    expect(err).toBeInstanceOf(ChatError);
    return (err as ChatError).code;
  }
}

describe("chat service", () => {
  it("send stores, publishes, and both parties can send", async () => {
    const job = makeJob();
    const fakes = makeFakes([job]);
    const seen: Message[] = [];
    const unsubscribe = fakes.events.subscribe(job.id, (m) => {
      seen.push(m);
    });
    const fromHost = await sendMessage(fakes.stores, clock, fakes.events, {
      jobId: job.id,
      senderId: HOST,
      senderRole: "host",
      body: "Keys are under the mat.",
    });
    expect(fromHost.senderId).toBe(HOST);
    expect(fromHost.createdAt).toBe("2026-01-01T10:00:00.000Z");
    const fromCleaner = await sendMessage(fakes.stores, clock, fakes.events, {
      jobId: job.id,
      senderId: CLEANER,
      senderRole: "cleaner",
      body: "On my way.",
    });
    expect(fromCleaner.senderId).toBe(CLEANER);
    expect(seen.map((m) => m.id)).toEqual([fromHost.id, fromCleaner.id]);
    unsubscribe();
  });

  it("send rejects open jobs, strangers, and missing jobs", async () => {
    const open = makeJob({
      status: "open",
      claimedByCleanerId: null,
    });
    const claimed = makeJob();
    const fakes = makeFakes([open, claimed]);
    expect(
      await captureCode(
        sendMessage(fakes.stores, clock, fakes.events, {
          jobId: open.id,
          senderId: HOST,
          senderRole: "host",
          body: "Too early.",
        }),
      ),
    ).toBe("JOB_NOT_OPEN");
    expect(
      await captureCode(
        sendMessage(fakes.stores, clock, fakes.events, {
          jobId: claimed.id,
          senderId: STRANGER,
          senderRole: "cleaner",
          body: "Not my job.",
        }),
      ),
    ).toBe("NOT_JOB_PARTY");
    expect(
      await captureCode(
        sendMessage(fakes.stores, clock, fakes.events, {
          jobId: "99999999-9999-4999-8999-999999999999",
          senderId: HOST,
          senderRole: "host",
          body: "Nowhere.",
        }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("list returns chronological history with totals, parties only", async () => {
    const job = makeJob();
    const fakes = makeFakes(
      [job],
      [
        makeMessage({ jobId: job.id, createdAt: "2026-02-01T10:02:00.000Z" }),
        makeMessage({ jobId: job.id, createdAt: "2026-02-01T10:00:00.000Z" }),
        makeMessage({ jobId: job.id, createdAt: "2026-02-01T10:01:00.000Z" }),
      ],
    );
    const page = await listMessages(fakes.stores, {
      jobId: job.id,
      userId: CLEANER,
      limit: 2,
      offset: 0,
    });
    expect(page.total).toBe(3);
    expect(page.messages.map((m) => m.createdAt)).toEqual([
      "2026-02-01T10:00:00.000Z",
      "2026-02-01T10:01:00.000Z",
    ]);
    expect(
      await captureCode(
        listMessages(fakes.stores, {
          jobId: job.id,
          userId: STRANGER,
          limit: 50,
          offset: 0,
        }),
      ),
    ).toBe("NOT_JOB_PARTY");
  });

  it("listNewMessagesSince replays only what came after lastEventId", async () => {
    const job = makeJob();
    const first = makeMessage({ jobId: job.id });
    const second = makeMessage({ jobId: job.id });
    const fakes = makeFakes([job], [first, second]);
    const store = fakes.stores.chat;
    expect(
      await listNewMessagesSince(store, { jobId: job.id, lastEventId: null }),
    ).toEqual([]);
    expect(
      await listNewMessagesSince(store, {
        jobId: job.id,
        lastEventId: "nope-nope-nope",
      }),
    ).toEqual([]);
    const missed = await listNewMessagesSince(store, {
      jobId: job.id,
      lastEventId: first.id,
    });
    expect(missed.map((m) => m.id)).toEqual([second.id]);
    expect(
      await listNewMessagesSince(store, {
        jobId: job.id,
        lastEventId: second.id,
      }),
    ).toEqual([]);
  });

  it("assertJobParty accepts the host and the claiming cleaner", async () => {
    const job = makeJob();
    const fakes = makeFakes([job]);
    await expect(
      assertJobParty(fakes.stores, { jobId: job.id, userId: HOST }),
    ).resolves.toMatchObject({ id: job.id });
    await expect(
      assertJobParty(fakes.stores, { jobId: job.id, userId: CLEANER }),
    ).resolves.toMatchObject({ id: job.id });
    expect(
      await captureCode(
        assertJobParty(fakes.stores, { jobId: job.id, userId: STRANGER }),
      ),
    ).toBe("NOT_JOB_PARTY");
  });

  it("events deliver per job and stop after unsubscribe", async () => {
    const events = createChatEvents();
    const jobId = uid();
    const otherId = uid();
    const seen: Message[] = [];
    const unsubscribe = events.subscribe(jobId, (m) => {
      seen.push(m);
    });
    events.publish(makeMessage({ jobId }));
    events.publish(makeMessage({ jobId: otherId }));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.jobId).toBe(jobId);
    unsubscribe();
    events.publish(makeMessage({ jobId }));
    expect(seen).toHaveLength(1);
  });

  it("iterate streams published messages for the job", async () => {
    const events = createChatEvents();
    const jobId = uid();
    const iterator = events.iterate(jobId);
    const pending = iterator.next();
    const published = makeMessage({ jobId });
    events.publish(published);
    const first = await pending;
    expect(first.done).toBe(false);
    expect((first.value as Message).id).toBe(published.id);
    await iterator.return?.(undefined);
  });
});
