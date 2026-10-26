# Sparkl — Tasks

> Pending work and completed work. The demo script in [project.md](project.md) is the final acceptance gate — every box below exists to make that script pass end to end.

## Pending

### 1. Scaffolding & tooling

- [ ] pnpm monorepo: `apps/frontend`, `apps/api`, `packages/*`
- [ ] Shared TS + Biome config in `packages/config`
- [ ] `docker-compose.dev.yml`: PostgreSQL, Redis, MinIO
- [ ] `.env.example` + Commands section in `AGENTS.md`

### 2. Shared contracts

- [ ] `packages/shared`: user / job / message / review Zod schemas + types
- [ ] `packages/i18n`: English strings wired into the frontend
- [ ] Shared job-lifecycle states and error codes

### 3. Backend — core

- [ ] Better Auth with `host` / `cleaner` roles
- [ ] Drizzle schema + migrations (users, availability, jobs, messages, reviews)
- [ ] Users router + service (profiles, availability, service area)
- [ ] Jobs router + service (create, list, transactional claim, lifecycle, cancel)
- [ ] Storage router + service (presigned URLs against local MinIO)

### 4. Backend — matching, chat, reviews

- [ ] Matching service: on-read scoring (rating, distance, availability, completed jobs, acceptance rate, response time) + suggestions router
- [ ] Unleash flag for ranking weights
- [ ] Chat: send / list + `onMessage` subscription with job-party checks
- [ ] Reviews: create (completed-only, unique per job + author) + average recompute

### 5. Frontend — shell & auth

- [ ] Providers (auth, tRPC HTTP + WS, i18n) and theme tokens from `design.md`
- [ ] Auth screens: welcome, sign in, sign up with role pick
- [ ] Role-based tab bars (host vs cleaner)

### 6. Frontend — host flow

- [ ] My Jobs list, Post Job form, Job Detail with ranked suggestions, lifecycle actions
- [ ] Chat thread UI, Leave Review screen, Profile screen

### 7. Frontend — cleaner flow

- [ ] Ranked Board with filters (date, distance, price), Job Detail with claim
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
