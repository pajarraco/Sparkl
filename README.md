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

Press `w` in the Expo terminal for web. `pnpm verify` runs `test` + `lint` + `typecheck`. `pnpm --filter @sparkl/frontend e2e` runs the Playwright web suites (local stack only, kept out of `pnpm verify`); `pnpm --filter @sparkl/api clean:e2e` wipes fake E2E rows (also runs automatically before each `e2e`). All commands: `AGENTS.md`.

## Phone Testing (Expo Go)

Phone and PC must be on the same WiFi. Three gotchas from real debugging:

- Expo reads `apps/frontend/.env`, not the repo-root `.env`. Put `EXPO_PUBLIC_API_URL=http://<PC-LAN-IP>:3000` there (gitignored). Fully restart Expo after changing it.
- `TRUSTED_ORIGINS` in the root `.env` must include the Expo Go origin: `exp://<PC-LAN-IP>:8081`. Restart the API after changing it.
- On web the app uses the page's own host for the API (same-site cookies); on native it uses `EXPO_PUBLIC_API_URL`. No per-device switching needed.
- Chat rides SSE over the same HTTP `/trpc` endpoint; there is no `ws://` URL to configure.

### On-device demo pass

1. Get the PC's LAN IP (`ipconfig`, e.g. `192.168.1.20`). Root `.env`: copy from `.env.example`, set a real `BETTER_AUTH_SECRET` and `TRUSTED_ORIGINS=http://localhost:8081,exp://<PC-LAN-IP>:8081`. Restart the API after changing it.
2. `pnpm install`, then `pnpm dev` (API on :3000, Expo on :8081). Scan the QR with the Expo Go app.
3. Seed with `pnpm --filter @sparkl/api seed:demo` (see Demo Logins below).
4. Walk the demo script in `context/project.md`: host posts a Friday turnover and sees ranked cleaners → cleaner sees the ranked job and claims it → chat to confirm → cleaner marks in progress, then completed → both leave 1–5 star reviews → the completed job shows in the host's history.

## Demo Logins (Testing)

Seed with `pnpm --filter @sparkl/api seed:demo`, then sign in with:

- Host: `demo-host@example.com`
- Cleaner: `demo-cleaner@example.com`
- Password for both: `demo-password-123` (or `$DEMO_PASSWORD` when set)

The seed also sets the cleaner service area + Friday availability and creates one open Friday turnover job at `1 Demo Lane Apt 4 (demo)`. Reruns reuse existing accounts and never duplicate.

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
