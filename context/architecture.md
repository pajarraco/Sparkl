# Sparkl — Architecture

> Status: planned — no implementation exists yet. This page is the build spec; paths below are targets. Product scope lives in [project.md](project.md).

## Overview

pnpm monorepo with a strict split between transport and logic:

```
Expo app ──HTTP + WebSocket──▶ Fastify + tRPC ──▶ Service layer ──▶ PostgreSQL
(iOS/Android/Web)              (routers: validate     (business logic)   (Drizzle ORM)
                                + delegate)
```

- All business logic lives in `apps/api/src/services/`. tRPC procedures validate input with shared Zod schemas and delegate — nothing else.
- Shared contracts live in `packages/shared` (Zod schemas, types, constants) and are imported by both frontend and backend.
- This split lets a public REST API be added later by calling the same services.

## Frontend (`apps/frontend`)

- **Expo + Expo Router:** one codebase for iOS, Android and Web. Screens in `app/`, UI in `components/` (atomic design), cross-cutting setup in `providers/`.
- **API client:** tRPC client over two links — HTTP batch link for queries/mutations, WebSocket link for subscriptions (chat). React Query handles caching.
- **Auth:** Better Auth Expo integration; session persisted on native, cookie on web.
- **Styling:** NativeWind v4.
- **Strings:** all user-facing text via `packages/i18n` (English now, Spanish later).

## Backend (`apps/api/src`)

| Folder | Responsibility |
| ------ | -------------- |
| `trpc/` | Routers, procedures, auth middleware. Validate → authorize → call service. |
| `services/` | Business logic: jobs, matching, chat, reviews, users, storage, the job-post assistant and its solutions store. Framework-free. |
| `db/` | Drizzle schema, migrations, client. |
| `plugins/` | Fastify plugins: auth, CORS, WebSocket, error handling. |
| `jobs/` | BullMQ workers (stat recomputation, cleanup). Minimal in MVP. |

- **Framework:** Fastify; chat subscriptions ride SSE over HTTP (`httpSubscriptionLink`), so no WebSocket adapter is installed.
- **Auth:** Better Auth (Fastify plugin), email/password, with `role` (`host` / `cleaner`) on the user. OAuth is post-MVP.
- **Flags:** Unleash for feature flags (e.g. ranking weight tuning).

## Database (PostgreSQL + Drizzle)

PostgreSQL via Docker locally; Drizzle ORM with versioned migrations in the repo.

### Core tables

| Table | Key columns |
| ----- | ----------- |
| `users` | id, role, name, photo URL, service-area lat/lng + radius, avg rating, completed-job count, timestamps |
| `cleaner_availability` | cleaner id, weekday, start/end time (feeds availability-overlap ranking) |
| `jobs` | id, host id, address + lat/lng, date/time window, size and notes, price, status, claimed-by cleaner id, timestamps |
| `messages` | id, job id, sender id, body, created at |
| `reviews` | id, job id, author id, subject id, stars (1–5), comment; unique per (job, author) |
| `assistant_sessions` | id (client uuid), host id, job id, outcome, counts (turns, tool calls, tokens, latency), fields the model filled and the host changed, solution saves (cap 3); never message text |
| `assistant_solutions` | id, scope (`host` / `global`), host id, kind, tags (closed list), JSON payload checked against its kind's schema, fingerprint, source, status, counters, score; partial unique indexes on (host, fingerprint) and (global fingerprint) |
| `assistant_solution_events` | solution id, session id, host id, event (`proposed` / `accepted` / `rejected`), at; unique per (solution, session, event) |

- **Job status:** `open → claimed → in_progress → completed`, plus `cancelled`.
- **Indexes:** `jobs(status, date)`, `messages(job_id, created_at)`, `reviews(subject_id)`.
- **Geo:** plain lat/lng columns; distance scored with haversine in the matching service. PostGIS only if scale demands it later.

## API Surface (tRPC Routers)

