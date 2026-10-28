# Sparkl

A two-sided marketplace connecting vacation-rental hosts with cleaning professionals.

Built for the Meta Global AI Developer Hackathon with Expo (iOS, Android, Web), Fastify, tRPC, and PostgreSQL.

## MVP Scope

- Auth with host/cleaner roles
- Hosts post cleaning jobs; cleaners browse a ranked board and claim jobs
- Ranked suggestions in both directions (hosts see suggested cleaners, cleaners see ranked jobs)
- Job lifecycle: open → claimed → in progress → completed
- Per-job realtime chat
- Profiles with service area and availability
- Mutual reviews after completion (1–5 stars + comment)

Out of scope: in-app payments, auto-assignment, admin panel, Spanish translations.
Full scope: `context/project.md`.

## Tech Stack

- **Frontend:** Expo SDK, Expo Go, React Native, NativeWind v4
- **Backend:** Fastify, tRPC, Zod, Drizzle ORM, Better Auth
- **Data & Infra:** PostgreSQL, Docker, Unleash
- **Tooling:** Node.js 24, TypeScript, pnpm, Vitest

## Run Locally

Prerequisites: pnpm `12.15.0`, Docker Desktop, Node 24.

```powershell
pnpm install
# copy .env.example to .env and set a real BETTER_AUTH_SECRET
pnpm dev    # installs, starts Postgres/Redis/MinIO, migrates, then runs API (:3000) + Expo
```

Press `w` in the Expo terminal for web. `pnpm verify` runs `test` + `lint` + `typecheck`. All commands: `AGENTS.md`.

## Project Structure (Planned)

```
Sparkl/
├── apps/
│   ├── frontend/        # Expo app (iOS, Android, Web)
│   │   ├── app/         # Screens (Expo Router)
│   │   ├── components/  # UI components (atomic design)
│   │   ├── hooks/       # React hooks
│   │   ├── providers/   # Auth, tRPC providers
│   │   ├── e2e/         # Playwright E2E (Expo web, local-only)
│   │   └── utils/       # Utilities
│   │
│   ├── api/             # Fastify + tRPC backend
│   │   └── src/
│   │       ├── trpc/    # tRPC routers and middleware
│   │       ├── services/# Business logic (service layer)
│   │       ├── db/      # Drizzle schema and migrations
│   │       ├── plugins/ # Fastify plugins (auth, cors, etc.)
│   │       └── jobs/    # Background jobs (BullMQ)
│   │
│   └── admin/           # Admin panel (future)
│
├── packages/
│   ├── shared/          # Shared types, Zod schemas, constants
│   ├── i18n/            # Translations (English, Spanish)
│   └── config/          # Shared TypeScript and Biome config
│
├── context/             # Context, rules, specs and plans
├── scripts/             # Setup scripts
└── docker-compose.dev.yml
```

## Architecture Principles

- All business logic lives in the service layer, never in tRPC procedures — this enables a future public REST API without refactoring.
- Use Zod schemas for validation on both frontend and backend.

## Design

Clean & airy, role-based tabs. Brand tokens adapted from alehosts.com: indigo `#2205A4` signature, orange `#FF6B00` accent, Elms Sans throughout. Full spec: `context/design.md`.

## Documentation

| File | Contents |
| ---- | -------- |
| `context/project.md` | Project scope, goals and core features |
| `context/architecture.md` | Frontend, backend, database, APIs and data flow |
| `context/design.md` | UI design, look and feel |
| `context/code-standard.md` | Code style, testing, validation, libraries |
| `context/rules.md` | Dos and don'ts |
| `context/tasks.md` | Pending tasks and completed work |
| `context/features/` | Feature plans, named `<number>-<name>.md` (e.g. `01-setup-pnpm.md`) |
| `context/archive/` | Finished features in production |
| `context/hackathon.md` | Hackathon rules, dates and compliance |

## Contributing

See `AGENTS.md` for working agreements, architecture rules and the changelog policy.
