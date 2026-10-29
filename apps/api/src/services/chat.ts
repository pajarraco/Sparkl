// Framework-free business logic: no drizzle/fastify imports allowed here.
// Per-job chat: the host and the claiming cleaner coordinate here. Chat
// unlocks when a job is claimed — sending on an open job is rejected.
// Single API instance in MVP: live delivery is an in-process event hub
// (ChatEvents); Redis pubsub replaces it if the API ever scales horizontally.
import { randomUUID } from "node:crypto";
import { EventEmitter, on } from "node:events";
import {
  CHAT_PREVIEW_MAX,
  type ChatThread,
  type Job,
  type ListMessagesInput,
  type Message,
  type SendMessageInput,
  type SparklErrorCode,
  type UserRole,
} from "@sparkl/shared";
import type { Clock, JobsStore } from "./jobs.js";
import type { UsersStore } from "./users.js";

export class ChatError extends Error {
  readonly code: SparklErrorCode;

  constructor(code: SparklErrorCode, message: string) {
    super(message);
    this.name = "ChatError";
    this.code = code;
  }
}

export interface ChatStore {
  listMessagesByJob(jobId: string): Promise<Message[]>;
  insertMessage(message: Message): Promise<Message>;
  /** The newest message of each given job (jobs without messages are absent). */
  latestMessagesByJobs(jobIds: string[]): Promise<Message[]>;
}

export interface ChatStores {
  jobs: Pick<JobsStore, "findJobById">;
  chat: ChatStore;
}

export interface ChatEvents {
  publish(message: Message): void;
  subscribe(jobId: string, listener: (message: Message) => void): () => void;
  iterate(jobId: string, signal?: AbortSignal): AsyncIterableIterator<Message>;
}

export function createChatEvents(): ChatEvents {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  const eventFor = (jobId: string): string => `job:${jobId}`;
  return {
    publish(message) {
      emitter.emit(eventFor(message.jobId), message);
    },
    subscribe(jobId, listener) {
      const event = eventFor(jobId);
      emitter.on(event, listener);
      return () => {
        emitter.off(event, listener);
      };
    },
    async *iterate(jobId, signal) {
      for await (const [message] of on(emitter, eventFor(jobId), {
        signal,
      })) {
        yield message as Message;
      }
    },
  };
}

function compareMessages(a: Message, b: Message): number {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

export async function assertJobParty(
  stores: Pick<ChatStores, "jobs">,
  args: { jobId: string; userId: string },
): Promise<Job> {
  const job = await stores.jobs.findJobById(args.jobId);
  if (job === null) throw new ChatError("NOT_FOUND", "Job not found.");
  if (args.userId !== job.hostId && args.userId !== job.claimedByCleanerId) {
    throw new ChatError(
      "NOT_JOB_PARTY",
      "Only a party to the job can use its chat.",
    );
  }
  return job;
}

export async function sendMessage(
  stores: ChatStores,
  clock: Clock,
  events: ChatEvents,
  args: SendMessageInput & { senderId: string; senderRole: UserRole },
): Promise<Message> {
  if (args.senderRole !== "host" && args.senderRole !== "cleaner") {
    throw new ChatError("FORBIDDEN", "Only hosts and cleaners can chat.");
  }
  const job = await assertJobParty(stores, {
    jobId: args.jobId,
    userId: args.senderId,
  });
  if (job.status === "open") {
    throw new ChatError("JOB_NOT_OPEN", "Chat unlocks after a job is claimed.");
  }
  const saved = await stores.chat.insertMessage({
    id: randomUUID(),
    jobId: args.jobId,
    senderId: args.senderId,
    body: args.body,
    createdAt: clock.nowIso(),
  });
  events.publish(saved);
  return saved;
}

export async function listMessages(
  stores: ChatStores,
  args: ListMessagesInput & { userId: string },
): Promise<{ messages: Message[]; total: number }> {
  await assertJobParty(stores, { jobId: args.jobId, userId: args.userId });
  const all = [...(await stores.chat.listMessagesByJob(args.jobId))].sort(
    compareMessages,
  );
  return {
    messages: all.slice(args.offset, args.offset + args.limit),
    total: all.length,
  };
}

// Catch-up for reconnecting subscribers: messages after lastEventId
// (exclusive). Unknown or absent ids yield nothing — the client refetches
// full history through listMessages on reconnect instead.
export async function listNewMessagesSince(
  store: Pick<ChatStore, "listMessagesByJob">,
  args: { jobId: string; lastEventId: string | null | undefined },
): Promise<Message[]> {
  if (args.lastEventId === null || args.lastEventId === undefined) return [];
  const all = [...(await store.listMessagesByJob(args.jobId))].sort(
    compareMessages,
  );
  const idx = all.findIndex((m) => m.id === args.lastEventId);
  if (idx === -1) return [];
  return all.slice(idx + 1);
}

export interface ChatThreadStores {
  jobs: Pick<JobsStore, "listJobsByHost" | "listJobsByCleaner">;
  chat: Pick<ChatStore, "latestMessagesByJobs">;
  users: Pick<UsersStore, "findById">;
}

// One line, at most CHAT_PREVIEW_MAX characters including the ellipsis.
export function chatPreview(body: string): string {
  const line = body.replace(/\s+/g, " ").trim();
  if (line.length <= CHAT_PREVIEW_MAX) return line;
  return `${line.slice(0, CHAT_PREVIEW_MAX - 1).trimEnd()}…`;
}

// Messages tab: every job the caller is a party to that has a chat — a
// claimed cleaner and a status past open; cancelled jobs only when someone
// wrote. The caller's own job list is the party check, so another user's
// thread can never appear. Newest activity first (last message, else the
// job's last update).
export async function listThreads(
  stores: ChatThreadStores,
  args: { userId: string; role: UserRole },
): Promise<ChatThread[]> {
  const jobs =
    args.role === "host"
      ? await stores.jobs.listJobsByHost(args.userId)
      : await stores.jobs.listJobsByCleaner(args.userId);
  const withChat = jobs.filter(
    (job) => job.claimedByCleanerId !== null && job.status !== "open",
  );
  if (withChat.length === 0) return [];
  const latest = new Map(
    (await stores.chat.latestMessagesByJobs(withChat.map((job) => job.id))).map(
      (message) => [message.jobId, message],
    ),
  );
  const visible = withChat.filter(
    (job) => job.status !== "cancelled" || latest.has(job.id),
  );
  const otherIdOf = (job: Job): string =>
    args.role === "host" ? (job.claimedByCleanerId ?? "") : job.hostId;
  const others = new Map(
    await Promise.all(
      [...new Set(visible.map(otherIdOf))].map(
        async (id) => [id, await stores.users.findById(id)] as const,
      ),
    ),
  );
  const threads = visible.flatMap((job): ChatThread[] => {
    const other = others.get(otherIdOf(job));
    if (other === null || other === undefined) return [];
    const message = latest.get(job.id);
    return [
      {
        jobId: job.id,
        jobStatus: job.status,
        address: job.address,
        windowStart: job.windowStart,
        otherParty: {
          id: other.id,
          name: other.name,
          photoUrl: other.photoUrl,
        },
        lastMessage:
          message === undefined
            ? null
            : {
                senderId: message.senderId,
                preview: chatPreview(message.body),
                createdAt: message.createdAt,
              },
        lastActivityAt: message?.createdAt ?? job.updatedAt,
      },
    ];
  });
  return threads.sort((a, b) =>
    a.lastActivityAt < b.lastActivityAt
      ? 1
      : a.lastActivityAt > b.lastActivityAt
        ? -1
        : 0,
  );
}
