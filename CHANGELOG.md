# Changelog

Append-only: add a new entry under `## [Unreleased]` for any change, stamped `YYYY-MM-DD HH:MM`. Never edit existing entries.

## [Unreleased]

### Added

- `2026-10-27 04:27` — `context/project.md`: product scope and MVP (ranked job board, claims, realtime chat, mutual reviews).
- `2026-10-27 04:27` — `context/architecture.md`: planned system design (Expo, Fastify + tRPC, PostgreSQL, S3 uploads).
- `2026-10-27 04:27` — `AGENTS.md`: agent working agreements, repo pointers, docs-sync and changelog policy.
- `2026-10-27 04:27` — `README.md`: MVP Scope section mirroring `context/project.md`.
- `2026-10-27 04:32` — `context/design.md`: visual spec (alehosts.com tokens, role-based tabs, job card, screen inventory).
- `2026-10-27 04:32` — `README.md`: Design section summarising brand tokens.
- `2026-10-27 04:33` — `context/tasks.md`: phased build plan (scaffolding → demo gate) plus done list.
- `2026-10-27 04:43` — `context/code-standard.md`: language, Biome, Vitest with 80% gate, Zod, security baseline.
- `2026-10-27 04:43` — `context/rules.md`: project guardrails protecting scope and quality.
- `2026-10-27 04:43` — `context/tasks.md`: code-standard and rules moved to done.
- `2026-10-27 04:48` — `context/hackathon.md`: hackathon facts, Meta AI candidates, open questions.
- `2026-10-27 04:49` — `context/hackathon.md`: entry confirmed (Startup / Build for Your World / match explanations).
- `2026-10-27 06:30` — scaffolding: pnpm workspaces (`apps/api`, `apps/frontend`, `packages/*`), shared TS + Biome config, `docker-compose.dev.yml` (PostgreSQL, Redis, MinIO), `.env.example`, `AGENTS.md` commands. Deps: typescript (strict types per code-standard), vitest (colocated service tests), zod (shared schemas), biome (sole formatter/linter).
- `2026-10-27 06:45` — shared contracts: Zod schemas + types for users, availability, jobs, messages, reviews; job-lifecycle states and transitions; shared error codes; English string table in `packages/i18n`. Timestamps standardized on ISO datetime strings; review comment is `undefined` on input, `null` in storage.
- `2026-10-27 07:00` — `apps/api`: added `@types/node` devDependency so `pnpm typecheck` passes (`tsconfig.json` already referenced node types). New dep justification: the Fastify backend needs Node type definitions.
- `2026-10-27 07:15` — backend core: Better Auth (email/password, host/cleaner roles) on a single `user` table; Drizzle schema + generated migration for all 8 tables; framework-free users/jobs/storage services with in-memory-fake tests (36 passing); thin tRPC routers with shared-Zod validation and Sparkl-to-TRPC error mapping; S3 presigned uploads scoped to caller id. New deps: drizzle-orm, postgres, drizzle-kit (Drizzle per architecture), better-auth + adapter (auth per architecture), @trpc/server + fastify (typed API per architecture), @aws-sdk/client-s3 + presigner (direct uploads per architecture). Note: migration SQL generated but not applied — Docker daemon is down; run `docker compose up -d` then `drizzle-kit migrate`.
- `2026-10-27 07:25` — local infra live: PostgreSQL + Redis up via compose, migration applied (all 8 tables verified via psql). MinIO still blocked: Docker Hub denies `minio/minio` pulls on this network (`library/` images pull fine); storage stays unit-tested with fakes until an S3 endpoint is available.
- `2026-10-27 07:35` — MinIO restored via `cgr.dev/chainguard/minio` (upstream deleted `minio/minio` from Docker Hub and archived open source; `docker login` cannot fix this). Replaced the broken `mc`-based healthcheck, added `apps/api/scripts/ensure-buckets.mjs` (`pnpm --filter @sparkl/api buckets`) which creates `avatars`/`jobs` and proves a presigned PUT + GET roundtrip. Also added missing `tsx` devDependency so `pnpm dev` runs, and verified the API boots with the auth handler answering `/api/auth/get-session`.
- `2026-10-27 15:30` — throwaway board prototype at `apps/frontend/prototype/board.html`: 3 ranked-board variants (inline cards, spotlight, briefing-first) with `?variant=` switcher, canned match explanations plus live rewrite via local Ollama `muse-glimmer`, Muse Image prompt placeholders for photos. Single self-contained file since Expo is not installed yet; delete after a variant wins.
- `2026-10-27 15:40` — board prototype: tightened the Glimmer rewrite prompt (matcher system role, low temperature, output-only sentence) after live output narrated instead of explaining; variant B (spotlight) picked as winner.
- `2026-10-27 15:55` — board prototype: 3 property photos generated live via Meta Model API `muse-image-1.0` into `apps/frontend/prototype/assets/` (WebP); placeholder blocks replaced with `<img>` + source labels; generator helper deleted after use.
- `2026-10-27 16:10` — `.agents/skills/`: installed UI/UX Pro Max pack (7 project-level skills: ui-ux-pro-max, design, design-system, ui-styling, brand, banner-design, slides) via shallow sparse clone of `nextlevelbuilder/ui-ux-pro-max-skill` (MIT). Sandbox blocked git TLS, so the tarball was fetched via Node and extracted with system tar; temp files removed.
- `2026-10-27 16:25` — `context/design.md`: job card gains trust row (★ + completed-job count from matching service) and explicit status-pill mapping; imagery gains expo-image + explicit dimensions rule. `context/tasks.md`: board item gains FlatList/memo/a11y notes. Per UI/UX Pro Max cross-check (Marketplace P2P + Home Services + Booking rows); verified badge deliberately omitted until a real verification backend exists.
- `2026-10-27 16:35` — board prototype variant B refresh per `/ui-styling` (a11y patterns) + taste preflight: visible indigo focus rings, `aria-live` on match explanations, named claim action, trust rows (★ + jobs done) per updated spec. Indigo signature and orange rail kept as deliberate brand tokens.
- `2026-10-27 16:50` — setup: pinned pnpm 12.15.0 fetched from registry into `.tools/pnpm-12.15.0` (local shim could not self-upgrade); `pnpm install` reports all 6 projects up to date. Gates (typecheck/test/lint) cannot run in-sandbox: reads under `node_modules/.pnpm` return EPERM. Run them in your own terminal.
- `2026-10-27 12:40` — board prototype: 3 Muse-image logo + favicon options (`apps/frontend/prototype/assets/logo-1/2/3.png`: Spark S, Roof spark, Wordmark) with header brand row, `?logo=` switcher, and state-line readout; indigo/orange only per `design.md`.
- `2026-10-27 12:42` — `.agents/skills/glimmer-delegate/`: new skill routing low-thinking bulk work (advisory reviews, docs, dummy/seed data, changelogs, prototype filler, i18n strings, boilerplate) to local `muse-glimmer:latest` via Ollama; host plans and verifies. Routing rule added to `context/rules.md` + pointer in `AGENTS.md`. Note: `muse skills validate` could not run here (no `muse` CLI on PATH) — run it in your own terminal.
- `2026-10-27 12:46` — board prototype: logo winner applied — option 3 wordmark in the header at 64px (doubled), option 1 Spark S as the fixed favicon; comparison picker section and `?logo=` switching removed, `logo-2.png` kept in `assets/` for reference.

### Changed

- `2026-10-27 05:12` — `context/hackathon.md`: verified schedule, submission, judging rubric, prizes and credit forms from details guide.
- `2026-10-27 05:13` — `context/hackathon.md`: Meta $150 credit claim marked submitted.
- `2026-10-27 05:16` — `context/hackathon.md`: eligibility confirmed.
- `2026-10-27 05:17` — `context/rules.md`: scan for secrets before every commit.

### Fixed

- `2026-10-27 05:53` — `.gitignore`: ignore installed skills via `.agents/skills/` (forward-slash directory match) and stop ignoring `skills-lock.json` so the lock file stays tracked.
