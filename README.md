# Sparkl
Host and Cleaners connection App (Meta Global AI Developer Hackathon)

## Idea
A two-sided marketplace connecting Vacation rental hosts with cleaning professionals. Built with Expo (iOS, Android, Web), Fastify, tRPC, and PostgreSQL.

## Architecture
- All business logic MUST live in the service layer, never in tRPC procedures
- Service layer pattern enables future public REST API without refactoring
- Use Zod schemas for validation on both frontend and backend

## Stack
- Node.js 24
- pnpm
- Docker
- Expo SDK
- Expo Go
- Fastify
- tRPC
- Zod
- Drizzle ORM
- PostgreSQL
- Unleash
- Vitest
- React Native
- Typescript
- NativeWind v4
- Better Auth

## Context files
- `project.md` Project scope, goals and core feature
- `architecture.md` Frontend, backend, database and APIs and how the data flow
- `design.md` UI design, look and feel.
- `code-standard.md` code style, testing, validations, libraries.
- `rules.md` what to do and not to do.
- `tasks.md` TODO pending list of tasks and what was done.
- `features\` Folder with the features plan files to build, use number + name + .md. Sample `01-setup-pnpm.md`.
- `archive\` List of finished features in production.


## Structure
```
Sparkl/
├── apps/
│   ├── frontend/        # Expo app (iOS, Android, Web)
│   │   ├── app/         # Screens (Expo Router)
│   │   ├── components/  # UI components (atomic design)
│   │   ├── hooks/       # React hooks
│   │   ├── providers/   # Auth, tRPC providers
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
├── e2e/                 # End-to-end tests (Maestro)
├── context/             # Context, rules, specs and plans
├── scripts/             # Setup scripts
└── docker-compose.dev.yml
```

## Workflow
- Ask before doing anything — never act autonomously
- Make a step for each process or task
- Suggest ideas and improvements proactively
- Always think of security implications
- Keep documentation and change history updated

## Changelog
- `CHANGELOG.md` is APPEND-ONLY: for ANY change, add a NEW entry under `## [Unreleased]` stamped with the date and time (`YYYY-MM-DD HH:MM`). NEVER edit, reword, reorder, or delete existing entries
- This append-only rule applies ONLY to `CHANGELOG.md`. For all OTHER files (context, README, etc.) update and remove whatever is no longer relevant as normal
- Group entries under Added / Changed / Fixed / Removed / Security