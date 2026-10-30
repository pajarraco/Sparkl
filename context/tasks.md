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

- [ ] Voice service + `voice.transcribe` router (base64, ~30s / 1.5 MB cap, never stored), mic button (`expo-audio` on native / `MediaRecorder` on web), transcript lands in the composer

#### P4 — Stretch (cut first; §12 learning L1 goes before it)

- [ ] Smart match explanations on ranked suggestions

#### Close-out

- [ ] e2e: new `assistant.spec.ts` (fake model, geo mocked); update `forms.spec.ts` + happy path for the map picker
- [ ] One real Baseten run, only after the owner approves the exact command (paid); tokens + latency recorded
- [ ] Docs: `project.md`, `architecture.md` (new services, provider switches, SSE not WebSocket, stale banner), `design.md`, `hackathon.md` Our Entry, `code-standard.md` + `AGENTS.md` banners, `README.md`, `CHANGELOG.md`
- [ ] Gates: `pnpm verify` green (coverage ≥ 80%) + `e2e` green, output quoted

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

- [ ] `job_requests` migration + `services/job-requests.ts` (request, offer, accept in one transaction, decline, withdraw, caps, authorization) + `jobRequests` router replacing `jobs.claim`; race and authorization tests
- [ ] UI: Request job (cleaner), Requests section + Offer job on suggestions (host), Offers in cleaner My Jobs, request badge on host cards; 02 "go with {cleaner}" becomes a real offer
- [ ] Scope docs in the same step (`project.md` MVP #4 + demo script, `README.md`, `architecture.md`), demo seed, e2e `happy-path` + `forms` + fixtures

#### E — Properties (after 02 P1)

- [ ] `properties` migration + `jobs.property_id` (nullable, snapshot copied on create), properties service + router with ownership checks
- [ ] Properties tab (five host tabs, `design.md` first) with list + add/edit using `AddressMapPicker`, archive instead of delete
- [ ] Post Job picks a property (notes from its checklist), assistant `list_properties` tool + `singleProperty` as a count, `properties.spec.ts` + Post Job e2e + seed

#### Close-out

- [ ] Per item: `pnpm verify` green (coverage ≥ 80%) + `e2e` green, output quoted; `CHANGELOG.md` and docs updated

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
- [ ] Gates: `pnpm verify` green + e2e (saved checklist proposed first in session 2; a checklist with a phone number refused), output quoted; `CHANGELOG.md` and docs updated. **Status:** `pnpm verify` green (shared 95, api 314, frontend 186). The assistant spec passes on both viewports. Full e2e is 34 passed, 36 failed, all in the older suites, and all pre-existing on the starting commit `180d0cf`: auth (host sign-up, sign-in, duplicate registration, the three role switches), forms (the two post-form tests), happy-path (both) and navigation (eight tests). Root causes are on branch 03, not here: the host tab bar is missing (03 item A2, nested stacks) and the old suites use `/host/...` URLs (03's URL move). Left open on purpose: close this gate after 03 merges and the full e2e run is green, output quoted. Docs and changelog for 04 are updated.

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
