# Sparkl — Rules

> Project guardrails: what to do and not to do. Process rules (workflow, changelog policy) live in `AGENTS.md`; this file protects scope and quality.

## Do

- Build toward the demo script in `project.md` first; every feature must serve it.
- Keep business logic in services; tRPC procedures validate, authorize, and delegate.
- Route every user-facing string through the i18n package (English now, Spanish later).
- Put ranking-signal changes behind the weights config and its feature flag.
- Keep `README.md` and `CHANGELOG.md` in sync with scope and design changes.
- Scan for secrets before every commit; commit only when the scan is clean.
- Route low-thinking bulk work (advisory code reviews, doc reads/writes, dummy/seed data, CHANGELOG entries, prototype filler, i18n strings, boilerplate) to local `muse-glimmer:latest` first — see `.agents/skills/glimmer-delegate/`; the host plans, briefs, and verifies.

## Don't

- Don't build payments, auto-assignment, recurring schedules, the admin panel, or Spanish in the MVP — they are explicitly out of scope in `project.md`.
- Don't put business logic in tRPC procedures, UI components, or hooks.
- Don't add a colour, font, radius, or shadow without adding it to `design.md` first.
- Don't edit, reorder, or delete `CHANGELOG.md` history — it is append-only.
- Don't present seed or placeholder data as real; demo fixtures must be obviously fake.
- Don't merge below the 80% coverage gate or with failing lint.
- Don't introduce a new dependency that duplicates one already installed.
