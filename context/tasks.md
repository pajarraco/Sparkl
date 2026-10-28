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
- [ ] My Jobs, Chat thread UI, Leave Review screen, Profile + availability editor

### 8. Demo gate

- [ ] Seed script for demo accounts and jobs
- [ ] Full demo script passing on web + one native target

### Stretch (only if time allows)

- [ ] Push notifications
- [ ] Spanish strings
- [ ] Maestro e2e smoke test

### 9. Frontend — E2E testing (Playwright, web-only, local-only)

Spec: `context/features/01-e2e-testing-implementation.md` (grilled, 14 decisions agreed).

- [ ] Groundwork: `@playwright/test` in `apps/frontend` (one-line new-dep justification), `playwright.config.ts` for local Expo web with 375px + wide projects, `e2e` script, web-only local-only scope documented
- [ ] Fixtures: timestamped seed-shaped host/cleaner account factory, seeded open job, storage-state helpers for logged-in sessions
- [ ] Auth suite (real UI): welcome → sign-up (host + cleaner) → sign-in → sign-out; invalid login, duplicate registration, Zod validation messages
- [ ] Navigation suite (seeded session): deep-link + tab coverage per role, protected-route redirects when signed out, back-stack from job detail / chat / review
- [ ] Forms and buttons suite (seeded session): Post Job create flow, board filters (date, distance, price), claim CTA, every primary button by accessible label
- [ ] Scroll suite (seeded session): board FlatList scroll, pagination/lazy rows if present, no layout shift, at both viewports
- [ ] Happy-path suite (seeded session): post → claim → chat (history-refetch assertions) → in-progress → completed → both reviews, end to end on web
- [ ] Wire-up: separate documented `e2e` command (kept out of `pnpm verify`); tick Demo-gate boxes only with green `test` + `typecheck` + `lint` output quoted; `CHANGELOG.md` entry under `[Unreleased]`

## Done

- [x] `context/project.md` — scope, MVP, demo script
- [x] `context/architecture.md` — system design, data flows, trust boundaries
- [x] `context/design.md` — visual spec, tabs, screens, job card
- [x] `context/code-standard.md` — language, testing, validation, security rules
- [x] `context/rules.md` — project guardrails
- [x] `AGENTS.md`, `README.md`, `CHANGELOG.md` — repo docs and changelog