| Router | Procedures |
| ------ | ---------- |
| `users` | profile get/update, availability set, cleaner public profile |
| `jobs` | create, ranked list (cleaner board), my jobs (host), claim, status transitions, cancel |
| `suggestions` | ranked cleaners for a job (host view); a cleaner pinned by the assistant (`jobs.preferred_cleaner_id`, the host's usual cleaner) sorts first, as an order only, never an assignment |
| `chat` | message list, send, `onMessage` subscription per job, `listThreads` (the caller's conversations for the Messages tab) |
| `reviews` | create (after completion), list by user |
| `storage` | presigned upload URL |

Every input and output is validated with the shared Zod schemas. No public REST in MVP.

## Realtime Chat

- tRPC `onMessage` subscription over SSE (same HTTP endpoint), one channel per job.
- Client subscribes when the chat screen opens and refetches history on reconnect (covers dropped Expo Go connections).
- Single API instance in MVP; Redis pubsub only if scaled horizontally later.

## File Storage

- S3-compatible: MinIO in `docker-compose.dev.yml` for local dev, R2/S3 in production — same code path.
- Flow: client requests `storage.getUploadUrl` → uploads the file directly → saves the returned key (avatar or job photo).
- Buckets: `avatars`, `jobs`.

## Ranking (Matching Service)

- Scores computed **on read** in the matching service (no precompute pipeline in MVP).
- Signals: average rating, distance, availability overlap, completed-job count, claim acceptance rate, response time.
- Weights live in one config object behind an Unleash flag so they can be tuned without deploys.

## Assistant Learning (Solutions Store, 04)

- The assistant reuses answers it has seen work. Kinds are closed: `checklist`, `window_preference`, `offer_preference`, `faq`. Tags come from a closed list. No free text is ever stored as a trigger, and no message text is stored.
- **Writers:** the model may save only checklists and window preferences, at most 3 per session (enforced by one conditional `UPDATE` on `assistant_sessions`). FAQs are seed-only, and the service owns offers. Every save passes a personal-data check (emails, URLs, phone numbers, runs of 4+ digits, street addresses, and the host's or usual cleaner's name).
- **Ranking:** `score = Wilson lower bound (95%) × recency (30-day half-life)` over accepted and rejected votes. Proposals alone never raise a score. The host's own rows come first, other hosts' rows are never read, and a global row the host rejected is never proposed to them again.
- **Votes come only from the host:** the "Use this" / "Not this" chips (`jobAssistant.feedback`) and, at `jobAssistant.finish` for a posted job, whether the host kept a field the model filled. The model never votes. One vote per session; a host candidate becomes active on its first acceptance and is retired after 3 rejections in a row.
- **Sharing:** an accepted host checklist also makes one global copy, keyed by the fingerprint of its normalised payload. It turns active after 3 distinct hosts, each with a posted job, accept it. The owner retires global rows with `pnpm --filter @sparkl/api solutions:retire <id>`.
- **Offers:** the price hint and the usual-cleaner suggestion are host-scope rows too. Three ignores in a row stop the offer being shown. The usual cleaner is read from the saved job. The price-hint response is sent by the client, because the server does not store the hint's value.
- **Failure:** the store is best effort. Errors in finding, saving or voting make the tool answer with an error, and the turn carries on without solutions.

## Data Flows

**Post a job:** Host app → `jobs.create` → service validates and inserts → returns the job.

**Ranked board:** Cleaner app → `jobs.listRanked` → matching service scores open jobs → ordered list.

**Claim:** `jobs.claim` → service re-checks `status = open` in a transaction → sets `claimed`, records cleaner → chat unlocks.

**Chat:** `chat.send` → service checks sender is a party to the job → inserts message → publishes to the job channel → subscribers receive it.

**Assistant turn:** Post tab → `jobAssistant.turn` → service opens or counts the session (pinned to the caller), runs the tool loop (draft, geocoder, history, price hint, `find_solutions`, `save_solution`) and returns the reply, draft and `proposals`.

**Assistant feedback:** chip tap → `jobAssistant.feedback` → service checks the session is the caller's and open and the proposal was shown in it → one vote, with the status rules above.

**Assistant finish:** posting → `jobs.create`, then `jobAssistant.finish` (posted, job id, changed fields, price-hint response) → review-form votes and offer votes. Discarding a conversation sends "abandoned", which takes no votes.

**Review:** `reviews.create` → service checks job is `completed`, author is a party, and no review exists yet for (job, author) → inserts → recomputes subject's average rating.

## Trust Boundaries and Failure Modes

- The client is untrusted: every procedure input is validated with Zod, and every job-scoped action (chat, claim, review) re-checks that the caller is a party to the job.
- Uploads go direct to S3 via short-lived presigned URLs scoped to the caller's user id and bucket; the API never proxies file bytes.
- Claim races are resolved by re-checking `status = open` inside the claim transaction — the loser gets an "already claimed" error, never a double booking.
- If the chat WebSocket drops, the client refetches history on reconnect; no message is trusted from the socket alone.

## Local Development

`docker-compose.dev.yml` runs PostgreSQL, Redis (BullMQ) and MinIO. Typical flow: `pnpm dev` (installs, starts services, migrates, ensures buckets, then runs API + Expo) and `pnpm verify` (`test` + `lint` + `typecheck`). See `AGENTS.md` Commands.

## Key Decisions

- Realtime chat via tRPC subscriptions over WebSocket (not polling).
- Uploads via S3-compatible presigned URLs (MinIO local, R2/S3 prod).
- Distance via lat/lng + haversine; PostGIS deferred.
- Mutual reviews in MVP; average rating is the lead ranking signal.
