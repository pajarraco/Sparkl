# Sparkl — Tasks

> Pending work and completed work. The demo script in [project.md](project.md) is the final acceptance gate — every box below exists to make that script pass end to end.

## Pending

### 1. Scaffolding & tooling

- [x] pnpm monorepo: `apps/frontend`, `apps/api`, `packages/*`
- [x] Shared TS + Biome config in `packages/config`
- [x] `docker-compose.dev.yml`: PostgreSQL, Redis, MinIO
- [x] `.env.example` + Commands section in `AGENTS.md`

### 2. Shared contracts

- [x] `packages/shared`: user / job / message / review Zod schemas + types
- [x] `packages/i18n`: English strings (frontend wiring lands with task 5)
- [x] Shared job-lifecycle states and error codes

### 3. Backend — core

- [x] Better Auth with `host` / `cleaner` roles
- [x] Drizzle schema + migrations (users, availability, jobs, messages, reviews)
- [x] Users router + service (profiles, availability, service area)
- [x] Jobs router + service (create, list, transactional claim, lifecycle, cancel)
- [x] Storage router + service (presigned URLs against local MinIO)

### 4. Backend — matching, chat, reviews

- [x] Matching service: on-read scoring (rating, distance, availability, completed jobs, acceptance rate, response time) + suggestions router
- [x] Unleash flag for ranking weights
- [x] Chat: send / list + `onMessage` subscription with job-party checks
- [x] Reviews: create (completed-only, unique per job + author) + average recompute

### 5. Frontend — shell & auth

- [x] Providers (auth, tRPC HTTP + SSE, i18n) and theme tokens from `design.md`
- [x] Auth screens: welcome, sign in, sign up with role pick
- [x] Role-based tab bars (host vs cleaner)

### 6. Frontend — host flow

- [x] My Jobs list, Post Job form, Job Detail with ranked suggestions, lifecycle actions
- [x] Chat thread UI, Leave Review screen (entries from Job Detail; reachable from history)
- [x] Profile screen (stub with sign-out only)

### 7. Frontend — cleaner flow

- [x] Ranked Board with filters (date, distance, price), Job Detail with claim (FlatList + keyExtractor, memoized rows, expo-image, accessibility labels on every interactive element)
- [x] My Jobs, Chat thread UI, Leave Review screen, Profile + availability editor

### 8. Demo gate

- [x] Seed script for demo accounts and jobs (`pnpm --filter @sparkl/api seed:demo`)
- [x] Full demo script passing on web + one native target (web: full `e2e` green both viewports; native: Expo Go device pass; gates: `pnpm verify` green — unit 165 + `tsc` clean + `biome check .` clean, all owner-observed this session)

### 9. Frontend — E2E testing (Playwright, web-only, local-only)

Spec: `context/features/01-e2e-testing-implementation.md` (grilled, 14 decisions agreed).

- [x] Groundwork: `@playwright/test` in `apps/frontend` (one-line new-dep justification), `playwright.config.ts` for local Expo web with 375px + wide projects, `e2e` script, web-only local-only scope documented
- [x] Fixtures: timestamped seed-shaped host/cleaner account factory, seeded open job, storage-state helpers for logged-in sessions
- [x] Auth suite (real UI): welcome → sign-up (host + cleaner) → sign-in → sign-out; invalid login, duplicate registration, Zod validation messages
- [x] Navigation suite (seeded session): deep-link + tab coverage per role, protected-route redirects when signed out, back-stack from job detail / chat / review
- [x] Forms and buttons suite (seeded session): Post Job create flow, board filters (date, distance, price), claim CTA, every primary button by accessible label
- [x] Scroll suite (seeded session): board FlatList scroll, pagination/lazy rows if present, no layout shift, at both viewports
- [x] Happy-path suite (seeded session): post → claim → chat (history-refetch assertions) → in-progress → completed → both reviews, end to end on web
- [x] Wire-up: separate documented `e2e` command (kept out of `pnpm verify`); tick Demo-gate boxes only with green `test` + `typecheck` + `lint` output quoted; `CHANGELOG.md` entry under `[Unreleased]`

### 10. Job-post assistant (Muse Spark on Baseten) + OSM maps

Spec: `context/features/02-integrate-baseten.md` (approved 2026-10-29). Phases are cut from the bottom (P4, then P3) if the Nov 4 deadline is at risk.

#### P0 — Spike (no merge)

- [x] Tool calling on Muse Spark Open (Baseten) and Glimmer (Ollama) with the four agent tools (both pass; results in 02 Verified Facts)
- [x] `react-native-maps` + OSM `UrlTile` on RN 0.88 in Expo Go; `react-leaflet` on Expo web (iPhone + web pass; Android unchecked)
- [x] Muse Voice Transcribe endpoint + audio formats with `META_MODEL_IMAGE_API_KEY` (WAV only; 02 Verified Facts)
- [x] Owner decision: address per job in 02, properties table moves to 03

