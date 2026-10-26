# Sparkl — Code Standards

> Status: planned — no implementation exists yet. Code rules for humans and agents. Structure lives in [architecture.md](architecture.md), visuals in [design.md](design.md).

## Language

- TypeScript in strict mode, ESM (`import` / `export`).
- No `any` without a comment explaining why; prefer `unknown` plus narrowing.
- `null` for absent database values, `undefined` for absent optional parameters.

## Format and Lint

- Biome is the only formatter and linter (shared config in `packages/config`). No ESLint, no Prettier.
- Biome's organize-imports owns import order; don't hand-sort.
- Fix every lint and format finding before merging. No unused imports or locals.

## Naming and Imports

- Files are kebab-case, except components which are `PascalCase.tsx`. Tests are `<name>.test.ts(x)` colocated with the module.
- Variables and functions are camelCase, types and interfaces PascalCase, constants UPPER_SNAKE_CASE.
- Cross-package imports use workspace names (`@sparkl/shared`); inside a package use relative imports. No deep `../../../..` climbs — restructure instead.

## Validation

- Every tRPC input and output is validated with a Zod schema from `packages/shared`.
- Frontend forms reuse the same schemas. Never duplicate a schema — import it.

## Testing (Vitest)

- Colocated `*.test.ts(x)` next to the module under test.
- Test services directly — that is where the logic lives. Routers stay thin and are covered by integration tests.
- Factories over static fixtures. No network calls in unit tests; mock at the service boundary.
- CI enforces minimum 80% lines and functions. A change that drops below the gate fails.

## Errors and Logging

- Services throw typed errors; routers map them to `TRPCError` codes. Shared error codes live in `packages/shared`.
- Structured logs only (Fastify/pino on the backend). No `console.log` in shipped code.

## Database

- The Drizzle schema is the source of truth; every change goes through a versioned migration.
- No raw SQL unless Drizzle cannot express the query — then it lives in the service with a comment saying why.

## Dependencies

- Prefer the standard library and what is already installed.
- A new dependency needs one line of justification (in the change description or `tasks.md`) and must not duplicate an existing one.

## Security Baseline

- Never trust the client: re-check ownership and role in the service, not just the router.
- Secrets live in environment variables only — never in code, docs, or chat logs.
- Upload URLs are short-lived presigned URLs scoped to the caller's user id and bucket.
