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

### Changed

- `2026-10-27 05:12` — `context/hackathon.md`: verified schedule, submission, judging rubric, prizes and credit forms from details guide.
- `2026-10-27 05:13` — `context/hackathon.md`: Meta $150 credit claim marked submitted.
- `2026-10-27 05:16` — `context/hackathon.md`: eligibility confirmed.
- `2026-10-27 05:17` — `context/rules.md`: scan for secrets before every commit.

### Fixed

- `2026-10-27 05:53` — `.gitignore`: ignore installed skills via `.agents/skills/` (forward-slash directory match) and stop ignoring `skills-lock.json` so the lock file stays tracked.