#### P1 — Core

- [x] Shared contracts: `jobDraftSchema`, assistant turn/finish, `geoPlaceSchema`, `transcribeInput`
- [x] LLM client (`services/llm.ts`, live + fake modes, `reasoning_effort: low`, token cap, timeout) + `.env.example` entries
- [x] Geo service (OSM: Photon autocomplete, Nominatim geocode/reverse, cache, 1 req/s, User-Agent) + `geo` router
- [x] Job-assistant agent loop (`update_draft`, `geocode_address`; 6-step cap; Zod on every tool argument and output) + `jobAssistant.turn` router
- [x] Post tab assistant UI + pre-filled review form; "Use the form instead" keeps the draft
- [x] `AddressMapPicker` on the review form (native + web), replacing the lat/lng fields
- [x] Cleaner `ServiceAreaMapPicker` (pin + radius) + a single save button for service area and availability (from 03)

#### P2 — Smart

- [x] `assistant_sessions` migration (no message text) + `jobAssistant.finish` (review-form diff, outcome)
- [x] `get_host_history`, `singleProperty` / `usualCleaner` shortcuts, correction-rate prompt hints
- [x] `suggest_price` (median of nearby comparable jobs; per-m² fallback in the weights config) + checklist drafting into the notes
- [x] "Go with {cleaner} as always?" pins that cleaner to the top of the job's suggestions (real offer waits for 03's two-way assignment)

#### P3 — Voice

- [x] Voice service + `voice.transcribe` router (base64, ~30s / 1.5 MB cap, never stored), mic button (`expo-audio` on native / `MediaRecorder` on web), transcript lands in the composer. iOS + web only: Android has no WAV recording path yet (02 Verified Facts, "Voice format gap"), so the mic button is hidden there, matching the plan's own fallback. No real Muse Voice Transcribe call made yet (paid, owner approval pending — tracked under 02 Close-out item 16). `pnpm verify` green: shared 95, api 354 (+22 voice), frontend 205 (+17 voice/wav-encode), lint clean, typecheck clean across all 5 projects.

#### P4 — Stretch (cut first; §12 learning L1 goes before it)

- [ ] Smart match explanations on ranked suggestions

#### Close-out

- [x] e2e: new `assistant.spec.ts` (fake model, geo mocked); update `forms.spec.ts` + happy path for the map picker — confirmed in the full e2e run (70/70, 2026-11-02): `assistant.spec.ts` passes both viewports, `forms.spec.ts` covers `post-job-map` with tile-route mocking
- [x] One real Baseten run, only after the owner approves the exact command (paid); tokens + latency recorded. **2026-11-02**, owner-approved command: API started with `LLM_MODE=live LLM_BASE_URL=https://inference.baseten.co/v1 LLM_MODEL=meta-models/muse-spark-open-1026 LLM_API_KEY=<BASETEN_API_KEY>`, one turn sent via `jobAssistant.turn` ("I need a studio cleaned next Tuesday 9am to 11am, address 10 Queen Street, Auckland") as the seeded demo host. Model correctly called `geocode_address` + `get_host_history` and asked the host to disambiguate between 5 OSM matches. Logged: `model: meta-models/muse-spark-open-1026, steps: 2, inputTokens: 3886, outputTokens: 540, latencyMs: 10757, outcome: reply`. Server returned to fake/local mode immediately after; `.env` untouched (key passed only via the one-off process environment).
- [x] Docs: `project.md`, `architecture.md` (new services, provider switches, SSE not WebSocket, stale banner), `design.md`, `hackathon.md` Our Entry, `code-standard.md` + `AGENTS.md` banners, `README.md`, `CHANGELOG.md`. **2026-11-02:** `project.md` and `design.md` content were already current (assistant, voice, map picker, chips all documented); fixed stale "planned/no implementation" banners in `architecture.md` and `design.md`, the stray "WebSocket" claims in `architecture.md` (API client + Key Decisions, both actually SSE), the "(when created)" / "planned" wording in `AGENTS.md`'s Start Here list, `README.md`'s "Project Structure (Planned)" heading and its `context/archive/` claim, and added voice to `hackathon.md`'s Our Entry. `code-standard.md` banner was already correct.
- [x] Gates: `pnpm verify` green (coverage ≥ 80%) + `e2e` green, output quoted. **2026-11-02:** `pnpm verify` green (frontend 205 tests / 23 files, biome clean on 238 files, typecheck clean across all 5 workspace projects); `pnpm --filter @sparkl/frontend e2e` green (70/70). Section 10 is closed.

### 11. Improvements and issues

Spec: `context/features/03-improvements-issues.md` (approved 2026-10-29). Built on `feat/03-improvements` in its own worktree, alongside 02. A1–C start now; D waits for 02 P2, E for 02 P1. Cut from the bottom (E, then D) if the Nov 4 deadline is at risk.

