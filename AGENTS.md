# AGENTS.md

Instructions for AI agents and human contributors working in this repo.

## Start Here

Read these before doing anything:

- `context/project.md` — product scope, goals, MVP features, demo script
- `context/architecture.md` — planned system design, data flows, trust boundaries
- `context/design.md` — UI design, look and feel (when created)
- `context/code-standard.md` — code style, testing, validation, libraries (when created)
- `context/rules.md` — dos and don'ts (when created)
- `context/tasks.md` — pending and completed work (when created)

No implementation exists yet — the `context/` files are the build spec.

## Working Agreements

- Ask before doing anything — never act autonomously.
- Work in small steps, one task at a time.
- Suggest ideas and improvements proactively.
- Always consider security implications.
- Keep documentation and change history updated.
- For low-thinking bulk work, delegate to local `muse-glimmer:latest` per `.agents/skills/glimmer-delegate/` (routing rule in `context/rules.md`).

## Architecture Rules

- All business logic lives in the service layer, never in tRPC procedures.
- Validate with shared Zod schemas (`packages/shared`) on both frontend and backend.
- Follow `context/architecture.md` for boundaries, data flows and failure handling.
- Follow `context/code-standard.md` once it exists; until then match the conventions in `context/architecture.md`.

## Docs Sync

- When a `context/` change affects scope or design, update the matching `README.md` section in the same step (MVP Scope mirrors `context/project.md`).
- Fix broken paths and stale claims in docs you touch; don't leave them for later.

## Changelog

- `CHANGELOG.md` is **append-only**: for any change, add a new entry under `## [Unreleased]`, stamped with date and time (`YYYY-MM-DD HH:MM`). Never edit, reword, reorder or delete existing entries.
- This append-only rule applies only to `CHANGELOG.md`. For all other files, update and remove whatever is no longer relevant as normal.
- Group entries under Added / Changed / Fixed / Removed / Security.

## Commands

- `pnpm install` — install all workspace dependencies (requires pnpm `12.15.0`)
- `docker compose -f docker-compose.dev.yml up -d` — start local PostgreSQL, Redis and MinIO
- `docker compose -f docker-compose.dev.yml down` — stop local services
- `pnpm --filter @sparkl/api buckets` — create local MinIO buckets and smoke-test presigned uploads (after compose up)
- `pnpm dev` — full local boot: install, compose up, migrate, buckets, then all workspace dev scripts in parallel
- `pnpm verify` — `test` + `lint` + `typecheck` in one go
- `pnpm test` — run the full test suite (recursive `vitest run`)
- `pnpm typecheck` — recursive `tsc --noEmit`
- `pnpm lint` — `biome check .`
- `pnpm format` — `biome check --write .`
