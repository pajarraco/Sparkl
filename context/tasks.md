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

- [ ] `assistant_sessions` migration (no message text) + `jobAssistant.finish` (review-form diff, outcome)
- [ ] `get_host_history`, `singleProperty` / `usualCleaner` shortcuts, correction-rate prompt hints
- [ ] `suggest_price` (median of nearby comparable jobs; per-m² fallback in the weights config) + checklist drafting into the notes
- [ ] "Go with {cleaner} as always?" pins that cleaner to the top of the job's suggestions (real offer waits for 03's two-way assignment)

#### P3 — Voice

- [ ] Voice service + `voice.transcribe` router (base64, ~30s / 1.5 MB cap, never stored), mic button (`expo-audio` on native / `MediaRecorder` on web), transcript lands in the composer

#### P4 — Stretch (cut first)

- [ ] Smart match explanations on ranked suggestions

#### Close-out

- [ ] e2e: new `assistant.spec.ts` (fake model, geo mocked); update `forms.spec.ts` + happy path for the map picker
- [ ] One real Baseten run, only after the owner approves the exact command (paid); tokens + latency recorded
- [ ] Docs: `project.md`, `architecture.md` (new services, provider switches, SSE not WebSocket, stale banner), `design.md`, `hackathon.md` Our Entry, `code-standard.md` + `AGENTS.md` banners, `README.md`, `CHANGELOG.md`
- [ ] Gates: `pnpm verify` green (coverage ≥ 80%) + `e2e` green, output quoted

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