#### A — Bugs

- [ ] A1 Role switch on web: failing e2e repro (host → sign out → cleaner and reverse), diagnose, shared `signOutAndReset()` that also clears the React Query cache; confirm on one Expo Go target
- [ ] A2 Navigation: nested stacks per tab via shared routes (detail screens keep the tab bar), `BackButton` in `Screen` with a deep-link fallback (`design.md` first), Post redirect into the My Jobs stack, `navigation.spec.ts` updated

#### B — Messages

- [x] `listThreads` service + `chat.listThreads` router + shared `chatThreadSchema` (party-only, last message, newest first), thread list on both Messages tabs, happy-path e2e checks the thread

#### C — Board filters

- [x] Filter chips + bottom sheet in `design.md`, chip row (date, distance, price) opening an RN `Modal` sheet, chip-label helpers in `ranked-board.ts` with tests, `forms.spec.ts` board filters updated

#### D — Two-way assignment (after 02 P2)

- [x] `job_requests` migration + `services/job-requests.ts` (request, offer, accept in one transaction, decline, withdraw, caps, authorization) + `jobRequests` router replacing `jobs.claim`; race and authorization tests. **2026-11-02:** already implemented — `0005_job_requests.sql`, `services/job-requests.ts` (17 passing tests: ownership/role checks, per-cleaner and per-job caps, mutual-interest dedup, accept race lost to a competing claim, decline/withdraw authorization, `listRequestsForJob`/`listMyJobRequests`, `closePendingForCancelledJob`), `jobRequestsRouter` wired into `trpc/router.ts`. `jobs.claim` still exists (the atomic re-check `acceptRequest` builds on) but no client calls it, matching `architecture.md`.
- [x] UI: Request job (cleaner), Requests section + Offer job on suggestions (host), Offers in cleaner My Jobs, request badge on host cards; 02 "go with {cleaner}" becomes a real offer. **2026-11-02:** Request job, host Requests section + Offer job on suggestions, and cleaner Offers section were already built. Added the one missing piece, the request badge on host My Jobs cards: a new grouped `jobRequests.pendingCounts` query (one query for the whole list, not one per card), `requestBadgeLabel` pure helper, `JobCard`'s `requestBadgeLabel` prop, `design.md` Request badge entry first. Also wired 02's "go with {cleaner}" pin into a real offer: `jobs.create` now calls `jobRequestsService.offerJob` when `preferredCleanerId` is set (best effort, never blocks the post). Tests: +1 api service test (`countPendingRequestsByHost`), +1 frontend (`requestBadgeLabel`). Verified: `pnpm verify` green (api 355, frontend 206; biome clean; typecheck clean), full `e2e` green (70/70).
- [x] Scope docs in the same step (`project.md` MVP #4 + demo script, `README.md`, `architecture.md`), demo seed, e2e `happy-path` + `forms` + fixtures. **2026-11-02:** `project.md` (MVP #4, demo script) and `architecture.md` (API Surface, Data Flows) already describe request/offer correctly. Fixed one stale line in `README.md`'s on-device demo pass ("claims it" → "requests it ... host accepts"). Demo seed leaves the job `open` on purpose, so the live demo exercises the real request flow. e2e already covers it: `happy-path.spec.ts` ("request, accept, chat, history refetch") and `forms.spec.ts` ("request CTA requests the job from its detail").

#### E — Properties (after 02 P1)

- [x] `properties` migration + `jobs.property_id` (nullable, snapshot copied on create), properties service + router with ownership checks. **2026-11-02:** `0006_properties.sql`, `services/properties.ts` (5 tests: ownership, archived-only-owner, archive-vs-active listing), `drizzlePropertiesStore`, `propertiesRouter` (create/list/update/archive) wired into `trpc/router.ts`. `jobs.create` takes an optional `propertyId` and snapshots the property's address/lat/lng/size onto the job (+2 `jobs.test.ts` cases: snapshot-and-ignore-client-values, reject-stranger-or-archived); a direct address/lat/lng still works for the assistant's one-off flow.
- [x] Properties tab (five host tabs, `design.md` first) with list + add/edit using `AddressMapPicker`, archive instead of delete. **2026-11-02:** `design.md` updated first (Navigation five-tab host list, Property row component). New `(properties)` host tab (`tabs.ts`, between My Jobs and Post) with its own Stack: `properties.tsx` list (empty state, skeleton, retry, refetch-on-focus) and `property/new.tsx` / `property/[id].tsx` reusing `AddressMapPicker` (`testIDPrefix="property"`), plus an Archive button with a visible confirmation (a fire-and-forget mutation with no UI feedback let a caller — and the e2e test — navigate away before it finished; fixed by awaiting it and showing `strings.properties.archived`).
- [x] Post Job picks a property (notes from its checklist), assistant `list_properties` tool + `singleProperty` as a count, `properties.spec.ts` + Post Job e2e + seed. **2026-11-02:** `PostJobForm` gets a property-chip picker above the address field (selecting one fills the address/coords and, if notes are empty, the property's checklist; "Add your first property" with none saved); `validatePostJob` gains an optional `propertyId` that skips the address/coordinate checks (+1 test). Assistant: `host-memory.ts`'s `singleProperty` now prefers an exactly-one-active-property host over the old job-address heuristic, and is cleared (not guessed) when there is more than one (+3 tests); new `list_properties` tool, offered whenever a properties store is passed and there isn't a single property already pre-filling the draft (+1 test). New e2e `properties.spec.ts`: add a property, pick it on Post Job, post the job, archive it, confirm it drops off the active list and the picker. Demo seed (`seed-demo.mjs`) now creates a demo property and posts the demo job for it, idempotently. Verified: `pnpm verify` green (api 366, frontend 213; biome clean; typecheck clean), full `e2e` green (72/72).

#### Close-out

- [x] Per item: `pnpm verify` green (coverage ≥ 80%) + `e2e` green, output quoted; `CHANGELOG.md` and docs updated. **2026-11-02:** all of A–E done. Final gate: `pnpm verify` green (api 366 tests, frontend 213 tests; biome clean on 250 files; typecheck clean across 5 workspace projects), full `pnpm e2e` green (72/72, including the new `properties.spec.ts`). `project.md`, `README.md` and `architecture.md` updated for properties (Database table, API Surface, Data Flows) and the two-way-assignment offer wiring; `CHANGELOG.md` entries appended.

### 12. Assistant learning from use (solutions store)

Spec: `context/features/04-assistant-learning.md` (approved 2026-10-29). L1 ships before Nov 4, ahead of 02 P4. Votes come only from the host's response; only answers are stored, never messages or personal data; shared across hosts with the host's own first.

Resume here (2026-10-30): §12 steps 1–10 are done on `feat/04-assistant-learning` (not committed by the agent; the owner committed the work). The only open box is the e2e gate, which is blocked by pre-existing failures in the older suites until branch 03 merges (see the gates line). Migrations `0003` and `0004` are applied to the local dev DB. Start the stack with `docker compose -f docker-compose.dev.yml up -d`.

- [x] Shared: solution kinds + payload schemas, `SOLUTION_TAGS`, `SOLUTION_RANKING_CONFIG`, `proposals` on the turn output, `assistantFeedbackInput`
- [x] Pure services + tests: ranking (Wilson × recency, host-first), personal-data check, payload fingerprint
- [x] `assistant_solutions` + `assistant_solution_events` migration (`0003`) and store
- [x] `find_solutions` / `save_solution` tools in the agent loop (Zod args, save cap, quoted results, `proposed` events)
- [x] Feedback: `jobAssistant.feedback` (chip taps) + accept/reject from the review-form diff in `finish`
- [x] Sharing: fingerprint → global row, 3 distinct hosts with posted jobs, rejected-by-host never re-proposed, `solutions:retire` script
- [x] 02 price hint + usual-cleaner offer report into `offer_preference`
- [x] UI: "Use this" / "Not this" chips under proposals (i18n; `design.md` first if a style is new)
- [x] Seed: 3 obviously-fake global checklists + 3 FAQ entries
- [x] Gates: `pnpm verify` green + e2e (saved checklist proposed first in session 2; a checklist with a phone number refused), output quoted; `CHANGELOG.md` and docs updated. **Status (2026-11-02):** 03 (A1/A2) confirmed on Expo Go and merged into `main`. `pnpm verify` green: frontend 205 tests passed (23 files), biome clean, typecheck clean across all 5 workspace projects. Full `pnpm e2e` green: 70/70 passed, including `assistant.spec.ts` on both viewports. The two earlier assistant-spec failures (stuck on `assistant-thinking`) were a stale leftover API process reused via Playwright's `reuseExistingServer` on port 3000, not a code defect — killed it, reran against a fresh server, and it passed in ~9s. Docs and changelog for 04 are updated.

### Stretch (only if time allows)

Deferred in full on 2026-10-29 (owner decision, demo gate closed first).

- [ ] Push notifications
- [ ] Spanish strings
- [ ] Maestro e2e smoke test

## Done

- [x] `context/project.md` — scope, MVP, demo script
- [x] `context/architecture.md` — system design, data flows, trust boundaries
- [x] `context/design.md` — visual spec, tabs, screens, job card
- [x] `context/code-standard.md` — language, testing, validation, security rules
- [x] `context/rules.md` — project guardrails
- [x] `AGENTS.md`, `README.md`, `CHANGELOG.md` — repo docs and changelog
