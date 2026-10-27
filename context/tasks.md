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

- [ ] Providers (auth, tRPC HTTP + WS, i18n) and theme tokens from `design.md`
- [ ] Auth screens: welcome, sign in, sign up with role pick
- [ ] Role-based tab bars (host vs cleaner)

### 6. Frontend — host flow

- [ ] My Jobs list, Post Job form, Job Detail with ranked suggestions, lifecycle actions
- [ ] Chat thread UI, Leave Review screen, Profile screen

### 7. Frontend — cleaner flow

- [ ] Ranked Board with filters (date, distance, price), Job Detail with claim (FlatList + keyExtractor, memoized rows, expo-image, accessibility labels on every interactive element)
- [ ] My Jobs, Chat thread UI, Leave Review screen, Profile + availability editor

### 8. Demo gate

- [ ] Seed script for demo accounts and jobs
- [ ] Full demo script passing on web + one native target

### Stretch (only if time allows)

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
