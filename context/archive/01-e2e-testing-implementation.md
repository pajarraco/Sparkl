# e2e testing implementation

implements full end-to-end testing on the frontend. Using Vitest and Playwright.
Routes, forms, bottoms, scroll and navigation. also test the logins, logout and registration.

## Plan

Grilled and agreed (14 decisions); no open questions remain.

### Goal

Turn this feature from a four-line brief into executable frontend E2E coverage:
routes, forms, buttons, scroll, navigation, plus login, logout, and
registration, using Vitest and Playwright.

Note: "bottoms" in the brief above means buttons. Playwright covers Expo web,
the only surface it can drive; native stays manual per `context/tasks.md`.
The Maestro smoke test in `context/tasks.md` Stretch stays as stretch. Runs
are local-only for now — no CI wiring.

### Success Criteria

- `pnpm --filter @sparkl/frontend test` still passes existing Vitest
  provider/schema tests, and a new `e2e` script runs Playwright green
  against local web + API.
- Auth flows pass end to end on web: sign-up with role pick, sign-in as host
  and cleaner, sign-out, invalid-credential and validation errors.
- The full demo happy path passes on web: host posts → cleaner claims → chat
  → in-progress → completed → both reviews.
- Core navigation passes: auth redirect, role tab bars from
  `context/design.md`, protected-route redirects when signed out, back-stack
  from job detail / chat / review screens.
- Board filters (date, distance, price), scroll, and every primary button
  pass, asserted by accessible label at 375px phone width and a wide desktop
  width.
- No business logic moves into components; tests assert through the UI and
  reuse `@sparkl/shared` schemas for test data shapes.
- The 80% Vitest coverage gate is unchanged; Playwright is additive evidence.

### Approach

Playwright drives the Expo web build; Vitest keeps covering form validators
and helpers in `apps/frontend/providers/*.test.ts` (the established pattern).
E2E runs against the local stack from `context/architecture.md`:
PostgreSQL/Redis/MinIO via `docker-compose.dev.yml`, API via `apps/api`,
web via Expo. Fixtures reuse the demo seed shape so E2E and the demo gate
exercise the same path. Each run registers its own timestamped host/cleaner
accounts so parallel workers and repeats never collide. Routine suites start
from seeded logged-in sessions via storage state; only the auth suite drives
the real sign-up/sign-in UI. Selectors use accessibility labels or `testID`
first, never CSS or text; missing labels are added inline with the test work.
Chat assertions use message history refetch, never socket-push timing.
Failure artifacts (traces on retry, failure screenshots) go under gitignored
`test-results/` and are never committed.

### Steps

1. Groundwork: add `@playwright/test` to `apps/frontend` with one-line
   justification (new-dep rule in `context/code-standard.md`); add
   `playwright.config.ts` targeting local Expo web with 375px and wide
   projects; add the `e2e` script; document web-only, local-only scope.
2. Fixtures: timestamped account factory (seed-shaped host/cleaner), seeded
   open job, and storage-state helpers producing logged-in sessions.
3. Auth suite (real UI): welcome → sign-up (host + cleaner) → sign-in →
   sign-out; invalid login, duplicate registration, form validation messages
   via shared Zod errors.
4. Navigation suite (seeded session): deep-link and tab coverage per role,
   protected-route redirects when signed out, back-stack from job detail /
   chat / review screens.
5. Forms and buttons suite (seeded session): Post Job create flow, board
   filters (date, distance, price), claim CTA, every primary button asserted
   by accessible label.
6. Scroll suite (seeded session): board FlatList scroll on web, pagination or
   lazy rows if present, no layout shift on row load, at both viewports.
7. Happy-path suite (seeded session): post → claim → chat (refetch
   assertions) → in-progress → completed → both reviews, end to end on web.
8. Wire-up: separate documented `e2e` command, kept out of `pnpm verify`;
   tick the Demo-gate and Stretch boxes in `context/tasks.md` only with green
   `test` + `typecheck` + `lint` output quoted; append a `CHANGELOG.md` entry
   under `[Unreleased]`.

### Validation Plan

- `pnpm --filter @sparkl/frontend test` — existing Vitest suites still green.
- `pnpm --filter @sparkl/frontend e2e` (new) — Playwright auth, navigation,
  forms, scroll, and happy-path suites green against local stack, both
  viewports.
- `pnpm typecheck` and `pnpm lint` — clean on touched work, per
  `context/rules.md`.
- Manual: one headed Playwright run plus largest-text-size spot check on auth
  and board screens.

### Risks

- Risk: Expo web is not native; native-only behavior (SecureStore session,
  native tab bar) stays uncovered. Mitigation: Playwright asserts the web
  demo-gate path; native stays manual per `context/tasks.md`.
- Risk: flaky chat/subscription timing over SSE. Mitigation: assert on history
  refetch, not socket push.
- Risk: local-only runs can rot between sessions. Mitigation: accepted for
  now; CI wiring is an explicit later decision, not part of this plan.
